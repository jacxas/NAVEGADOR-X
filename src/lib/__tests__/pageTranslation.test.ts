/**
 * Pruebas de la traducción en su sitio.
 *
 * Lo que se comprueba aquí es la parte que puede fallar en silencio: trocear, leer
 * la respuesta del modelo y que los scripts inyectados hagan lo que dicen. La
 * traducción real se ejecuta contra el `<webview>` de escritorio, que no existe en
 * las pruebas unitarias.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  MAX_NODES,
  MARKER_ATTRIBUTE,
  ORIGINAL_ATTRIBUTE,
  buildApplyScript,
  buildCollectScript,
  buildRestoreScript,
  buildTranslationPrompt,
  chunk,
  parseTranslationResponse,
  translatePageInPlace,
  TranslationError,
} from '../pageTranslation';

vi.mock('../aiClient', () => ({
  aiQuery: vi.fn(),
}));

import { aiQuery } from '../aiClient';

describe('chunk', () => {
  it('parte en trozos del tamaño pedido', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('devuelve nada para una lista vacía', () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it('rechaza un tamaño inválido en lugar de girar en bucle', () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe('parseTranslationResponse', () => {
  it('lee un array JSON limpio', () => {
    expect(parseTranslationResponse('["Hola","Mundo"]', 2)).toEqual(['Hola', 'Mundo']);
  });

  it('lee el JSON envuelto en un bloque de código', () => {
    expect(parseTranslationResponse('```json\n["Hola"]\n```', 1)).toEqual(['Hola']);
  });

  it('lee el JSON con una frase delante', () => {
    expect(parseTranslationResponse('Claro, aquí está:\n["Hola","Adiós"]', 2)).toEqual(['Hola', 'Adiós']);
  });

  it('cae a la lectura línea a línea cuando no hay JSON', () => {
    expect(parseTranslationResponse('Hola\nAdiós', 2)).toEqual(['Hola', 'Adiós']);
  });

  it('devuelve null si la cantidad no cuadra (mejor no escribir nada)', () => {
    expect(parseTranslationResponse('["Hola"]', 3)).toBeNull();
  });

  it('devuelve null con una respuesta vacía', () => {
    expect(parseTranslationResponse('   ', 2)).toBeNull();
  });
});

describe('prompt', () => {
  it('incluye el idioma destino y las cadenas en JSON', () => {
    const prompt = buildTranslationPrompt(['Hello'], 'Español');
    expect(prompt).toContain('Español');
    expect(prompt).toContain('["Hello"]');
  });
});

describe('scripts inyectados', () => {
  it('el script de recogida lleva el límite y el marcador', () => {
    const script = buildCollectScript(7);
    expect(script).toContain('7');
    expect(script).toContain(MARKER_ATTRIBUTE);
  });

  it('el script de aplicación escapa el texto correctamente', () => {
    const script = buildApplyScript({ '0': 'Comillas "dobles" y \\ barra' });
    expect(script).toContain(MARKER_ATTRIBUTE);
    expect(script).toContain(ORIGINAL_ATTRIBUTE);
    // El JSON debe seguir siendo válido dentro de la cadena inyectada.
    expect(script).toContain('Comillas \\"dobles\\"');
  });

  it('el script de restauración borra las marcas', () => {
    const script = buildRestoreScript();
    expect(script).toContain(ORIGINAL_ATTRIBUTE);
    expect(script).toContain('removeAttribute');
  });
});

describe('translatePageInPlace', () => {
  it('traduce y aplica por trozos, informando del avance', async () => {
    const nodes = Array.from({ length: 3 }, (_, index) => ({ id: String(index), text: `Texto ${index}` }));
    const executeJavaScript = vi.fn().mockResolvedValueOnce(nodes).mockResolvedValue(1);
    vi.mocked(aiQuery).mockResolvedValue({ response: '["Uno","Dos","Tres"]', offline: false } as never);
    const onProgress = vi.fn();

    const result = await translatePageInPlace({ executeJavaScript }, 'Español', { onProgress });

    expect(result).toEqual({ translated: 3, total: 3, failed: 0 });
    expect(onProgress).toHaveBeenLastCalledWith({ done: 3, total: 3 });
    // Recogida + aplicación
    expect(executeJavaScript).toHaveBeenCalledTimes(2);
  });

  it('si el modelo responde mal, cuenta el fallo pero no revienta', async () => {
    const executeJavaScript = vi.fn().mockResolvedValueOnce([{ id: '0', text: 'Hello' }]).mockResolvedValue(0);
    vi.mocked(aiQuery).mockRejectedValue(new Error('sin clave'));

    const result = await translatePageInPlace({ executeJavaScript }, 'Español');

    expect(result).toEqual({ translated: 0, total: 1, failed: 1 });
  });

  it('sin texto en la página avisa en vez de decir que ha traducido cero', async () => {
    const executeJavaScript = vi.fn().mockResolvedValueOnce([]);
    vi.mocked(aiQuery).mockReset();

    await expect(translatePageInPlace({ executeJavaScript }, 'Español')).rejects.toMatchObject({
      code: 'sin-contenido',
    });
    expect(aiQuery).not.toHaveBeenCalled();
  });

  it('con el motor local (sin clave) corta y pide configurar la IA', async () => {
    const executeJavaScript = vi
      .fn()
      .mockResolvedValueOnce([{ id: '0', text: 'Hello' }])
      .mockResolvedValue(0);
    vi.mocked(aiQuery).mockResolvedValue({ response: '[Modo Offline] …', offline: true } as never);

    const error = await translatePageInPlace({ executeJavaScript }, 'Español').catch((caught) => caught);

    expect(error).toBeInstanceOf(TranslationError);
    expect(error.code).toBe('sin-clave');
    // No se escribe nada encima de la página: solo se leyó.
    expect(executeJavaScript).toHaveBeenCalledTimes(1);
  });

  it('respeta el límite de nodos que se le pasa', async () => {
    const executeJavaScript = vi.fn().mockResolvedValueOnce([]);

    await translatePageInPlace({ executeJavaScript }, 'Español', { maxNodes: 5 }).catch(() => undefined);

    expect(executeJavaScript.mock.calls[0][0]).toContain('5');
    expect(MAX_NODES).toBeGreaterThan(5);
  });
});
