import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionTabBar } from '../SessionTabBar';
import type { TabSessionItem } from '@/src/lib/sessionPersistenceService';

function makeTab(id: string, title: string, tabType: TabSessionItem['tabType'] = 'home'): TabSessionItem {
  return {
    id,
    title,
    url: `navegador://${id}`,
    tabType,
    isBrowsing: false,
    browsingUrl: '',
    runtimeUri: 'runtime://kernel',
    navHistory: [],
    navHistoryIndex: 0,
  };
}

const TABS = [makeTab('dashboard', 'Dashboard', 'dashboard'), makeTab('home', 'Navegar'), makeTab('vpn', 'VPN X', 'vpn')];

function Harness({ initialActive = 'dashboard' }: { initialActive?: string }) {
  const [active, setActive] = useState(initialActive);
  return (
    <SessionTabBar
      openTabs={TABS}
      activeTabId={active}
      onSelectTab={setActive}
      onCloseTab={() => {}}
      onNewTab={() => {}}
      isSessionSaved
    />
  );
}

describe('SessionTabBar', () => {
  it('expone las pestañas como un tablist accesible', () => {
    render(<Harness />);

    const tablist = screen.getByRole('tablist', { name: 'Pestañas abiertas' });
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    expect(tabs[0]).toHaveAttribute('aria-controls', 'navx-tabpanel');
  });

  it('solo la pestaña activa entra en el orden de tabulación', () => {
    render(<Harness />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    expect(tabs[2]).toHaveAttribute('tabindex', '-1');
  });

  it('cambia de pestaña con las flechas del teclado', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const tabs = screen.getAllByRole('tab');
    tabs[0].focus();
    await user.keyboard('{ArrowRight}');

    expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveFocus();

    await user.keyboard('{End}');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowRight}');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('cierra la pestaña con Delete y con el botón, con etiqueta accesible', async () => {
    const user = userEvent.setup();
    const onCloseTab = vi.fn();

    render(
      <SessionTabBar
        openTabs={TABS}
        activeTabId="home"
        onSelectTab={() => {}}
        onCloseTab={onCloseTab}
        onNewTab={() => {}}
        isSessionSaved={false}
      />,
    );

    const closeButton = screen.getByRole('button', { name: 'Cerrar pestaña VPN X' });
    await user.click(closeButton);
    expect(onCloseTab).toHaveBeenCalledWith('vpn');

    onCloseTab.mockClear();
    screen.getByRole('tab', { name: 'Navegar' }).focus();
    await user.keyboard('{Delete}');
    expect(onCloseTab).toHaveBeenCalledWith('home');
  });

  it('anuncia el estado de la sesión en una región viva', () => {
    render(<Harness />);
    expect(screen.getByRole('status')).toHaveTextContent('Sesión guardada en IndexedDB');
  });
});
