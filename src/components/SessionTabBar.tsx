import React, { useRef } from 'react';
import { Plus, X, Globe, LayoutGrid, Terminal, Shield, Cpu, Sparkles, ShoppingBag, ShieldCheck, Database } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { TabSessionItem } from '../lib/sessionPersistenceService';

interface SessionTabBarProps {
  openTabs: TabSessionItem[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  isSessionSaved: boolean;
}

/** Panel que controlan las pestañas (el contenedor de contenido de `App`). */
const TABPANEL_ID = 'navx-tabpanel';

export function SessionTabBar({
  openTabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  isSessionSaved
}: SessionTabBarProps) {
  const tabRefs = useRef<Array<HTMLDivElement | null>>([]);

  const getTabIcon = (tabType: string) => {
    switch (tabType) {
      case 'dashboard': return LayoutGrid;
      case 'home': return Globe;
      case 'runtime': return Terminal;
      case 'vpn': return Shield;
      case 'miner': return Cpu;
      case 'ai': return Sparkles;
      case 'marketplace': return ShoppingBag;
      case 'admin': return ShieldCheck;
      default: return Globe;
    }
  };

  const tabTitle = (tab: TabSessionItem) => tab.title || tab.url;

  /** Enfoca una pestaña por índice y la activa (como un navegador de escritorio). */
  const focusTabAt = (index: number) => {
    const target = openTabs[index];
    if (!target) return;
    onSelectTab(target.id);
    const element = tabRefs.current[index];
    element?.focus();
    element?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const closeTabAt = (index: number) => {
    const target = openTabs[index];
    if (!target) return;
    onCloseTab(target.id);
    // El elemento desaparece al re-renderizar: se devuelve el foco al vecino.
    const nextIndex = index >= openTabs.length - 1 ? Math.max(index - 1, 0) : index;
    window.setTimeout(() => tabRefs.current[nextIndex]?.focus(), 0);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
    const lastIndex = openTabs.length - 1;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        focusTabAt(index === lastIndex ? 0 : index + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        focusTabAt(index === 0 ? lastIndex : index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusTabAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusTabAt(lastIndex);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelectTab(openTabs[index].id);
        break;
      case 'Delete':
      case 'Backspace':
        if (openTabs.length > 1) {
          event.preventDefault();
          closeTabAt(index);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex items-center gap-1 bg-[#0a0b0d] px-3 pt-1 border-b border-border-subtle overflow-x-auto scrollbar-none select-none">
      <div
        className="flex items-center gap-1 flex-1 overflow-x-auto"
        role="tablist"
        aria-label="Pestañas abiertas"
        aria-orientation="horizontal"
      >
        {openTabs.map((tab, index) => {
          const Icon = getTabIcon(tab.tabType);
          const isActive = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              className={cn(
                "group relative flex items-center rounded-t-lg border-t border-x max-w-[200px] min-w-[120px] shrink-0 transition-all",
                isActive
                  ? "bg-[#121214] border-brand-cyan/40 text-brand-cyan font-bold shadow-[0_-2px_10px_rgba(0,210,255,0.1)]"
                  : "bg-white/[0.02] hover:bg-white/[0.06] border-transparent text-gray-400 hover:text-gray-200"
              )}
            >
              <div
                id={`navx-tab-${tab.id}`}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                role="tab"
                aria-selected={isActive}
                aria-controls={TABPANEL_ID}
                tabIndex={isActive ? 0 : -1}
                title={tabTitle(tab)}
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={cn(
                  "flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-[11px] font-mono",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan focus-visible:ring-inset"
                )}
              >
                <Icon size={12} className={cn("shrink-0", isActive ? "text-brand-cyan" : "text-gray-500")} aria-hidden="true" />
                <span className="truncate flex-1">{tabTitle(tab)}</span>
              </div>

              {openTabs.length > 1 && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="mr-1.5 shrink-0 cursor-pointer rounded p-0.5 text-gray-500 opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 group-hover:opacity-100"
                  title={`Cerrar pestaña ${tabTitle(tab)}`}
                  aria-label={`Cerrar pestaña ${tabTitle(tab)}`}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}

              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-cyan" aria-hidden="true" />
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onNewTab}
          className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
          title="Nueva pestaña"
          aria-label="Nueva pestaña"
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Persistence Badge */}
      <div 
        className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono shrink-0 ml-2 mb-0.5"
        title="Estado de sesión persistido automáticamente en IndexedDB"
        role="status"
        aria-live="polite"
      >
        <Database size={10} className={isSessionSaved ? "text-emerald-400" : "animate-spin text-amber-400"} aria-hidden="true" />
        <span className="hidden md:inline font-bold" aria-hidden="true">IDB Sesión Activa</span>
        <span className="sr-only">{isSessionSaved ? 'Sesión guardada en IndexedDB' : 'Guardando la sesión en IndexedDB'}</span>
      </div>
    </div>
  );
}
