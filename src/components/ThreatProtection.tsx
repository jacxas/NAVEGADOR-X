/**
 * ThreatProtection — protecciones reales frente a las inventadas.
 *
 * Antes anunciaba "12 scripts maliciosos bloqueados" y "45 rastreadores filtrados"
 * sin que existiera ningún motor detrás. Esa clase de cifras dan una falsa sensación
 * de seguridad, así que aquí solo se enumeran las protecciones que sí están activas,
 * y se dice explícitamente lo que la aplicación *no* hace.
 */

import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { isDesktopApp } from '@/src/lib/desktop';

interface ThreatProtectionProps {
  /** Sin tarjeta ni márgenes: para incrustarlo dentro de un panel existente. */
  compact?: boolean;
}

export function ThreatProtection({ compact = false }: ThreatProtectionProps = {}) {
  const desktop = isDesktopApp();

  const protections = [
    {
      label: 'Aislamiento de contenido',
      detail: desktop ? 'Webview en proceso separado' : 'Iframe aislado por el navegador',
      active: true,
    },
    {
      label: 'Permisos de sitio',
      detail: 'Cámara, micrófono y ubicación denegados por defecto',
      active: true,
    },
    {
      label: 'Política de seguridad de contenido',
      detail: "CSP activa, sin 'unsafe-eval'",
      active: true,
    },
    {
      label: 'Carga de extensiones de terceros',
      detail: 'No permitida en la interfaz',
      active: true,
    },
  ];

  const notImplemented = [
    'Filtrado de anuncios y rastreadores',
    'Análisis antivirus de descargas',
    'Bloqueo de phishing por listas negras',
    'Inspección de tráfico TLS',
  ];

  return (
    <div className={compact ? '' : 'card p-8'}>
      <div className={compact ? 'mb-2 flex items-center justify-between' : 'mb-6 flex items-center justify-between'}>
        <h2 className={compact ? 'panel-header mb-0' : 'panel-header'}>Protecciones activas</h2>
        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-emerald-400">
          Verificado
        </span>
      </div>

      <div className={compact ? 'space-y-1.5' : 'space-y-3'}>
        {protections.map((item) => (
          <div key={item.label} className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-gray-300">{item.label}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-gray-600">{item.detail}</span>
            </div>
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-400" />
          </div>
        ))}
      </div>

      <div className={compact ? 'mt-3 border-t border-white/5 pt-3' : 'mt-6 border-t border-white/5 pt-5'}>
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert size={12} className="text-amber-400" />
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-amber-400">
            No incluido en esta versión
          </span>
        </div>
        <div className="space-y-2">
          {notImplemented.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <XCircle size={12} className="shrink-0 text-gray-600" />
              <span className="text-[10px] text-gray-600">{item}</span>
            </div>
          ))}
        </div>
        {!compact && (
          <p className="mt-3 text-[9.5px] leading-relaxed text-gray-600">
            El módulo <span className="text-gray-500">Privacy Shield</span> del menú lateral simula la intercepción de
            Canvas, WebGL y WebRTC únicamente con fines de demostración visual.
          </p>
        )}
      </div>
    </div>
  );
}
