/**
 * BrowserMaskedPage — marco de navegación de Navegador X.
 *
 * Antes era una "máscara" decorativa sobre un iframe. Ahora es el marco real de
 * navegación: barra de herramientas con controles funcionales, el viewport real
 * (`BrowserViewport`) y una barra de estado con datos verdaderos.
 *
 * Los controles de navegación se envían al viewport por el EventBus del kernel
 * (`viewport.command`), y el estado llega de vuelta por `viewport.state` /
 * `viewport.loadend`, de modo que no hay acoplamiento directo entre componentes.
 */

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Shield,
  Zap,
  Activity,
  Globe,
  Download,
  Lock,
  X,
  AlertCircle,
  MonitorDown,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './../lib/utils';
import { BookmarkButton } from './BookmarkButton';
import { BrowserViewport, type PwaInfo } from './BrowserViewport';
import { kernel } from '@/src/kernel/BrowserKernel';
import { desktopBridge, isDesktopApp, openExternal } from '@/src/lib/desktop';

interface BrowserMaskedPageProps {
  url?: string;
  /** Partición de sesión del viewport (compartida o dedicada a esta pestaña). */
  partition?: string;
  onExit?: () => void;
}

interface ViewportState {
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

const REPOSITORY_URL = 'https://github.com/cryptojacxas-ship-it/NAVEGADOR-X';

export function BrowserMaskedPage({ url = 'https://example.com', partition, onExit }: BrowserMaskedPageProps) {
  const desktop = isDesktopApp();
  const [state, setState] = useState<ViewportState>({
    url,
    title: '',
    loading: false,
    canGoBack: false,
    canGoForward: false,
  });
  const [loadMs, setLoadMs] = useState<number | null>(null);
  // Cerrado por defecto: el panel tapa la página y este navegador es para navegar.
  const [statsOpen, setStatsOpen] = useState(false);
  /** PWA detectada en la página actual y estado de su instalación. */
  const [pwa, setPwa] = useState<PwaInfo | null>(null);
  const [pwaState, setPwaState] = useState<'idle' | 'installing' | 'installed' | 'error'>('idle');

  // Al cambiar de sitio se resetea la detección: cada página declara lo suyo.
  useEffect(() => {
    setPwa(null);
    setPwaState('idle');
  }, [url]);

  const installPwa = async () => {
    if (!pwa || pwaState === 'installing') return;
    setPwaState('installing');
    try {
      const result = await desktopBridge()?.pwa.install({
        url: pwa.url,
        name: pwa.name,
        icon: pwa.icon,
        color: pwa.color,
      });
      setPwaState(result?.ok ? 'installed' : 'error');
    } catch {
      setPwaState('error');
    }
  };

  useEffect(() => {
    const unsubscribeState = kernel.eventBus.subscribe('viewport.state', (event) => {
      const payload = event.payload as ViewportState;
      setState((previous) => ({ ...previous, ...payload }));
    });
    const unsubscribeLoad = kernel.eventBus.subscribe('viewport.loadend', (event) => {
      const payload = event.payload as { durationMs: number };
      setLoadMs(payload?.durationMs ?? null);
    });
    return () => {
      unsubscribeState();
      unsubscribeLoad();
    };
  }, []);

  const host = (() => {
    try {
      return new URL(state.url).host;
    } catch {
      return state.url;
    }
  })();

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#0b0f14]">
      {/* Barra de herramientas del navegador */}
      <header className="flex shrink-0 items-center gap-2 border-b border-white/5 bg-[#0b0f14]/95 px-3 py-1.5 backdrop-blur-md">
        <button
          type="button"
          onClick={onExit}
          aria-label="Volver al panel de control"
          className="cursor-pointer rounded-lg bg-white/5 px-2 py-1 text-gray-400 ring-1 ring-white/5 transition-all hover:bg-white/10 hover:text-white"
          title="Volver al panel de control"
        >
          <ArrowLeft size={14} />
        </button>

        {/* Barra de dirección */}
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-[#15171c] px-3 py-1">
          {state.url.startsWith('https://') ? (
            <Lock size={11} className="shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle size={11} className="shrink-0 text-amber-400" />
          )}
          <span className="truncate font-mono text-[11px] text-gray-300" title={state.url}>
            {host}
          </span>
          {state.title && (
            <>
              <span className="text-gray-700">•</span>
              <span className="truncate text-[10px] text-gray-500">{state.title}</span>
            </>
          )}

          {!desktop && (
            <span
              className="ml-auto shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400"
              title="Motor limitado: el navegador solo permite incrustar sitios que no lo bloqueen"
            >
              Modo limitado
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatsOpen(!statsOpen)}
            aria-label="Panel de actividad de la página"
            aria-expanded={statsOpen}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              statsOpen ? 'bg-brand-cyan/15 text-brand-cyan' : 'text-gray-400 hover:bg-white/10',
            )}
            title="Panel de actividad"
          >
            <Activity size={15} />
          </button>

          <BookmarkButton url={state.url} title={state.title || host} category="Navegación" size="sm" variant="icon" />

          {desktop && pwa && (
            <button
              type="button"
              onClick={() => void installPwa()}
              disabled={pwaState === 'installing'}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                pwaState === 'installed'
                  ? 'cursor-default text-emerald-400'
                  : pwaState === 'error'
                    ? 'text-rose-400'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white',
              )}
              title={
                pwaState === 'installed'
                  ? `${pwa.name} instalada: acceso directo creado en el Escritorio`
                  : pwaState === 'error'
                    ? 'No se pudo crear el acceso directo'
                    : `Instalar ${pwa.name} como aplicación (acceso directo + ventana propia)`
              }
            >
              {pwaState === 'installed' ? <Check size={15} /> : <MonitorDown size={15} />}
            </button>
          )}

          {!desktop && (
            <button
              type="button"
              onClick={() => void openExternal(REPOSITORY_URL)}
              className="group relative flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-black shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:bg-brand-cyan"
              title="Descargar la Edición de Escritorio desde el repositorio"
            >
              <Download size={13} />
              DESCARGAR
            </button>
          )}
        </div>
      </header>

      {/* Área de contenido real */}
      <div className="relative min-h-0 flex-1">
        <BrowserViewport url={url} partition={partition} onPwaDetected={setPwa} />

        <AnimatePresence>
          {statsOpen && (
            <motion.div
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 40, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-none absolute right-4 top-4 z-20 w-64 space-y-3"
            >
              <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[#0b0f14]/95 p-4 shadow-2xl backdrop-blur-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity size={13} className="text-brand-cyan" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white">Sesión actual</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatsOpen(false)}
                    className="cursor-pointer text-gray-500 transition-colors hover:text-white"
                    title="Ocultar panel"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <StatRow label="Host" value={host} mono />
                  <StatRow label="Esquema" value={state.url.startsWith('https://') ? 'HTTPS · TLS' : 'HTTP sin cifrar'} />
                  <StatRow label="Última carga" value={loadMs !== null ? `${loadMs} ms` : 'Sin medición'} mono />
                  <StatRow
                    label="Historial"
                    value={state.canGoBack || state.canGoForward ? 'Con entradas' : 'Sin entradas'}
                  />
                  <StatRow label="Sesión" value={desktop ? 'Persistente en disco' : 'Solo esta pestaña'} />
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                  <Shield size={11} className="text-brand-cyan" />
                  <span className="text-[9px] leading-tight text-gray-500">
                    El proxy del panel «Red y proxy» sí modifica tu conexión real; los nodos VPN, la minería y el
                    anti-fingerprinting son demostraciones de interfaz.
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Barra de estado */}
      <footer className="flex shrink-0 items-center justify-between border-t border-white/5 bg-[#0b0f14]/95 px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400/80">
            <span className={cn('h-1.5 w-1.5 rounded-full', state.loading ? 'animate-pulse bg-amber-400' : 'bg-emerald-400')} />
            {state.loading ? 'Cargando' : 'Listo'}
          </span>
          <span className="h-3 w-px bg-white/5" />
          <span className="flex items-center gap-1.5">
            <Globe size={10} />
            {desktop ? 'Electron · proceso aislado por webview' : 'Iframe restringido por el navegador'}
          </span>
          {!desktop && (
            <>
              <span className="h-3 w-px bg-white/5" />
              <span className="flex items-center gap-1 text-amber-400/80">
                <Zap size={10} />
                Muchos sitios no cargarán: instala la Edición de Escritorio
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>{desktop ? 'Sandbox activo' : 'Sandbox del navegador'}</span>
        </div>
      </footer>
    </div>
  );
}

function StatRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9px] uppercase tracking-widest text-gray-500">{label}</span>
      <span className={cn('truncate text-[10px] text-gray-300', mono && 'font-mono')} title={value}>
        {value}
      </span>
    </div>
  );
}
