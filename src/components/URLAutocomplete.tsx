import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Clock, Star, ArrowUpRight, Search, LayoutGrid, Shield, Cpu, Sparkles, ShoppingBag, ShieldCheck } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  isInternal?: boolean;
  visitCount?: number;
  category?: string;
}

interface URLAutocompleteProps {
  isOpen: boolean;
  inputValue: string;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClose: () => void;
}

export function URLAutocomplete({
  isOpen,
  inputValue,
  history,
  onSelect,
  onClose,
}: URLAutocompleteProps) {
  if (!isOpen) return null;

  // Clean prompt string for matching
  const query = inputValue.replace(/^navegador:\/\//, '').replace(/^navigatorx:\/\//, '').replace(/^https?:\/\//, '').toLowerCase().trim();

  // Filter history items by title or url
  const filteredItems = history.filter((item) => {
    if (!query) return true; // Show top frequent/recent if empty query
    const cleanItemUrl = item.url.replace(/^navegador:\/\//, '').replace(/^navigatorx:\/\//, '').replace(/^https?:\/\//, '').toLowerCase();
    const cleanTitle = item.title.toLowerCase();
    return cleanItemUrl.includes(query) || cleanTitle.includes(query);
  }).slice(0, 6); // Max 6 recommendations

  const getIcon = (item: HistoryItem) => {
    if (item.url.includes('dashboard')) return <LayoutGrid size={13} className="text-brand-cyan" />;
    if (item.url.includes('vpn')) return <Shield size={13} className="text-[#00ff88]" />;
    if (item.url.includes('mineria') || item.url.includes('miner')) return <Cpu size={13} className="text-amber-400" />;
    if (item.url.includes('ia')) return <Sparkles size={13} className="text-brand-magenta" />;
    if (item.url.includes('mercado') || item.url.includes('marketplace')) return <ShoppingBag size={13} className="text-purple-400" />;
    if (item.url.includes('admin')) return <ShieldCheck size={13} className="text-rose-400" />;
    if (item.url.includes('favoritos')) return <Star size={13} className="text-brand-magenta" />;
    if (item.isInternal) return <Star size={13} className="text-brand-cyan" />;
    return <Globe size={13} className="text-blue-400" />;
  };

  return (
    <AnimatePresence>
      <motion.div
        id="navx-address-suggestions"
        role="listbox"
        aria-label="Sugerencias de navegación e historial"
        initial={{ opacity: 0, y: -4, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -4, scale: 0.99 }}
        transition={{ duration: 0.15 }}
        className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#16171b] border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-xl overflow-hidden font-sans"
      >
        <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between text-[9px] text-gray-400 font-mono">
          <span className="flex items-center gap-1 uppercase tracking-wider font-bold text-gray-400">
            <Clock size={10} className="text-brand-cyan" />
            Sugerencias de Navegación & Historial
          </span>
          <span className="text-[8px] text-gray-500">
            {filteredItems.length} resultados
          </span>
        </div>

        {filteredItems.length > 0 ? (
          <div className="py-1 max-h-64 overflow-y-auto">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                id={`navx-suggestion-${item.id}`}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur on input
                  onSelect(item);
                }}
                className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors group cursor-pointer border-l-2 border-transparent hover:border-brand-cyan"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors shrink-0">
                    {getIcon(item)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white group-hover:text-brand-cyan transition-colors truncate">
                        {item.title}
                      </span>
                      {item.isInternal && (
                        <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                          SISTEMA
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono truncate">
                      {item.url}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-gray-500 group-hover:text-white transition-colors shrink-0 ml-2">
                  {item.visitCount && item.visitCount > 1 && (
                    <span className="text-[8px] font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                      {item.visitCount} visitas
                    </span>
                  )}
                  <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-gray-500 space-y-1">
            <Search size={16} className="mx-auto text-gray-600 mb-1" />
            <p className="text-xs font-medium text-gray-400">Sin coincidencias directas</p>
            <p className="text-[10px] text-gray-500 font-mono">
              Presiona Enter para buscar o navegar directamente a <span className="text-brand-cyan">"{inputValue}"</span>
            </p>
          </div>
        )}

        <div className="px-3 py-1.5 bg-[#0f1013] border-t border-white/5 flex items-center justify-between text-[8px] text-gray-500 font-mono">
          <span>Usa Enter para seleccionar</span>
          <span className="text-brand-cyan/80">Navegador X Sync</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
