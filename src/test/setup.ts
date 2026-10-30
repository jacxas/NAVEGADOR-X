import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// En máquinas lentas el re-render completo de la SPA con jsdom puede tardar
// más de 1 s (el valor por defecto de waitFor/findBy): con 5 s dejan de ser
// inestables sin ocultar fallos reales.
configure({ asyncUtilTimeout: 5_000 });

// `globals: false` en vitest.config.ts: sin esto, React Testing Library no
// desmonta entre pruebas y los elementos se acumulan en el DOM.
afterEach(() => {
  cleanup();
});

// El kernel registra sus plugins por consola al arrancar: es ruido en las pruebas.
vi.spyOn(console, 'log').mockImplementation(() => {});
