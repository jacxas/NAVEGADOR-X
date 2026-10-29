/**
 * Portapapeles con plan B.
 *
 * `navigator.clipboard` no siempre está disponible: exige contexto seguro, permiso
 * explícito y, dentro de un iframe, `allow="clipboard-write"`. Cuando falla lo hace
 * con una promesa rechazada que antes nadie recogía: el botón «Copiar» mostraba
 * «Copiado» y en el portapapeles no había nada. Aquí se intenta primero la API
 * moderna, después el `execCommand('copy')` clásico y, si tampoco, se devuelve un
 * resultado que la interfaz puede explicar al usuario.
 */

export type CopyMethod = 'clipboard' | 'execCommand' | 'ninguno';

export interface CopyResult {
  ok: boolean;
  method: CopyMethod;
  error?: string;
}

/** Copia texto al portapapeles intentando los dos métodos disponibles. */
export async function copyText(text: string): Promise<CopyResult> {
  if (typeof text !== 'string' || text.length === 0) {
    return { ok: false, method: 'ninguno', error: 'No hay texto que copiar.' };
  }

  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (clipboard && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return { ok: true, method: 'clipboard' };
    } catch {
      // Permiso denegado o contexto no seguro: se intenta el método clásico.
    }
  }

  if (copyWithExecCommand(text)) {
    return { ok: true, method: 'execCommand' };
  }

  return {
    ok: false,
    method: 'ninguno',
    error: 'El navegador bloqueó el acceso al portapapeles. Selecciona el texto y pulsa Ctrl+C (⌘+C en Mac).',
  };
}

/**
 * Ruta clásica: un `textarea` fuera de pantalla, selección y `execCommand`.
 * Sigue funcionando en navegadores e iframes donde la API moderna está bloqueada.
 */
export function copyWithExecCommand(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;

  const previousFocus = document.activeElement as HTMLElement | null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Fuera de la vista pero enfocable: `display:none` rompe `execCommand` en algunos
  // navegadores y `opacity:0` provoca saltos de scroll.
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.left = '-1000px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  let ok = false;
  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    textarea.remove();
    previousFocus?.focus?.();
  }
  return ok;
}

/** Lee el portapapeles si el navegador lo permite; `null` si no hay permiso. */
export async function readClipboardText(): Promise<string | null> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  if (!clipboard || typeof clipboard.readText !== 'function') return null;
  try {
    return await clipboard.readText();
  } catch {
    return null;
  }
}
