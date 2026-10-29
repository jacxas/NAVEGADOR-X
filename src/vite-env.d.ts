/// <reference types="vite/client" />

/**
 * Versión de `package.json`, inyectada en el build por Vite (`define`).
 * Es la única fuente de verdad de la versión que muestra la interfaz.
 */
declare const __APP_VERSION__: string;
