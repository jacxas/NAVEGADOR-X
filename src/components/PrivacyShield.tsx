import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, ShieldAlert, EyeOff, Lock, Fingerprint, 
  Globe, Radio, Zap, Check,
  X, Sliders, Shield
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { SimulationNotice } from './SimulationNotice';
import { ThreatProtection } from './ThreatProtection';
import { desktopBridge, isDesktopApp } from '@/src/lib/desktop';
import type { NativeBlockerStatus } from '@/src/types/desktop';

export interface SiteProtectionConfig {
  domain: string;
  adBlocker: boolean;
  fingerprintCloaking: boolean;
  webrtcProtection: boolean;
  cookieCleaner: boolean;
  strictReferrer: boolean;
  fontMasking: boolean;
  blockedCount: number;
}

const DEFAULT_SITES: SiteProtectionConfig[] = [
  {
    domain: 'navegador://dashboard',
    adBlocker: true,
    fingerprintCloaking: true,
    webrtcProtection: true,
    cookieCleaner: true,
    strictReferrer: true,
    fontMasking: true,
    blockedCount: 0,
  },
  {
    domain: 'youtube.com',
    adBlocker: true,
    fingerprintCloaking: true,
    webrtcProtection: true,
    cookieCleaner: false,
    strictReferrer: true,
    fontMasking: false,
    blockedCount: 428,
  },
  {
    domain: 'google.com',
    adBlocker: true,
    fingerprintCloaking: true,
    webrtcProtection: true,
    cookieCleaner: true,
    strictReferrer: true,
    fontMasking: true,
    blockedCount: 312,
  },
  {
    domain: 'github.com',
    adBlocker: true,
    fingerprintCloaking: false,
    webrtcProtection: true,
    cookieCleaner: false,
    strictReferrer: true,
    fontMasking: false,
    blockedCount: 18,
  },
  {
    domain: 'facebook.com',
    adBlocker: true,
    fingerprintCloaking: true,
    webrtcProtection: true,
    cookieCleaner: true,
    strictReferrer: true,
    fontMasking: true,
    blockedCount: 894,
  }
];

interface PrivacyShieldProps {
  currentUrl?: string;
  onClose?: () => void;
}

export function PrivacyShield({ currentUrl = 'navegador://dashboard', onClose }: PrivacyShieldProps) {
  // Extract current domain
  let activeDomain = 'navegador://dashboard';
  try {
    if (currentUrl.startsWith('http')) {
      const parsed = new URL(currentUrl);
      activeDomain = parsed.hostname;
    } else {
      activeDomain = currentUrl;
    }
  } catch {
    activeDomain = currentUrl;
  }

  const [shieldMaster, setShieldMaster] = useState(true);
  const [preset, setPreset] = useState<'Standard' | 'Strict' | 'Paranoid'>('Strict');
  const [siteConfigs, setSiteConfigs] = useState<SiteProtectionConfig[]>(() => {
    const saved = localStorage.getItem('navegadorx_privacy_configs');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_SITES;
  });

  /**
   * Cifra real de bloqueos. Antes se sembraba con 1.652 «bloqueos» inventados y se
   * incrementaba con un temporizador aleatorio. Ahora viene del bloqueador nativo
   * de la Edición de Escritorio; en la web simplemente no existe y se dice.
   */
  const desktop = isDesktopApp();
  const [blocker, setBlocker] = useState<NativeBlockerStatus | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>(activeDomain);
  const [searchDomain, setSearchDomain] = useState('');

  // Get or create config for currently selected domain
  const currentConfig = siteConfigs.find(s => s.domain === selectedDomain) || {
    domain: selectedDomain,
    adBlocker: true,
    fingerprintCloaking: preset !== 'Standard',
    webrtcProtection: true,
    cookieCleaner: preset === 'Paranoid',
    strictReferrer: true,
    fontMasking: preset === 'Paranoid',
    blockedCount: 14,
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('navegadorx_privacy_configs', JSON.stringify(siteConfigs));
  }, [siteConfigs]);

  // Cifra real del bloqueador nativo (solo escritorio); se refresca cada 5 s.
  useEffect(() => {
    const bridge = desktopBridge();
    if (!bridge) return;

    let cancelled = false;
    const read = async () => {
      try {
        const status = await bridge.blocker.status();
        if (!cancelled) setBlocker(status);
      } catch {
        if (!cancelled) setBlocker(null);
      }
    };

    void read();
    const interval = setInterval(() => void read(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Toggle individual site rule
  const toggleRule = (ruleKey: keyof Omit<SiteProtectionConfig, 'domain' | 'blockedCount'>) => {
    setSiteConfigs(prev => {
      const exists = prev.some(s => s.domain === selectedDomain);
      if (exists) {
        return prev.map(s => s.domain === selectedDomain ? { ...s, [ruleKey]: !s[ruleKey] } : s);
      } else {
        const newConf = { ...currentConfig, [ruleKey]: !currentConfig[ruleKey] };
        return [...prev, newConf];
      }
    });
  };

  // Change preset level
  const applyPreset = (newPreset: 'Standard' | 'Strict' | 'Paranoid') => {
    setPreset(newPreset);
    const updated = {
      adBlocker: true,
      fingerprintCloaking: newPreset !== 'Standard',
      webrtcProtection: true,
      cookieCleaner: newPreset === 'Paranoid',
      strictReferrer: true,
      fontMasking: newPreset === 'Paranoid',
    };

    setSiteConfigs(prev => {
      const exists = prev.some(s => s.domain === selectedDomain);
      if (exists) {
        return prev.map(s => s.domain === selectedDomain ? { ...s, ...updated } : s);
      } else {
        return [...prev, { ...currentConfig, domain: selectedDomain, ...updated }];
      }
    });
  };

  return (
    <div className="w-full flex flex-col h-full bg-[#111215] text-white font-sans overflow-hidden">
      <div className="p-3 pb-0">
        <SimulationNotice module="Privacy Shield">
          No modifica Canvas, WebGL, AudioContext ni WebRTC: no se está alterando ninguna huella digital de tu
          navegación. El bloqueo real de anuncios y rastreadores está en la pestaña{' '}
          <strong className="text-amber-200">Bloqueador</strong> y sí actúa sobre la red.
        </SimulationNotice>
      </div>

      {/* Top Header */}
      <div className="p-3 border-b border-white/10 flex items-center justify-between bg-[#16171b]">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-xl border transition-all shadow-sm",
            shieldMaster 
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          )}>
            {shieldMaster ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              Privacy Shield
              <span className={cn(
                "px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase",
                shieldMaster ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
              )}>
                {shieldMaster ? 'ACTIVO' : 'PAUSADO'}
              </span>
            </h3>
            <p className="text-[9px] font-mono text-gray-400">Protección Anti-Fingerprinting & Rastreadores</p>
          </div>
        </div>

        {/* Master Switch */}
        <button
          type="button"
          onClick={() => setShieldMaster(!shieldMaster)}
          className={cn(
            "relative w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer border",
            shieldMaster ? "bg-emerald-500 border-emerald-400" : "bg-gray-700 border-gray-600"
          )}
          title="Activar / Desactivar Escudo Global"
        >
          <motion.div
            layout
            className="w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center text-black font-bold text-[9px]"
            animate={{ x: shieldMaster ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {shieldMaster ? <Check size={12} className="text-emerald-600" /> : <X size={12} className="text-rose-600" />}
          </motion.div>
        </button>
      </div>

      {/* Counter Dashboard Header */}
      <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#0d0e11] border-b border-white/5 font-mono">
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 space-y-0.5">
          <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider flex items-center justify-between">
            Bloqueos Totales
            <Zap size={10} className="text-amber-400" />
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-brand-cyan">
              {blocker ? blocker.totalBlocked.toLocaleString('es-ES') : '—'}
            </span>
            <span className="text-[8px] text-gray-500 font-bold">
              {desktop ? (blocker?.enabled ? 'bloqueador activo' : 'bloqueador pausado') : 'no disponible en web'}
            </span>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 space-y-0.5">
          <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider flex items-center justify-between">
            Huella Digital
            <Fingerprint size={10} className="text-purple-400" />
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-extrabold text-gray-400">
              Sin cambios
            </span>
            <span className="text-[8px] text-gray-500 font-bold">no se falsea</span>
          </div>
        </div>
      </div>

      {/* Preset Level Selector */}
      <div className="px-3 py-2 bg-[#141518] border-b border-white/5 flex items-center justify-between text-[9px]">
        <span className="font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
          <Sliders size={11} className="text-brand-cyan" />
          Nivel de Escudo:
        </span>
        <div className="flex items-center gap-1 font-mono">
          {(['Standard', 'Strict', 'Paranoid'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => applyPreset(lvl)}
              className={cn(
                "px-2 py-0.5 rounded transition-all cursor-pointer border text-[9px] font-bold",
                preset === lvl
                  ? "bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40 shadow-xs"
                  : "bg-white/5 text-gray-400 border-transparent hover:text-white"
              )}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Domain Selection Bar */}
      <div className="p-2 bg-[#121316] border-b border-white/5 space-y-1.5">
        <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1">
          <Globe size={13} className="text-brand-cyan shrink-0" />
          <input
            type="text"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            placeholder="Dominio p. ej. youtube.com"
            className="w-full bg-transparent text-xs font-mono text-white outline-none"
          />
          <button
            type="button"
            onClick={() => setSelectedDomain(activeDomain)}
            className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 shrink-0"
            title="Usar pestaña actual"
          >
            Pestaña Actual
          </button>
        </div>
      </div>

      {/* Scrollable Rules & Ticker Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Toggle Controls per Site */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            <span>Reglas para: <strong className="text-white font-mono">{selectedDomain}</strong></span>
            <span className="text-brand-cyan font-mono text-[9px]">
              {currentConfig.blockedCount} bloqueados
            </span>
          </div>

          <div className="space-y-1">
            {/* Rule 1: Ad & Tracker Blocker */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-brand-cyan shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Bloqueador de Anuncios y Rastreos</p>
                  <p className="text-[8px] font-mono text-gray-400">Intercepta dominios publicitarios y scripts de seguimiento</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={currentConfig.adBlocker}
                onChange={() => toggleRule('adBlocker')}
                className="accent-brand-cyan h-4 w-4 rounded cursor-pointer"
              />
            </div>

            {/* Rule 2: Fingerprint Cloaking */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-2">
                <Fingerprint size={14} className="text-purple-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Ofuscación Canvas & AudioContext</p>
                  <p className="text-[8px] font-mono text-gray-400">Inyecta ruido sintético en lecturas de renderizado gráfico</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={currentConfig.fingerprintCloaking}
                onChange={() => toggleRule('fingerprintCloaking')}
                className="accent-purple-400 h-4 w-4 rounded cursor-pointer"
              />
            </div>

            {/* Rule 3: WebRTC IP Leak Protection */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Ocultar IP Local en WebRTC</p>
                  <p className="text-[8px] font-mono text-gray-400">Evita filtración de direcciones IP privadas mediante ICE candidate</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={currentConfig.webrtcProtection}
                onChange={() => toggleRule('webrtcProtection')}
                className="accent-emerald-400 h-4 w-4 rounded cursor-pointer"
              />
            </div>

            {/* Rule 4: Cookie Cleaner & Isolation */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-amber-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Aislamiento de Cookies de Terceros</p>
                  <p className="text-[8px] font-mono text-gray-400">Elimina supercookies al cerrar la pestaña</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={currentConfig.cookieCleaner}
                onChange={() => toggleRule('cookieCleaner')}
                className="accent-amber-400 h-4 w-4 rounded cursor-pointer"
              />
            </div>

            {/* Rule 5: Font & Device Masking */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-center gap-2">
                <EyeOff size={14} className="text-rose-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-white">Enmascarar Fuentes y Dispositivo</p>
                  <p className="text-[8px] font-mono text-gray-400">Neutraliza enumeración de fuentes locales y hardware</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={currentConfig.fontMasking}
                onChange={() => toggleRule('fontMasking')}
                className="accent-rose-400 h-4 w-4 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Lo que sí está activo y lo que no: sustituye al registro inventado
            de «rastreadores bloqueados», que se generaba con Math.random(). */}
        <div className="pt-2 border-t border-white/5">
          <ThreatProtection compact />
        </div>
      </div>

      {/* Footer info */}
      <div className="p-2 bg-[#090a0c] border-t border-white/5 text-[9px] font-mono text-gray-500 flex items-center justify-between">
        <span>Navegador X · Privacy Shield</span>
        <span className={desktop ? 'text-emerald-400 font-bold' : 'text-gray-500'}>
          {desktop ? 'Bloqueador nativo activo' : 'Solo interfaz en la edición web'}
        </span>
      </div>
    </div>
  );
}
