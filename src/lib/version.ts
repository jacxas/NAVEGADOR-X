/**
 * Versión de la aplicación.
 *
 * Se inyecta en el build desde `package.json` (ver `define` en `vite.config.ts`
 * y en `vitest.config.ts`). Antes estaba escrita a mano en seis sitios de la
 * interfaz y decía `v0.3.0-alpha` cuando el producto iba por la 0.3.4: la web
 * publicada mentía sobre su propia versión.
 */

declare const __APP_VERSION__: string | undefined;

/** Versión sin prefijo, p. ej. `0.3.5-alpha`. */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';

/** Versión lista para mostrar, p. ej. `v0.3.5-alpha`. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
