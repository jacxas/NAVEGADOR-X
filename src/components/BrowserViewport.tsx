/**
 * BrowserViewport — el motor de navegación real.
 *
 * - Edición de escritorio: `<webview>` de Electron. Navega la web de verdad, con
 *   sesión persistente, historial propio y eventos de carga reales.
 * - Edición web: `<iframe>`, que la mayoría de los sitios bloquea por
 *   `X-Frame-Options`/CSP. En ese caso se muestra un aviso honesto y un acceso a la
 *   Edición de Escritorio, en lugar de fingir que se está navegando.
 *
 * El componente se comunica con el resto de la aplicación por el EventBus del kernel:
 *   - publica `viewport.state`   → { url, title, loading, canGoBack, canGoForward }
 *   - publica `viewport.loading` / `viewport.loadend` / `viewport.title`
 *   - escucha `viewport.command` → { action: 'back' | 'forward' | 'reload' | 'stop' | 'load', url? }
 *
 * Nota importante: la API del `<webview>` lanza una excepción si se invoca antes de
 * que el elemento esté en el DOM y haya emitido `dom-ready`. Todas las llamadas pasan
 * por `safeCall` para que un fallo aislado nunca tumbe la interfaz.
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { kernel } from '@/src/kernel/BrowserKernel';
import { isDesktopApp, openExternal, SHARED_PARTITION } from '@/src/lib/desktop';
import type { ElectronWebviewElement } from '@/src/types/desktop';
import { restorePage, translatePageInPlace } from '@/src/lib/pageTranslation';

const BROWSER_PARTITION = 'persist:navegadorx';

/** Ejecuta una llamada al webview devolviendo un valor de reserva si aún no está listo. */
function safeCall<T>(operation: () => T, fallback: T): T {
  try {
    return operation();
  } catch {
    return fallback;
  }
}

export interface BrowserViewportHandle {
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  getURL(): string;
  getTitle(): string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  loadURL(url: string): void;
}

/**
 * Datos de una app instalable (PWA) detectada en la página cargada.
 * Sale de leer el `<link rel="manifest">` dentro del propio webview.
 */
export interface PwaInfo {
  url: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface BrowserViewportProps {
  url: string;
  /**
   * Partición de sesión. La compartida mantiene las cookies entre pestañas; una
   * dedicada da a esta pestaña su propia sesión y su propia ruta de red.
   */
  partition?: string;
  /** Oculta el aviso de modo limitado (lo usa la Home para incrustar contenido propio). */
  hideWebNotice?: boolean;
  onNavigate?: (url: string, title?: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  onLoadEnd?: (durationMs: number) => void;
  /** Avisa cuando la página cargada es una PWA instalable (o deja de serlo). */
  onPwaDetected?: (info: PwaInfo | null) => void;
}

interface ViewportError {
  code: number;
  description: string;
  url: string;
}

export const BrowserViewport = forwardRef<BrowserViewportHandle, BrowserViewportProps>(function BrowserViewport(
  { url, partition = SHARED_PARTITION, hideWebNotice = false, onNavigate, onLoadingChange, onLoadEnd, onPwaDetected },
  ref,
) {
  const desktop = isDesktopApp();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<ElectronWebviewElement | null>(null);
  const domReadyRef = useRef(false);
  const loadStartedAt = useRef<number>(0);
  const [error, setError] = useState<ViewportError | null>(null);
  const [ready, setReady] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  /** Ref del callback de PWA: evita resuscribir el webview en cada render. */
  const onPwaDetectedRef = useRef(onPwaDetected);
  onPwaDetectedRef.current = onPwaDetected;

  /** Lecturas seguras del estado del webview. */
  const readState = useCallback(() => {
    const view = webviewRef.current;
    if (!view || !domReadyRef.current) return null;
    return {
      url: safeCall(() => view.getURL(), '') || url,
      title: safeCall(() => view.getTitle(), ''),
      loading: safeCall(() => view.isLoading(), false),
      canGoBack: safeCall(() => view.canGoBack(), false),
      canGoForward: safeCall(() => view.canGoForward(), false),
    };
  }, [url]);

  const publishState = useCallback(() => {
    const state = readState();
    if (!state) return;
    kernel.eventBus.publish('viewport.state', state, 'BrowserViewport');
  }, [readState]);

  const handleBack = useCallback(() => {
    if (!domReadyRef.current) return;
    safeCall(() => webviewRef.current?.goBack(), undefined);
  }, []);
  const handleForward = useCallback(() => {
    if (!domReadyRef.current) return;
    safeCall(() => webviewRef.current?.goForward(), undefined);
  }, []);
  const handleReload = useCallback(() => {
    if (!domReadyRef.current) return;
    setError(null);
    safeCall(() => webviewRef.current?.reload(), undefined);
  }, []);
  const handleStop = useCallback(() => {
    if (!domReadyRef.current) return;
    safeCall(() => webviewRef.current?.stop(), undefined);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      goBack: handleBack,
      goForward: handleForward,
      reload: handleReload,
      stop: handleStop,
      getURL: () => readState()?.url || url,
      getTitle: () => readState()?.title || '',
      canGoBack: () => readState()?.canGoBack ?? false,
      canGoForward: () => readState()?.canGoForward ?? false,
      loadURL: (next: string) => {
        if (webviewRef.current) webviewRef.current.src = next;
      },
    }),
    [handleBack, handleForward, handleReload, handleStop, readState, url],
  );

  // --- Creación del <webview> (solo escritorio) -------------------------------
  useEffect(() => {
    if (!desktop) return;
    const container = containerRef.current;
    if (!container) return;

    // `partition` debe fijarse ANTES de insertar el elemento en el DOM: así todas
    // las pestañas comparten la misma sesión persistente (cookies, logins, caché).
    const view = document.createElement('webview') as unknown as ElectronWebviewElement;
    view.setAttribute('partition', partition);
    view.setAttribute('src', url);
    view.setAttribute('allowpopups', 'false');
    view.setAttribute('webpreferences', 'contextIsolation=yes,nodeIntegration=no,sandbox=yes,javascript=yes');
    view.style.width = '100%';
    view.style.height = '100%';
    view.style.border = 'none';
    view.style.display = 'flex';
    view.style.opacity = '0';
    view.style.transition = 'opacity 180ms ease-out';

    container.appendChild(view);
    webviewRef.current = view;

    const onDomReady = () => {
      domReadyRef.current = true;
      setReady(true);
      view.style.opacity = '1';
      publishState();
      void detectPwa(view);
    };

    /** ¿La página cargada declara un manifest instalable? Se lee dentro del webview. */
    const detectPwa = async (target: ElectronWebviewElement) => {
      try {
        const currentUrl = safeCall(() => target.getURL(), url);
        if (!/^https?:/i.test(currentUrl)) {
          onPwaDetectedRef.current?.(null);
          return;
        }
        const info = (await target.executeJavaScript(
          `(async () => {
            try {
              const link = document.querySelector('link[rel="manifest"]');
              if (!link) return null;
              const response = await fetch(link.href, { cache: 'no-store' });
              if (!response.ok) return null;
              const manifest = await response.json();
              const size = (i) => parseInt(String(i.sizes || '0').split('x')[0], 10) || 0;
              const icons = (manifest.icons || []).slice().sort((a, b) => size(b) - size(a));
              return {
                name: String(manifest.name || manifest.short_name || location.hostname).slice(0, 60),
                icon: icons.length ? new URL(icons[0].src, link.href).href : null,
                color: manifest.theme_color || manifest.background_color || null,
                url: location.origin + '/',
              };
            } catch (error) { return null; }
          })()`,
        )) as PwaInfo | null;
        onPwaDetectedRef.current?.(info || null);
      } catch {
        onPwaDetectedRef.current?.(null);
      }
    };
    const onStartLoading = () => {
      loadStartedAt.current = performance.now();
      onLoadingChange?.(true);
      kernel.eventBus.publish('viewport.loading', { loading: true }, 'BrowserViewport');
      publishState();
    };
    const onStopLoading = () => {
      onLoadingChange?.(false);
      if (loadStartedAt.current > 0) {
        const durationMs = Math.round(performance.now() - loadStartedAt.current);
        onLoadEnd?.(durationMs);
        kernel.eventBus.publish(
          'viewport.loadend',
          { durationMs, url: safeCall(() => view.getURL(), url) },
          'BrowserViewport',
        );
        loadStartedAt.current = 0;
      }
      publishState();
    };
    const onNavigateEvent = (event: any) => {
      const nextUrl: string = event?.url || safeCall(() => view.getURL(), '');
      const title: string = safeCall(() => view.getTitle(), '');
      setError(null);
      if (nextUrl) onNavigate?.(nextUrl, title);
      publishState();
    };
    const onTitleUpdated = (event: any) => {
      const title: string = event?.title || safeCall(() => view.getTitle(), '');
      const currentUrl = safeCall(() => view.getURL(), url);
      kernel.eventBus.publish('viewport.title', { url: currentUrl, title }, 'BrowserViewport');
      if (currentUrl) onNavigate?.(currentUrl, title);
    };
    const onFailLoad = (event: any) => {
      // -3 → ABORTED: cancelaciones normales, no las tratamos como error visible.
      if (event?.errorCode === -3) return;
      if (event?.isMainFrame === false) return;
      setError({
        code: event?.errorCode ?? 0,
        description: event?.errorDescription || 'No se pudo cargar la página',
        url: event?.validatedURL || url,
      });
      onLoadingChange?.(false);
    };
    const onGone = (event: any) => {
      setError({
        code: -1,
        description: `El proceso de la página terminó inesperadamente (${event?.reason || 'desconocido'})`,
        url: safeCall(() => view.getURL(), url),
      });
    };

    view.addEventListener('dom-ready', onDomReady);
    view.addEventListener('did-start-loading', onStartLoading);
    view.addEventListener('did-stop-loading', onStopLoading);
    view.addEventListener('did-navigate', onNavigateEvent);
    view.addEventListener('did-navigate-in-page', onNavigateEvent);
    view.addEventListener('page-title-updated', onTitleUpdated);
    view.addEventListener('did-fail-load', onFailLoad);
    view.addEventListener('render-process-gone', onGone);

    return () => {
      view.removeEventListener('dom-ready', onDomReady);
      view.removeEventListener('did-start-loading', onStartLoading);
      view.removeEventListener('did-stop-loading', onStopLoading);
      view.removeEventListener('did-navigate', onNavigateEvent);
      view.removeEventListener('did-navigate-in-page', onNavigateEvent);
      view.removeEventListener('page-title-updated', onTitleUpdated);
      view.removeEventListener('did-fail-load', onFailLoad);
      view.removeEventListener('render-process-gone', onGone);
      domReadyRef.current = false;
      view.remove();
      webviewRef.current = null;
      setReady(false);
    };
    // El `src` se gestiona en el efecto siguiente; aquí solo se monta el elemento.
    // Al cambiar de partición se recrea el webview, que es lo único válido: una
    // pestaña no puede cambiar de cookie jar sin recargarse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop, partition]);

  // --- Cambios de URL solicitados por la interfaz -----------------------------
  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return;
    // Antes de `dom-ready` no se puede consultar la URL: basta con asignar `src`.
    const current = domReadyRef.current ? safeCall(() => view.getURL(), '') : '';
    if (current === url) return;
    view.src = url;
  }, [url]);

  // --- Comandos del kernel (barra de herramientas, menú nativo, atajos) -------
  useEffect(() => {
    if (!desktop) return;
    const unsubscribe = kernel.eventBus.subscribe('viewport.command', (event) => {
      const action = (event.payload as { action?: string; url?: string })?.action;
      const target = (event.payload as { url?: string })?.url;
      switch (action) {
        case 'back':
          handleBack();
          break;
        case 'forward':
          handleForward();
          break;
        case 'reload':
          handleReload();
          break;
        case 'stop':
          handleStop();
          break;
        case 'load':
          if (target && webviewRef.current) webviewRef.current.src = target;
          break;
        case 'translate-page': {
          // Traducción en la propia página: se lee el texto del webview, se traduce
          // por trozos y se reescribe en su sitio. No abre ningún recuadro.
          const language = (event.payload as { language?: string })?.language || 'Español';
          const view = webviewRef.current;
          if (!view) {
            kernel.eventBus.publish(
              'translation.failed',
              { reason: 'La página aún no ha terminado de cargarse.' },
              'BrowserViewport',
            );
            break;
          }
          kernel.eventBus.publish('translation.started', { language }, 'BrowserViewport');
          void translatePageInPlace(view, language, {
            onProgress: (progress) =>
              kernel.eventBus.publish('translation.progress', { ...progress, language }, 'BrowserViewport'),
          })
            .then((result) =>
              kernel.eventBus.publish('translation.done', { ...result, language }, 'BrowserViewport'),
            )
            .catch((error: unknown) =>
              kernel.eventBus.publish(
                'translation.failed',
                { reason: error instanceof Error ? error.message : 'Error desconocido' },
                'BrowserViewport',
              ),
            );
          break;
        }
        case 'restore-page': {
          const view = webviewRef.current;
          if (!view) break;
          void restorePage(view)
            .then((restored) =>
              kernel.eventBus.publish('translation.restored', { restored }, 'BrowserViewport'),
            )
            .catch(() => undefined);
          break;
        }
        default:
          break;
      }
    });
    return unsubscribe;
  }, [desktop, handleBack, handleForward, handleReload, handleStop]);

  // ---------------------------------------------------------------------------
  // Modo web: iframe + aviso honesto
  // ---------------------------------------------------------------------------
  if (!desktop) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-[#0b0f14]">
        <iframe
          id="navx-viewport"
          src={url}
          title="Área de contenido de Navegador X"
          className="h-full w-full border-none bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
        />
        {!hideWebNotice && !noticeDismissed && (
          <div className="absolute inset-x-0 top-0 z-20 border-b border-amber-500/30 bg-[#1a1408]/95 px-4 py-2 backdrop-blur-md">
            <div className="mx-auto flex max-w-4xl items-start gap-3">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
              <div className="flex-1 text-[11px] leading-relaxed text-amber-100/90">
                <span className="font-bold uppercase tracking-wider text-amber-300">Modo web limitado · </span>
                esta edición se ejecuta dentro de un navegador, así que solo puede incrustar sitios que lo permitan.
                La mayoría (Google, YouTube, GitHub, bancos…) lo bloquea por seguridad con <code>X-Frame-Options</code>{' '}
                o <code>CSP</code> y verás una página en blanco. La{' '}
                <span className="font-semibold text-amber-200">Edición de Escritorio</span> usa un motor de navegación
                real y abre cualquier sitio.
              </div>
              <button
                type="button"
                onClick={() => setNoticeDismissed(true)}
                className="shrink-0 rounded p-1 text-amber-300/70 transition-colors hover:bg-amber-400/10 hover:text-amber-200"
                title="Ocultar aviso"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Modo escritorio: webview + pantalla de error real
  // ---------------------------------------------------------------------------
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0b0f14]">
      <div ref={containerRef} className="absolute inset-0" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0f14]">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={20} className="animate-spin text-brand-cyan" />
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-500">
              Iniciando motor de navegación
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b0f14]/97 p-8 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12141a] p-8 shadow-2xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
                <AlertTriangle size={18} className="text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">No se pudo cargar la página</h3>
                <p className="font-mono text-[10px] text-gray-500">{error.url || 'dirección desconocida'}</p>
              </div>
            </div>

            <p className="mb-1 font-mono text-[11px] text-gray-400">
              Error {error.code}: {error.description}
            </p>
            <p className="mb-6 text-[11px] leading-relaxed text-gray-500">
              Comprueba tu conexión, la ortografía de la dirección o si el sitio requiere una red privada.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleReload}
                className="flex items-center gap-2 rounded-lg border border-brand-cyan/40 bg-brand-cyan/15 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-cyan transition-colors hover:bg-brand-cyan/25"
              >
                <RefreshCw size={12} /> Reintentar
              </button>
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-colors hover:bg-white/10"
              >
                <ArrowLeft size={12} /> Atrás
              </button>
              <button
                type="button"
                onClick={handleForward}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-colors hover:bg-white/10"
              >
                <ArrowRight size={12} /> Adelante
              </button>
              {error.url && (
                <button
                  type="button"
                  onClick={() => void openExternal(error.url)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-colors hover:bg-white/10"
                >
                  <ExternalLink size={12} /> Abrir en el sistema
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
