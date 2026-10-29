import React, { useState, useEffect } from 'react';
import { 
  Download, 
  CheckCircle2, 
  RefreshCw, 
  Cpu, 
  ShieldCheck, 
  Globe, 
  Zap, 
  Terminal, 
  Layers, 
  HardDrive, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  Activity,
  Info,
  X,
  Code2,
  Monitor
} from 'lucide-react';
import { APP_VERSION, APP_VERSION_LABEL } from '@/src/lib/version';
import { motion, AnimatePresence } from 'motion/react';
import { QuickStats } from './QuickStats';
import { ConnectionStatus } from './ConnectionStatus';
import { ThreatProtection } from './ThreatProtection';
import { AIActivityFeed } from './AIActivityFeed';
import { kernel } from '../kernel/BrowserKernel';
import { downloadServicePlugin } from '../plugins/DownloadServicePlugin';
import { cn } from '@/src/lib/utils';
import { isDesktopApp, openExternal } from '@/src/lib/desktop';

interface DashboardViewProps {
  onNavigate?: (url: string) => void;
  onOpenDownloads?: () => void;
}

export function DashboardView({ onNavigate, onOpenDownloads }: DashboardViewProps) {
  const desktop = isDesktopApp();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'latest'>('idle');
  const [showDesktopInfoModal, setShowDesktopInfoModal] = useState(false);
  const [showGitHubToast, setShowGitHubToast] = useState(false);
  const [activePluginsCount, setActivePluginsCount] = useState(0);
  const [activeTasksCount, setActiveTasksCount] = useState(0);

  useEffect(() => {
    setActivePluginsCount(kernel.listPlugins().length);
    setActiveTasksCount(kernel.runtimeScheduler.getActiveTasks().length);

    const interval = setInterval(() => {
      setActivePluginsCount(kernel.listPlugins().length);
      setActiveTasksCount(kernel.runtimeScheduler.getActiveTasks().length);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDownloadNavegadorX = () => {
    // 1. Mostrar notificación/toast UI indicando 'Próximamente' y redirección a GitHub
    setShowGitHubToast(true);
    setShowDesktopInfoModal(true);

    // 2. Redirigir al repositorio oficial en GitHub en una nueva pestaña
    window.open('https://github.com/cryptojacxas-ship-it/NAVEGADOR-X', '_blank', 'noopener,noreferrer');
  };

  const handleExportSourceBundle = async () => {
    // Genera un manifiesto con lo que el proyecto hace de verdad hoy.
    const host = desktop ? 'Edición de Escritorio (Electron)' : 'Edición Web (navegador)';
    const projectSummary = `# Navegador X - Runtime OS ${APP_VERSION_LABEL}
===================================================
Versión: ${APP_VERSION}
Contenedor: ${host}
Kernel Engine: activo (TypeScript)
Fecha de generación: ${new Date().toISOString()}

Componentes reales:
- Runtime Scheduler cooperativo y EventBus del microkernel
- Inspector de Runtime con telemetría del proceso
- Marcadores y sesiones persistentes (IndexedDB)
- ${desktop ? 'Motor de navegación real (webview) con descargas a disco' : 'Viewport limitado por el navegador (iframe)'}
- Cliente de IA unificado (Gemini si hay clave, motor local si no)

Módulos de demostración (solo interfaz, no funcionales):
- Minería, VPN/Tor y Privacy Shield

Los instaladores se generan con «npm run package:win».
===================================================`;

    const blob = new Blob([projectSummary], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `NavegadorX-${APP_VERSION_LABEL}-Info.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    if (onOpenDownloads) onOpenDownloads();
  };

  /**
   * Todavía no existe un canal de actualizaciones propio: en lugar de simular una
   * comprobación se abre la página de versiones del repositorio, que es la fuente real.
   */
  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true);
    void openExternal('https://github.com/cryptojacxas-ship-it/NAVEGADOR-X/releases');
    setTimeout(() => setIsCheckingUpdate(false), 1200);
  };

  return (
    <div className="grid grid-cols-12 gap-6 p-6 md:p-10 max-w-7xl mx-auto">
      {/* Release & Desktop Edition Banner */}
      <div className="col-span-12 card relative overflow-hidden p-6 md:p-8 border-brand-cyan/30 bg-gradient-to-r from-[#0d131e] via-[#111927] to-[#0a0f18] shadow-[0_0_50px_rgba(0,210,255,0.08)]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-cyan via-brand-magenta to-amber-400" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brand-cyan animate-ping" />
                {desktop ? `Edición Escritorio ${APP_VERSION_LABEL}` : `Edición Web ${APP_VERSION_LABEL}`}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-widest">
                Runtime OS v1.0 Sincronizado
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              Navegador <span className="gradient-text">X</span> ({APP_VERSION_LABEL})
            </h1>

            <p className="text-xs md:text-sm text-gray-400 leading-relaxed font-sans">
              {desktop
                ? 'Motor de navegación real sobre Electron: descargas a disco, sesión persistente, proxy de red configurable y arquitectura de microkernel modular.'
                : 'Cliente web del Runtime OS. Para navegar la web de verdad (Google, YouTube, bancos…) necesitas la Edición de Escritorio, que usa un motor de navegación real.'}
            </p>

            {/* Feature Badges */}
            <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-mono text-gray-400">
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10 flex items-center gap-1">
                <Terminal size={12} className="text-brand-cyan" /> Kernel Scheduler
              </span>
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10 flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-400" /> Anti-Fingerprint
              </span>
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10 flex items-center gap-1">
                <Download size={12} className="text-amber-400" /> Download Turbo
              </span>
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10 flex items-center gap-1">
                <Layers size={12} className="text-brand-magenta" /> {activePluginsCount} Plugins Activos
              </span>
            </div>
          </div>

          {/* Action Buttons & Desktop Edition Information */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={handleDownloadNavegadorX}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-brand-cyan via-blue-500 to-brand-magenta hover:opacity-95 text-black font-extrabold text-xs uppercase tracking-widest shadow-[0_0_25px_rgba(0,210,255,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer group"
            >
              <Monitor size={16} className="group-hover:scale-110 transition-transform text-black" />
              <div className="flex flex-col items-start text-left">
                <span>{desktop ? 'Ya estás en la Edición de Escritorio' : 'Descargar Edición de Escritorio'}</span>
                <span className="text-[9px] font-mono lowercase tracking-normal text-black/80 font-bold">
                  {desktop ? 'instalador y código en el repositorio' : `instalador .exe disponible (${APP_VERSION_LABEL})`}
                </span>
              </div>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href="https://github.com/cryptojacxas-ship-it/NAVEGADOR-X"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Ver Repositorio Oficial en GitHub"
              >
                <ExternalLink size={12} className="text-brand-cyan" />
                <span>GitHub Repo</span>
              </a>

              <button
                type="button"
                onClick={handleExportSourceBundle}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Descargar paquete con información de la versión actual"
              >
                <Code2 size={12} className="text-amber-400" />
                <span>Manifiesto</span>
              </button>

              <button
                type="button"
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate}
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw size={12} className={cn(isCheckingUpdate ? "animate-spin text-brand-cyan" : "")} />
                <span>{isCheckingUpdate ? "Comprobando..." : "Actualizaciones"}</span>
              </button>

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('runtime://kernel')}
                  className="px-3.5 py-2 rounded-lg bg-brand-cyan/10 hover:bg-brand-cyan/20 border border-brand-cyan/30 text-brand-cyan text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <Terminal size={12} />
                  <span>Kernel OS</span>
                </button>
              )}
            </div>

            {updateStatus === 'latest' && (
              <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} /> Se han abierto las versiones publicadas en GitHub
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification: Redirección GitHub & Próximamente */}
      <AnimatePresence>
        {showGitHubToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 max-w-md bg-[#121824] border border-brand-cyan/50 rounded-xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-start gap-3 text-xs"
          >
            <Info size={18} className="text-brand-cyan shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="font-bold text-white flex items-center justify-between">
                Edición de Escritorio
                <span className="text-[10px] font-mono text-brand-cyan bg-brand-cyan/10 px-2 py-0.5 rounded border border-brand-cyan/30">{APP_VERSION_LABEL}</span>
              </h4>
              <p className="text-gray-300 leading-relaxed">
                {desktop
                  ? 'Estás ejecutando la Edición de Escritorio: motor de navegación real, descargas a disco y sesión persistente. Abrimos el repositorio por si quieres revisar el código o publicar una versión.'
                  : 'El instalador .exe se compila desde el repositorio con «npm run package:win». Abrimos GitHub para que puedas clonarlo o descargar la última versión.'}
              </p>
              <a
                href="https://github.com/cryptojacxas-ship-it/NAVEGADOR-X"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-brand-cyan hover:underline font-mono text-[11px] pt-1 font-bold"
              >
                <span>Ver Repositorio en GitHub</span>
                <ExternalLink size={12} />
              </a>
            </div>
            <button
              type="button"
              onClick={() => setShowGitHubToast(false)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Informativo: Edición de Escritorio */}
      <AnimatePresence>
        {showDesktopInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-[#121824] border border-brand-cyan/40 rounded-2xl p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 text-brand-cyan">
                  <Monitor size={20} />
                  <h3 className="font-extrabold text-white text-base">Edición de Escritorio Nativa</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDesktopInfoModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-gray-300 leading-relaxed font-sans max-h-[60vh] overflow-y-auto pr-1">
                <p>
                  <strong className="text-white">X Browser</strong> opera como cliente sobre el motor <strong className="text-brand-cyan">X Runtime OS</strong>. La versión actual (<strong className="text-white">{APP_VERSION_LABEL}</strong>) añade mejoras de interfaz y accesibilidad, endurecimiento del servidor web y publicación verificada desde la etiqueta, sobre la pila de red nativa del contenedor de escritorio.
                </p>

                {/* Status & Roadmap Timeline Matrix */}
                <div className="bg-[#0b0d12] border border-white/10 rounded-xl p-3.5 space-y-3 font-mono text-[11px]">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2 text-amber-400 font-bold">
                    <span className="flex items-center gap-2">
                      <Info size={14} /> Hoja de Ruta de Lanzamientos
                    </span>
                    <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-emerald-400 font-bold">
                      Estado: {APP_VERSION_LABEL}
                    </span>
                  </div>

                  <div className="space-y-3 text-[10px]">
                    {/* v0.1.0-alpha */}
                    <div className="border-l-2 border-emerald-400 pl-2.5 space-y-1">
                      <div className="flex items-center justify-between text-emerald-400 font-bold">
                        <span>v0.1.0-alpha — X Runtime OS Web Edition</span>
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded">Completado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-400 text-[9.5px]">
                        <span>✓ X Browser UI & Pestañas IDB</span>
                        <span>✓ Kernel & Task Scheduler</span>
                        <span>✓ Provider & Capability System</span>
                        <span>✓ Runtime Inspector</span>
                      </div>
                    </div>

                    {/* v0.2.0-alpha */}
                    <div className="border-l-2 border-emerald-400 pl-2.5 space-y-1">
                      <div className="flex items-center justify-between text-emerald-400 font-bold">
                        <span>v0.2.0-alpha — Desktop Runtime</span>
                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded">Completado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-400 text-[9.5px]">
                        <span>✓ Shell Electron & Ventana nativa</span>
                        <span>✓ Motor de navegación real (webview)</span>
                        <span>✓ Descargas reales a disco</span>
                        <span>✓ Sesión persistente y aislamiento</span>
                      </div>
                    </div>

                    {/* v0.3.0-alpha */}
                    <div className="border-l-2 border-amber-400 pl-2.5 space-y-1">
                      <div className="flex items-center justify-between text-amber-400 font-bold">
                        <span>v0.3.0-alpha — Stack de Red Nativo</span>
                        <span className="text-[9px] bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 rounded">Parcial</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-400 text-[9.5px]">
                        <span>✓ Proxy SOCKS5 / HTTP por sesión</span>
                        <span>✓ Autenticación y prueba real</span>
                        <span>□ Enrutado por pestaña</span>
                        <span>□ Reglas por destino</span>
                      </div>
                    </div>

                    {/* v0.4.0-alpha */}
                    <div className="border-l-2 border-gray-600 pl-2.5 space-y-1">
                      <div className="flex items-center justify-between text-gray-300 font-bold">
                        <span>v0.4.0-alpha — Integración Tor</span>
                        <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.2 rounded text-gray-400">Planificado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-500 text-[9.5px]">
                        <span>□ Integración de Red Tor</span>
                        <span>□ Aislamiento de Circuitos</span>
                      </div>
                    </div>

                    {/* v0.5.0-beta */}
                    <div className="border-l-2 border-gray-600 pl-2.5 space-y-1">
                      <div className="flex items-center justify-between text-gray-300 font-bold">
                        <span>v0.5.0-beta — Browser Connectors</span>
                        <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.2 rounded text-gray-400">Planificado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-500 text-[9.5px]">
                        <span>□ Conectores Chrome / Edge / Firefox</span>
                        <span>□ Sync Multi-Navegador</span>
                      </div>
                    </div>

                    {/* v1.0 */}
                    <div className="border-l-2 border-purple-500 pl-2.5 space-y-1">
                      <div className="flex items-center justify-between text-purple-300 font-bold">
                        <span>v1.0 — Knowledge Browser</span>
                        <span className="text-[9px] bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.2 rounded text-purple-300">Lanzamiento Final</span>
                      </div>
                      <div className="text-gray-500 text-[9.5px]">
                        <span>□ Motor de Navegación de Conocimiento Autónomo</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-gray-400 text-[11px]">
                  El repositorio oficial etiquetará la primera versión bajo <strong className="text-white">v0.1.0-alpha</strong> documentando claramente que las capacidades de red nativa vendrán con la transición a la versión de escritorio.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
                <a
                  href="https://github.com/cryptojacxas-ship-it/NAVEGADOR-X"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan hover:bg-brand-cyan/30 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ExternalLink size={14} /> Ir a GitHub
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setShowDesktopInfoModal(false);
                    handleExportSourceBundle();
                  }}
                  className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} /> Manifiesto
                </button>
                <button
                  type="button"
                  onClick={() => setShowDesktopInfoModal(false)}
                  className="px-5 py-2 rounded-lg bg-brand-cyan text-black text-xs font-extrabold uppercase tracking-wider hover:opacity-90 transition-all cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Left Column: 2/3 width */}
      <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
        <QuickStats />
        <div className="h-[460px]">
          <AIActivityFeed />
        </div>
      </div>

      {/* Right Column: 1/3 width */}
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
        <ConnectionStatus />
        <ThreatProtection />
      </div>
    </div>
  );
}

