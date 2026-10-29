import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/src/lib/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  signInWithGoogle: vi.fn(),
  logout: vi.fn(),
  ensureUserProfile: vi.fn(),
  getCachedUserSession: () => null,
  cacheUserSession: vi.fn(),
  handleFirestoreError: vi.fn(),
  OperationType: { GET: 'get', WRITE: 'write' },
}));

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    // Sin usuario: el emulador de Firebase no existe en las pruebas.
    onAuthStateChanged: (_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return () => {};
    },
  };
});

vi.mock('@/src/lib/idbSession', () => ({
  getProfileSnapshotIDB: vi.fn().mockResolvedValue(null),
  saveProfileSnapshotIDB: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/src/lib/sessionPersistenceService', () => ({
  getBrowsingSession: vi.fn().mockResolvedValue(null),
  saveBrowsingSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/src/lib/aiClient', () => ({
  aiTranslate: vi.fn(),
}));

import App from '../App';

describe('App (humo)', () => {
  it('monta la interfaz y expone la barra de direcciones accesible', async () => {
    render(<App />);

    const address = screen.getByRole('textbox', { name: 'Barra de direcciones' });
    expect(address).toHaveValue('navegador://dashboard');
    expect(address).toHaveAttribute('aria-describedby', 'navx-address-scheme');

    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Pestañas abiertas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Inspector X-Ray del DOM' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('escribe una búsqueda en la barra y la convierte en URL de Google', async () => {
    const user = userEvent.setup();
    render(<App />);

    const address = screen.getByRole('textbox', { name: 'Barra de direcciones' });
    await user.clear(address);
    await user.type(address, 'mejores restaurantes{Enter}');

    expect(address).toHaveValue('https://www.google.com/search?q=mejores%20restaurantes');
  });

  it('cambia de sección al escribir una dirección interna con alias en español', async () => {
    const user = userEvent.setup();
    render(<App />);

    const address = screen.getByRole('textbox', { name: 'Barra de direcciones' });
    await user.clear(address);
    await user.type(address, 'navegador://vpn{Enter}');

    expect(screen.getByRole('button', { name: 'VPN X' })).toHaveAttribute('aria-current', 'page');
    expect(address).toHaveValue('navegador://vpn');
  });
});
