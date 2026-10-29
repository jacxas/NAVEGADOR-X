/**
 * Utilidades de accesibilidad compartidas por la interfaz.
 *
 * No dependen de ninguna librería más allá de React: el objetivo es que los
 * cuadros de diálogo se comporten como tales (foco atrapado, Escape para
 * cerrar y devolución del foco al elemento que los abrió).
 */

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Elementos enfocables y visibles dentro de un contenedor. */
export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  // No se usa `offsetParent` como filtro de visibilidad: devuelve `null` en
  // jsdom y también para elementos dentro de contenedores `position: fixed`,
  // que es justo lo que son los diálogos.
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('hidden') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      getComputedStyle(element).visibility !== 'hidden',
  );
}

export interface FocusTrapOptions {
  /** Se llama al pulsar Escape dentro del diálogo. */
  onEscape?: () => void;
  /** Si es `false`, el hook queda inerte (diálogo cerrado). */
  active?: boolean;
}

/**
 * Atrapa el foco dentro de un diálogo modal.
 *
 * - Al activarse, enfoca el primer elemento enfocable (o el contenedor).
 * - Tab y Shift+Tab ciclan dentro del diálogo en vez de escaparse al fondo.
 * - Escape invoca `onEscape`.
 * - Al desactivarse, devuelve el foco a quien lo tenía antes de abrir.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  { onEscape, active = true }: FocusTrapOptions = {},
) {
  // El callback vive en una ref: si cambiara en cada render, el efecto se
  // reiniciaría y devolvería el foco al primer elemento en cada pulsación.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = getFocusableElements(container);
      if (elements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [ref, active]);
}

/** Cierra una capa con Escape mientras esté abierta. */
export function useEscapeToClose(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active]);
}
