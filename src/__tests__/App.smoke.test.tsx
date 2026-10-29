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
import { APP_VERSION_LABEL } from '../lib/version';

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

  it('el dashboard ofrece accesos reales y no repite los paneles de otras pestañas', async () => {
    render(<App />);

    // Accesos que llevan a algún sitio.
    expect(await screen.findByRole('heading', { name: 'Empezar' })).toBeInTheDocument();
    // El acceso del dashboard se distingue por su subtítulo.
    expect(
      screen.getByRole('button', { name: /Favoritos\s*Guardados en este equipo/ }),
    ).toBeInTheDocument();

    // Los paneles de red y protecciones viven en sus pestañas (VPN X y Privacy
    // Shield); repetirlos aquí era lo que hacía que el dashboard pareciese el navegador.
    expect(screen.queryByRole('heading', { name: 'Conexión de red' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Protecciones activas' })).not.toBeInTheDocument();
  });

  it('permite copiar y pegar la dirección desde la barra', async () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Copiar la dirección' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pegar desde el portapapeles en la barra de direcciones' }),
    ).toBeInTheDocument();
  });

  it('muestra la versión real de package.json, no un texto escrito a mano', async () => {
    render(<App />);

    // La web publicada llegó a anunciar v0.3.0-alpha yendo por la 0.3.4.
    const heading = await screen.findByRole('heading', { name: new RegExp(`Navegador\\s*X`) });
    expect(heading).toHaveTextContent(APP_VERSION_LABEL);
    expect(screen.queryByText(/v0\.3\.0-alpha/)).not.toBeInTheDocument();
  });
});
