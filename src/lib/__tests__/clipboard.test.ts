/**
 * Pruebas del portapapeles.
 *
 * El fallo original: `navigator.clipboard.writeText` devuelve una promesa que se
 * rechaza cuando la página no es un contexto seguro o el iframe no tiene permiso,
 * y nadie la recogía. El usuario pulsaba «Copiar», no pasaba nada y no había ni
 * mensaje. Aquí se fija el comportamiento: siempre un resultado explícito y, si la
 * API moderna no está, se recurre al `execCommand` clásico.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, readClipboardText } from '../clipboard';

type ClipboardStub = { writeText: (text: string) => Promise<void>; readText: () => Promise<string> };

function installClipboard(stub: ClipboardStub | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: stub,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  installClipboard(undefined);
});

describe('copyText', () => {
  it('copia con la API moderna y lo confirma', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard({ writeText, readText: vi.fn() });

    const result = await copyText('hola');

    expect(result).toEqual({ ok: true, method: 'clipboard' });
    expect(writeText).toHaveBeenCalledWith('hola');
  });

  it('si la API moderna falla, usa execCommand y lo confirma', async () => {
    installClipboard({
      writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      readText: vi.fn(),
    });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true, writable: true });

    const result = await copyText('respaldo');

    expect(result).toEqual({ ok: true, method: 'execCommand' });
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('si no hay ningún camino, devuelve un error explicable en vez de callarse', async () => {
    installClipboard({
      writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      readText: vi.fn(),
    });
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
      writable: true,
    });

    const result = await copyText('nada');

    expect(result.ok).toBe(false);
    expect(result.method).toBe('ninguno');
    expect(result.error).toMatch(/Ctrl\+C/);
  });

  it('no intenta copiar texto vacío', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard({ writeText, readText: vi.fn() });

    const result = await copyText('');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/No hay texto/);
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe('readClipboardText', () => {
  it('devuelve el texto del portapapeles', async () => {
    installClipboard({ writeText: vi.fn(), readText: vi.fn().mockResolvedValue('https://example.com') });

    await expect(readClipboardText()).resolves.toBe('https://example.com');
  });

  it('devuelve null cuando el navegador lo bloquea', async () => {
    installClipboard({ writeText: vi.fn(), readText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) });

    await expect(readClipboardText()).resolves.toBeNull();
  });
});
