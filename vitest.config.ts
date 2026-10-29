import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const {version: appVersion} = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));

/**
 * Configuración de pruebas unitarias.
 *
 * Se mantiene separada de `vite.config.ts` (que arrastra el plugin de Tailwind y
 * el troceado del build) para que los tests arranquen rápido y sin CSS.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
