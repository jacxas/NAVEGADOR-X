/**
 * Traducción de la página en su sitio.
 *
 * En la Edición de Escritorio el contenido vive en un `<webview>` propio, así que
 * se puede leer y reescribir su texto sin salir de la página: no hace falta abrir
 * un recuadro con la traducción aparte. En la edición web el contenido está en un
 * iframe de otro origen y el navegador no permite tocarlo; allí se usa el panel
 * lateral de lectura.
 *
 * Las funciones de este archivo están separadas en dos grupos:
 *  - puras y probables (trocear, interpretar la respuesta del modelo, construir los
 *    scripts que se inyectan en la página);
 *  - `translatePageInPlace`, que las usa contra un `<webview>` real.
 */

import { aiQuery } from './aiClient';

/** Nodo de texto visible de la página, identificado por un atributo propio. */
export interface PageTextNode {
  id: string;
  text: string;
}

/** Atributo con el que se marca cada nodo para poder volver a encontrarlo. */
export const MARKER_ATTRIBUTE = 'data-navx-t';

/** Atributo donde se guarda el texto original para poder restaurarlo. */
export const ORIGINAL_ATTRIBUTE = 'data-navx-orig';

/** Longitud mínima de un texto para merecer traducción. */
const MIN_CHARS = 2;

/** Cuántos nodos se traducen como máximo en una pasada. */
export const MAX_NODES = 120;

/** Nodos por petición al modelo: menos, más rápido el primer resultado visible. */
export const NODES_PER_BATCH = 25;

/**
 * Script que se inyecta en la página para recoger los nodos de texto visibles.
 *
 * Se ejecuta como cadena porque `executeJavaScript` no acepta funciones. Marca
 * cada nodo con `data-navx-t` para que la segunda pasada (la que escribe la
 * traducción) los encuentre sin depender del orden del DOM.
 */
export function buildCollectScript(limit: number = MAX_NODES): string {
  return `(() => {
    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE']);
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || SKIP.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        const text = (node.nodeValue || '').trim();
        if (text.length < ${MIN_CHARS}) return NodeFilter.FILTER_REJECT;
        if (!/[a-zA-ZÀ-ÿ]{2,}/.test(text)) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let index = 0;
    while (walker.nextNode() && out.length < ${limit}) {
      const node = walker.currentNode;
      const text = (node.nodeValue || '').trim();
      const id = String(index++);
      const parent = node.parentElement;
      if (parent) parent.setAttribute('${MARKER_ATTRIBUTE}', id);
      out.push({ id, text });
    }
    return out;
  })()`;
}

/**
 * Script que escribe las traducciones y guarda el original en cada nodo.
 * Recibe el mapa `{ id: textoTraducido }` ya serializado.
 */
export function buildApplyScript(translations: Record<string, string>): string {
  const payload = JSON.stringify(translations);
  return `(() => {
    const map = ${payload};
    let applied = 0;
    document.querySelectorAll('[${MARKER_ATTRIBUTE}]').forEach((element) => {
      const id = element.getAttribute('${MARKER_ATTRIBUTE}');
      const translated = map[id];
      if (!translated) return;
      // Se guarda el original una sola vez: restaurar debe devolver el texto de la
      // página, no la traducción de una pasada anterior.
      if (!element.hasAttribute('${ORIGINAL_ATTRIBUTE}')) {
        element.setAttribute('${ORIGINAL_ATTRIBUTE}', element.textContent || '');
      }
      // Solo se sustituye el nodo de texto: se conservan los elementos hijos, los
      // enlaces y las imágenes de la página.
      const textNode = Array.from(element.childNodes).find((child) => child.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.nodeValue = translated;
      applied++;
    });
    return applied;
  })()`;
}

/** Script que devuelve la página a su idioma original. */
export function buildRestoreScript(): string {
  return `(() => {
    let restored = 0;
    document.querySelectorAll('[${ORIGINAL_ATTRIBUTE}]').forEach((element) => {
      const original = element.getAttribute('${ORIGINAL_ATTRIBUTE}');
      if (original === null) return;
      const textNode = Array.from(element.childNodes).find((child) => child.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.nodeValue = original;
      element.removeAttribute('${ORIGINAL_ATTRIBUTE}');
      element.removeAttribute('${MARKER_ATTRIBUTE}');
      restored++;
    });
    return restored;
  })()`;
}

/** Parte una lista en trozos de tamaño fijo. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) throw new Error('El tamaño del trozo debe ser positivo');
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/** Instrucción que se le da al motor de IA para cada trozo. */
export function buildTranslationPrompt(texts: string[], targetLanguage: string): string {
  return [
    `Traduce al ${targetLanguage} cada cadena del array JSON que viene abajo.`,
    'Responde SOLO con un array JSON de cadenas, en el mismo orden y con la misma cantidad de elementos.',
    'No añadas explicaciones, ni numeración, ni bloques de código. Si una cadena es un nombre propio o un',
    'número que no debe traducirse, devuélvela tal cual. Conserva los signos de puntuación.',
    '',
    JSON.stringify(texts),
  ].join('\n');
}

/**
 * Interpreta la respuesta del modelo como lista de traducciones.
 *
 * Los modelos a veces envuelven el JSON en ```json … ``` o añaden una frase antes.
 * Si no hay JSON válido se intenta una lectura línea a línea; si tampoco cuadra, se
 * devuelve `null` para que quien llama no escriba nada a medias.
 */
export function parseTranslationResponse(raw: string, expected: number): string[] | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;

  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();

  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const candidate = cleaned.slice(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length === expected) {
        return parsed.map((item) => (typeof item === 'string' ? item : String(item ?? '')));
      }
    } catch {
      // Se intenta la lectura línea a línea.
    }
  }

  const lines = cleaned
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  if (lines.length === expected) return lines;
  return null;
}

/**
 * Error con código, para que la interfaz pueda explicar el motivo exacto.
 *
 * Casos que se distinguen:
 *  - `sin-clave`: el motor local (sin clave de IA) no traduce, solo simula. Seguir
 *    adelante escribiría texto de relleno encima de la página, así que se corta.
 *  - `sin-contenido`: no se encontró texto traducible en la página.
 */
export class TranslationError extends Error {
  public readonly code: 'sin-clave' | 'sin-contenido';

  constructor(code: 'sin-clave' | 'sin-contenido', message: string) {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
  }
}

/** Progreso de una traducción en curso. */
export interface TranslationProgress {
  done: number;
  total: number;
}

export interface InPlaceResult {
  translated: number;
  total: number;
  failed: number;
}

/** Webview de Electron, reducido a lo que se usa aquí. */
export interface ExecutableView {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
}

/**
 * Traduce la página visible dentro del `<webview>`, por trozos y sin abrir nada.
 *
 * Si un trozo falla, se sigue con el resto: es preferible una página medio
 * traducida y un contador honesto que una pantalla en blanco.
 */
export async function translatePageInPlace(
  view: ExecutableView,
  targetLanguage: string,
  options: { onProgress?: (progress: TranslationProgress) => void; maxNodes?: number } = {},
): Promise<InPlaceResult> {
  const nodes = (await view.executeJavaScript(buildCollectScript(options.maxNodes ?? MAX_NODES))) as PageTextNode[];
  const list = Array.isArray(nodes) ? nodes.filter((node) => node && node.text) : [];

  if (list.length === 0) {
    throw new TranslationError(
      'sin-contenido',
      'No se ha encontrado texto que traducir en esta página. Puede que su contenido esté en un marco de otro origen.',
    );
  }

  const translatedMap: Record<string, string> = {};
  let done = 0;
  let failed = 0;

  for (const batch of chunk(list, NODES_PER_BATCH)) {
    try {
      const result = await aiQuery(buildTranslationPrompt(batch.map((node) => node.text), targetLanguage), {
        systemInstruction:
          'Eres un traductor profesional integrado en un navegador. Devuelves JSON válido y nada más.',
      });

      // Sin clave de IA el motor responde con texto de relleno: escribir eso encima
      // de la página sería peor que no traducir. Se corta y se explica qué falta.
      if (result.offline) {
        throw new TranslationError(
          'sin-clave',
          'La traducción en la página necesita un modelo de IA. Ahora mismo funciona el motor local, que no traduce: configura una clave en Ajustes de IA.',
        );
      }

      const translations = parseTranslationResponse(result.response || '', batch.length);
      if (!translations) {
        failed += batch.length;
      } else {
        batch.forEach((node, index) => {
          const value = translations[index];
          if (typeof value === 'string' && value.trim()) translatedMap[node.id] = value;
        });
        // Se aplica trozo a trozo: el usuario ve avances en lugar de esperar al final.
        await view.executeJavaScript(buildApplyScript(translatedMap));
      }
    } catch (error) {
      // Un problema de configuración no se arregla repitiendo trozos: se propaga.
      if (error instanceof TranslationError) throw error;
      failed += batch.length;
    } finally {
      done += batch.length;
      options.onProgress?.({ done: Math.min(done, list.length), total: list.length });
    }
  }

  return { translated: Object.keys(translatedMap).length, total: list.length, failed };
}

/** Devuelve la página a su idioma original. */
export async function restorePage(view: ExecutableView): Promise<number> {
  const restored = await view.executeJavaScript(buildRestoreScript());
  return typeof restored === 'number' ? restored : 0;
}
