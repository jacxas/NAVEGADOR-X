import React, { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusTrap } from '../a11y';

function Dialog({ onClose, active = true }: { onClose: () => void; active?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, { onEscape: onClose, active });

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Prueba">
      <button type="button">Primero</button>
      <button type="button">Segundo</button>
      <button type="button">Último</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('lleva el foco al primer elemento enfocable al abrirse', () => {
    render(<Dialog onClose={() => {}} />);
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();
  });

  it('cicla el Tab dentro del diálogo y no se escapa al fondo', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Fondo</button>
        <Dialog onClose={() => {}} />
      </>,
    );

    const first = screen.getByRole('button', { name: 'Primero' });
    const last = screen.getByRole('button', { name: 'Último' });

    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    await user.tab();
    expect(first).toHaveFocus();
  });

  it('llama a onEscape al pulsar Escape', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<Dialog onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('devuelve el foco a quien abrió el diálogo al cerrarlo', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Abrir
          </button>
          {open && <Dialog onClose={() => setOpen(false)} />}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Primero' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
