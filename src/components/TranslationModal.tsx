import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Languages, 
  X, 
  Copy, 
  Check, 
  Sparkles, 
  Globe, 
  ExternalLink, 
  MessageSquare,
  RotateCw
} from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '@/src/lib/utils';
import { useFocusTrap } from '@/src/lib/a11y';

interface TranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    translatedContent: string;
    targetLanguage: string;
    url: string;
    provider?: string;
  } | null;
  isLoading?: boolean;
  onReTranslate?: (targetLang: string) => void;
  onOpenInAi?: (content: string) => void;
}

const LANGUAGES = [
  { code: 'Español', name: 'Español' },
  { code: 'English', name: 'English' },
  { code: 'Français', name: 'Français' },
  { code: 'Deutsch', name: 'Deutsch' },
  { code: 'Português', name: 'Português' },
  { code: 'Italiano', name: 'Italiano' },
  { code: '日本語', name: '日本語' },
];

export function TranslationModal({
  isOpen,
  onClose,
  data,
  isLoading,
  onReTranslate,
  onOpenInAi,
}: TranslationModalProps) {
  const [copied, setCopied] = useState(false);
  const [selectedLang, setSelectedLang] = useState(data?.targetLanguage || 'Español');
  const dialogRef = useRef<HTMLDivElement>(null);

  // El diálogo atrapa el foco mientras está abierto y se cierra con Escape.
  useFocusTrap(dialogRef, { active: isOpen, onEscape: onClose });

  if (!isOpen) return null;

  const handleCopy = () => {
    if (data?.translatedContent) {
      navigator.clipboard.writeText(data.translatedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLangChange = (langName: string) => {
    setSelectedLang(langName);
    if (onReTranslate) {
      onReTranslate(langName);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="translation-title"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-[#12141a] border border-brand-cyan/30 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.15)] overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#161922]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan shadow-sm">
                <Languages size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 id="translation-title" className="text-sm font-bold text-white uppercase tracking-wider">
                    Traducción Instantánea
                  </h3>
                  <span className="flex items-center gap-1 text-[9px] font-mono font-semibold px-2 py-0.5 rounded-full bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20">
                    <Sparkles size={10} />
                    {data?.provider || 'Gemini 3.6 Flash'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 font-mono truncate max-w-sm mt-0.5">
                  URL: {data?.url || 'Pestaña Activa'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Language Selector Bar */}
          <div className="flex items-center justify-between px-6 py-2.5 bg-[#0e1017] border-b border-white/5 text-xs">
            <div className="flex items-center gap-2">
              <Globe size={13} className="text-gray-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Idioma Destino:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLangChange(lang.name)}
                    disabled={isLoading}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold font-mono transition-all",
                      (data?.targetLanguage === lang.name || selectedLang === lang.name)
                        ? "bg-brand-cyan text-black shadow-md"
                        : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                    )}
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center gap-1.5 text-[10px] text-brand-cyan font-mono animate-pulse">
                <RotateCw size={12} className="animate-spin" />
                <span>Traduciendo...</span>
              </div>
            )}
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-gray-200 text-xs leading-relaxed">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-brand-cyan/20 border-t-brand-cyan animate-spin" />
                  <Sparkles size={16} className="absolute inset-0 m-auto text-brand-cyan animate-pulse" />
                </div>
                <p className="text-xs font-mono text-brand-cyan uppercase tracking-widest animate-pulse">
                  Procesando traducción con Gemini AI...
                </p>
                <p className="text-[10px] text-gray-500">
                  Adaptando terminología y estructura contextual al {selectedLang}
                </p>
              </div>
            ) : data?.translatedContent ? (
              <div className="prose prose-invert max-w-none text-xs space-y-3 font-sans">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 leading-relaxed text-gray-300">
                  <Markdown>{data.translatedContent}</Markdown>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 text-xs">
                No hay contenido traducido disponible.
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#161922]">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!data?.translatedContent || isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-green-400" />
                    <span className="text-green-400">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copiar Texto</span>
                  </>
                )}
              </button>

              {onOpenInAi && data?.translatedContent && (
                <button
                  onClick={() => {
                    onOpenInAi(data.translatedContent);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-magenta/10 hover:bg-brand-magenta/20 text-brand-magenta border border-brand-magenta/30 text-[10px] font-bold uppercase tracking-wider transition-all"
                >
                  <MessageSquare size={13} />
                  <span>Analizar en IA Layer</span>
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider transition-all"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
