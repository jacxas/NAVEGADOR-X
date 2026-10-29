import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// `globals: false` en vitest.config.ts: sin esto, React Testing Library no
// desmonta entre pruebas y los elementos se acumulan en el DOM.
afterEach(() => {
  cleanup();
});

// El kernel registra sus plugins por consola al arrancar: es ruido en las pruebas.
vi.spyOn(console, 'log').mockImplementation(() => {});
