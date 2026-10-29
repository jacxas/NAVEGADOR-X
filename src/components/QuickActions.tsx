/**
 * QuickActions — la portada útil del dashboard.
 *
 * Antes esta columna repetía los paneles de «Conexión de red» y «Protecciones»
 * que ya existen en sus propias pestañas (VPN X y Privacy Shield), y ambos son
 * demostraciones: el dashboard acababa pareciendo el navegador y prometiendo cosas
 * que no hace. Aquí solo hay accesos que funcionan y un resumen del estado real.
 */

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Download,
  Globe,
  LayoutGrid,
  Monitor,
  ShieldCheck,
  Star,
  Terminal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { desktopBridge, isDesktopApp } from '@/src/lib/desktop';
import { APP_VERSION_LABEL } from '@/src/lib/version';

interface QuickActionsProps {
  onNavigate?: (url: string) => void;
  onOpenDownloads?: () => void;
}

type AiState = 'checking' | 'configured' | 'local';

/** ¿Hay clave de IA configurada? En escritorio lo sabe el proceso principal; en la
 *  edición web, el propio servidor (`/api/v1/ai/status`). Sin respuesta se asume local. */
function useAiState(): AiState {
  const [state, setState] = useState<AiState>('checking');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const bridge = desktopBridge();
      if (bridge) {
        try {
          const hasKey = await bridge.ai.hasKey();
          if (!cancelled) setState(hasKey ? 'configured' : 'local');
        } catch {
          if (!cancelled) setState('local');
        }
        return;
      }

      try {
        const response = await fetch('/api/v1/ai/status');
        const data = (await response.json()) as { configured?: boolean };
        if (!cancelled) setState(data.configured ? 'configured' : 'local');
      } catch {
        // Sin servidor (sitio estático) el motor es siempre el local.
        if (!cancelled) setState('local');
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function QuickActions({ onNavigate, onOpenDownloads }: QuickActionsProps) {
  const desktop = isDesktopApp();
  const aiState = useAiState();

  const actions = [
    { label: 'Navegar', detail: 'Barra de direcciones', icon: Globe, onClick: () => onNavigate?.('navegador://inicio') },
    { label: 'Favoritos', detail: 'Guardados en este equipo', icon: Star, onClick: () => onNavigate?.('navegador://favoritos') },
    { label: 'Descargas', detail: desktop ? 'Se guardan en disco' : 'Panel de descargas', icon: Download, onClick: () => onOpenDownloads?.() },
    { label: 'IA X', detail: aiState === 'configured' ? 'Con modelo en línea' : 'Motor local', icon: Bot, onClick: () => onNavigate?.('navegador://ia') },
    { label: 'Runtime', detail: 'Inspector del kernel', icon: Terminal, onClick: () => onNavigate?.('runtime://kernel') },
    { label: 'Bloqueador', detail: 'Filtrado de red', icon: LayoutGrid, onClick: () => onNavigate?.('navegador://bloqueador') },
  ];

  const rows: Array<{ label: string; value: string; ok: boolean }> = [
    { label: 'Edición', value: desktop ? 'Escritorio (Electron)' : 'Web (navegador)', ok: true },
    { label: 'Versión', value: APP_VERSION_LABEL, ok: true },
    {
      label: 'Motor de navegación',
      value: desktop ? 'Webview real' : 'Iframe limitado por X-Frame-Options',
      ok: desktop,
    },
    {
      label: 'IA',
      value:
        aiState === 'checking'
          ? 'Comprobando…'
          : aiState === 'configured'
            ? 'Modelo en línea configurado'
            : 'Motor local (sin clave)',
      ok: aiState === 'configured',
    },
    { label: 'Sesión', value: desktop ? 'Persistente en disco' : 'IndexedDB de este navegador', ok: true },
  ];

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="panel-header mb-0">Empezar</h2>
        <span className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-gray-400">
          <ShieldCheck size={10} /> Accesos reales
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="group flex items-start gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition-colors hover:border-brand-cyan/30 hover:bg-brand-cyan/5"
            >
              <Icon size={16} className="mt-0.5 shrink-0 text-brand-cyan" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-white">{action.label}</span>
                <span className="block truncate text-[9px] font-mono text-gray-500">{action.detail}</span>
              </span>
              <ArrowRight
                size={12}
                className="ml-auto mt-1 shrink-0 text-gray-600 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-cyan"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <h3 className="mt-6 mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
        Estado real
      </h3>
      <dl className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-[10px]">
            <dt className="text-gray-500">{row.label}</dt>
            <dd
              className={cn(
                'flex min-w-0 items-center gap-1.5 truncate font-mono',
                row.ok ? 'text-gray-300' : 'text-amber-400/90',
              )}
            >
              {row.ok ? (
                <Wifi size={10} className="shrink-0 text-emerald-400" aria-hidden="true" />
              ) : (
                <WifiOff size={10} className="shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">{row.value}</span>
            </dd>
          </div>
        ))}
      </dl>

      {!desktop && (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-2.5 text-[10px] leading-relaxed text-amber-100/85">
          <Monitor size={12} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
          <span>
            En el navegador solo se pueden incrustar sitios que lo permitan. La Edición de Escritorio
            abre cualquier web con un motor real.
          </span>
        </p>
      )}
    </div>
  );
}
