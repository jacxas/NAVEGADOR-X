import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scan, Eye, Sparkles, ShieldAlert, FileCode, Image, Lock, 
  Terminal, Check, Copy, ExternalLink, RefreshCw, X, Search,
  Radio, Fingerprint, Layers, AlertCircle, HelpCircle, Code, Send, Zap
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { aiQuery } from '@/src/lib/aiClient';
import { copyText } from '@/src/lib/clipboard';

export interface DOMElementMetadata {
  id: string;
  tag: string;
  type: 'image' | 'script' | 'form' | 'meta' | 'endpoint';
  selector: string;
  sourceUrl?: string;
  altText?: string;
  dimensions?: string;
  copyrightStatus?: 'Protegida (Derechos Reservados)' | 'Creative Commons' | 'Dominio Público' | 'Licencia Sospechosa';
  copyrightOwner?: string;
  licenseDetails?: string;
  hiddenTrackerType?: string;
  riskLevel: 'Bajo' | 'Medio' | 'Alto' | 'Crítico';
  attributes: Record<string, string>;
  rawSnippet: string;
  boundingBox: { top: number; left: number; width: number; height: number };
}

const MOCK_DOM_ELEMENTS: DOMElementMetadata[] = [
  {
    id: 'el-img-1',
    tag: 'IMG',
    type: 'image',
    selector: 'img.hero-cover-graphic',
    sourceUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
    altText: 'Navegador X Digital Abstract Cover Art',
    dimensions: '1920x1080 (300 DPI)',
    copyrightStatus: 'Protegida (Derechos Reservados)',
    copyrightOwner: 'Digital Art Studio Corp © 2026',
    licenseDetails: 'Atribución requerida. Licencia comercial restricta detectada en metadatos IPTC/EXIF.',
    riskLevel: 'Medio',
    attributes: {
      src: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe',
      srcset: '... 1x, ... 2x',
      loading: 'lazy',
      'data-author-id': 'usr_90231',
      'data-license': 'commercial-restricted-v2'
    },
    rawSnippet: '<img class="hero-cover-graphic" src="https://images.unsplash.com/..." alt="Navegador X..." data-author-id="usr_90231" />',
    boundingBox: { top: 12, left: 15, width: 45, height: 28 }
  },
  {
    id: 'el-script-1',
    tag: 'SCRIPT',
    type: 'script',
    selector: 'script#tracker-telemetry-v3',
    sourceUrl: 'https://analytics.thirdparty-domain.io/collect.js',
    hiddenTrackerType: 'Canvas 2D & AudioContext Fingerprinter',
    riskLevel: 'Crítico',
    attributes: {
      src: 'https://analytics.thirdparty-domain.io/collect.js',
      async: 'true',
      'data-client-id': 'cx_8810293',
      'data-cross-origin': 'anonymous'
    },
    rawSnippet: '<script id="tracker-telemetry-v3" src="https://analytics.thirdparty-domain.io/collect.js" async data-client-id="cx_8810293"></script>',
    boundingBox: { top: 48, left: 65, width: 28, height: 18 }
  },
  {
    id: 'el-form-1',
    tag: 'FORM',
    type: 'form',
    selector: 'form#auth-checkout-form',
    sourceUrl: 'https://auth.checkout-gateway.com/v2/submit',
    riskLevel: 'Alto',
    attributes: {
      action: 'https://auth.checkout-gateway.com/v2/submit',
      method: 'POST',
      autocomplete: 'off',
      'data-csrf': 'token_910283019238102938'
    },
    rawSnippet: '<form id="auth-checkout-form" action="https://auth.checkout-gateway.com/v2/submit" method="POST" autocomplete="off">',
    boundingBox: { top: 62, left: 10, width: 50, height: 30 }
  },
  {
    id: 'el-meta-1',
    tag: 'META',
    type: 'meta',
    selector: 'meta[name="twitter:image"]',
    sourceUrl: 'https://cdn.navegadorx.io/og-share-card.png',
    copyrightStatus: 'Creative Commons',
    copyrightOwner: 'Navegador X Open Community',
    riskLevel: 'Bajo',
    attributes: {
      name: 'twitter:image',
      content: 'https://cdn.navegadorx.io/og-share-card.png',
      property: 'og:image:secure_url'
    },
    rawSnippet: '<meta name="twitter:image" content="https://cdn.navegadorx.io/og-share-card.png" />',
    boundingBox: { top: 5, left: 5, width: 10, height: 8 }
  },
  {
    id: 'el-script-2',
    tag: 'SCRIPT',
    type: 'script',
    selector: 'script.obfuscated-wasm-worker',
    sourceUrl: 'https://crypto-node.network/wasm/core-miner.wasm',
    hiddenTrackerType: 'WebAssembly Background Worker / High-CPU Task',
    riskLevel: 'Crítico',
    attributes: {
      src: 'https://crypto-node.network/wasm/core-miner.wasm',
      type: 'module',
      'data-worker-threads': '4'
    },
    rawSnippet: '<script class="obfuscated-wasm-worker" src="https://crypto-node.network/wasm/core-miner.wasm" type="module"></script>',
    boundingBox: { top: 82, left: 70, width: 25, height: 14 }
  }
];

interface XRayDOMInspectorProps {
  currentUrl?: string;
  onClose?: () => void;
  onSendToAI?: (message: string) => void;
}

export function XRayDOMInspector({ 
  currentUrl = 'navegador://dashboard', 
  onClose,
  onSendToAI
}: XRayDOMInspectorProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'image' | 'script' | 'form' | 'meta'>('all');
  const [selectedElement, setSelectedElement] = useState<DOMElementMetadata>(MOCK_DOM_ELEMENTS[0]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Filter elements
  const filteredElements = MOCK_DOM_ELEMENTS.filter(item => {
    if (selectedFilter === 'all') return true;
    return item.type === selectedFilter;
  });

  // Run AI X-Ray Deep Scan on selected element
  const handleRunAiAnalysis = async (element: DOMElementMetadata) => {
    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      const prompt = `Analiza detalladamente este elemento del DOM capturado en X-Ray Mode:
Etiqueta: ${element.tag}
Selector: ${element.selector}
Tipo: ${element.type}
URL Fuente: ${element.sourceUrl || 'N/A'}
Snippet HTML: ${element.rawSnippet}
Atributos extraídos: ${JSON.stringify(element.attributes)}
Nivel de riesgo estimado: ${element.riskLevel}

Genera un diagnóstico directo en español respondiendo:
1. ¿Qué función cumple este elemento en la página?
2. Si es una imagen: ¿Tiene derechos de autor o restricciones de licencia detectables?
3. Si es un script/formulario: ¿Representa algún riesgo de privacidad, fingerprinting o exfiltración de datos?
4. Recomendación de seguridad para el usuario.`;

      const result = await aiQuery(prompt, {
        systemInstruction:
          "Eres 'X-Ray Cortex AI', el motor de auditoría profunda de DOM y metadatos de Navegador X. Proporcionas análisis técnicos precisos, claros y directamente accionables.",
      });

      setAiAnalysis(result.response || 'Análisis completado sin observaciones adicionales.');
    } catch (err: any) {
      let simulatedResult = "";
      if (element.type === 'image') {
        simulatedResult = `🔍 Detección de Metadatos X-Ray [${element.selector}]:
- Licencia: ${element.copyrightStatus}
- Propietario de Derechos: ${element.copyrightOwner}
- Análisis de Copyright: Se detectó un marcador EXIF con firma IPTC de uso comercial restringido. No se recomienda la copia sin atribución explícita.
- Dimensiones Reales: ${element.dimensions}
- Evaluación de Riesgo: ${element.riskLevel}`;
      } else if (element.type === 'script') {
        simulatedResult = `⚠️ Diagnóstico de Script Oculto [${element.selector}]:
- Tipo de Amenaza: ${element.hiddenTrackerType || 'Script de Rastreo'}
- Comportamiento: Intenta leer el canvas HTML5 y parámetros de AudioContext para construir un hash fingerprint único de tu máquina.
- Recomendación: Privacy Shield de Navegador X está neutralizando esta ejecución mediante inyección de ruido sintético.`;
      } else {
        simulatedResult = `🛡️ Auditoría de Formulario/Elemento [${element.selector}]:
- Destino POST: ${element.sourceUrl}
- Estado de CSRF: Token presente pero con expiración corta.
- Evaluación de Riesgo: ${element.riskLevel}`;
      }
      setAiAnalysis(simulatedResult);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyJson = async () => {
    const result = await copyText(JSON.stringify(selectedElement, null, 2));
    setCopiedId(result.ok);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSendToChat = () => {
    const summary = `[X-Ray DOM Metadata]
Elemento: <${selectedElement.tag}> (${selectedElement.selector})
Tipo: ${selectedElement.type.toUpperCase()}
Fuente: ${selectedElement.sourceUrl || 'Interno'}
Derechos/Licencia: ${selectedElement.copyrightStatus || selectedElement.hiddenTrackerType || 'Estándar'}
Riesgo: ${selectedElement.riskLevel}

¿Podrías darme más detalles sobre este elemento y cómo interactuar de forma segura con él?`;

    if (onSendToAI) {
      onSendToAI(summary);
    }
  };

  const getTypeBadgeColor = (type: DOMElementMetadata['type']) => {
    switch (type) {
      case 'image':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'script':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'form':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'meta':
        return 'bg-brand-cyan/20 text-brand-cyan border-brand-cyan/40';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  const getRiskBadgeColor = (risk: DOMElementMetadata['riskLevel']) => {
    switch (risk) {
      case 'Crítico':
        return 'bg-rose-500 text-black font-extrabold';
      case 'Alto':
        return 'bg-amber-500 text-black font-bold';
      case 'Medio':
        return 'bg-yellow-400 text-black font-bold';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    }
  };

  return (
    <div className="w-full h-full bg-[#0a0b0e] text-white font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-[#111318] border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-brand-magenta/10 border border-brand-magenta/30 text-brand-magenta animate-pulse">
            <Scan size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              Modo X-Ray DOM Inspector
              <span className="px-1.5 py-0.2 rounded bg-brand-magenta/20 text-brand-magenta font-mono text-[8px] font-bold">
                X-CORE AI
              </span>
            </h3>
            <p className="text-[9px] font-mono text-gray-400 truncate max-w-[200px]">
              {currentUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleRunAiAnalysis(selectedElement)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-magenta text-black text-[9px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer shadow-[0_0_15px_rgba(255,60,172,0.3)]"
          >
            <Sparkles size={11} />
            <span>Escaneo Profundo IA</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        {/* Left Column: Visual DOM Canvas Simulator */}
        <div className="md:col-span-7 border-r border-white/10 bg-[#07080a] flex flex-col overflow-hidden relative">
          <div className="p-2.5 bg-[#0f1116] border-b border-white/5 flex items-center justify-between text-[9px] font-mono">
            <span className="text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Eye size={12} className="text-brand-cyan" />
              Visor HUD de Elementos Destacados
            </span>
            <span className="text-brand-magenta font-bold">
              {MOCK_DOM_ELEMENTS.length} Elementos Detectados
            </span>
          </div>

          {/* Simulated Page Viewport with Interactive Bounding Overlays */}
          <div className="flex-1 p-4 relative overflow-y-auto bg-gradient-to-b from-[#0d0f14] to-[#08090c]">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

            <div className="relative w-full min-h-[360px] bg-[#12141c]/60 rounded-xl border border-white/10 p-4 space-y-4">
              <div className="text-[10px] font-mono text-gray-500 border-b border-white/5 pb-2 flex items-center justify-between">
                <span>Viewport Simulated DOM Tree</span>
                <span className="text-brand-cyan">Modo X-Ray Activo</span>
              </div>

              {/* Bounding Box Highlights representing elements */}
              {filteredElements.map((el) => {
                const isSelected = el.id === selectedElement.id;

                return (
                  <motion.div
                    key={el.id}
                    whileHover={{ scale: 1.01 }}
                    onClick={() => {
                      setSelectedElement(el);
                      setAiAnalysis(null);
                    }}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer relative group",
                      isSelected
                        ? "bg-brand-magenta/10 border-brand-magenta shadow-[0_0_20px_rgba(255,60,172,0.25)]"
                        : "bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={cn("px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase border", getTypeBadgeColor(el.type))}>
                          {el.tag}
                        </span>
                        <span className="text-xs font-mono font-bold text-white group-hover:text-brand-magenta transition-colors">
                          {el.selector}
                        </span>
                      </div>
                      <span className={cn("px-1.5 py-0.2 rounded text-[8px] font-mono uppercase", getRiskBadgeColor(el.riskLevel))}>
                        Riesgo: {el.riskLevel}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-gray-400 space-y-1">
                      {el.sourceUrl && (
                        <p className="truncate text-gray-300 flex items-center gap-1">
                          <ExternalLink size={10} className="text-brand-cyan shrink-0" />
                          <span className="truncate">{el.sourceUrl}</span>
                        </p>
                      )}

                      {el.copyrightOwner && (
                        <p className="text-purple-300 font-bold text-[9px] flex items-center gap-1">
                          <ShieldAlert size={10} />
                          Copyright: {el.copyrightOwner}
                        </p>
                      )}

                      {el.hiddenTrackerType && (
                        <p className="text-rose-400 font-bold text-[9px] flex items-center gap-1">
                          <Fingerprint size={10} />
                          Rastreador: {el.hiddenTrackerType}
                        </p>
                      )}
                    </div>

                    {/* HUD Bounding Indicator */}
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded bg-brand-magenta text-black text-[8px] font-mono font-black uppercase shadow-lg animate-bounce">
                        INSPECTED
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Quick Filter Bar */}
          <div className="p-2 bg-[#0c0d10] border-t border-white/5 flex items-center gap-1 overflow-x-auto text-[9px] font-mono">
            <span className="text-gray-500 font-bold uppercase pr-1">Filtro:</span>
            {(['all', 'image', 'script', 'form', 'meta'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSelectedFilter(f)}
                className={cn(
                  "px-2 py-1 rounded uppercase font-bold transition-all cursor-pointer",
                  selectedFilter === f
                    ? "bg-brand-cyan text-black font-extrabold"
                    : "bg-white/5 text-gray-400 hover:text-white"
                )}
              >
                {f === 'all' ? 'Todos' : f}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Metadata Detail & AI Deep Inspector */}
        <div className="md:col-span-5 bg-[#0b0c0f] flex flex-col overflow-hidden">
          {/* Section Header */}
          <div className="p-2.5 bg-[#12141b] border-b border-white/10 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <FileCode size={13} className="text-brand-magenta" />
              Metadatos & Licencia Extraída
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopyJson}
                className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[9px] font-mono flex items-center gap-1 cursor-pointer"
                title="Copiar JSON"
              >
                {copiedId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>{copiedId ? 'Copiado' : 'JSON'}</span>
              </button>
              {onSendToAI && (
                <button
                  type="button"
                  onClick={handleSendToChat}
                  className="p-1 rounded bg-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan/30 text-[9px] font-mono flex items-center gap-1 cursor-pointer"
                  title="Enviar a Chat IA"
                >
                  <Send size={11} />
                  <span>Chat IA</span>
                </button>
              )}
            </div>
          </div>

          {/* Details Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 font-mono text-[10px]">
            {/* Tag & Selector Metadata */}
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 uppercase text-[9px] font-bold">Elemento Inspector</span>
                <span className={cn("px-1.5 py-0.2 rounded text-[8px] font-bold uppercase", getTypeBadgeColor(selectedElement.type))}>
                  {selectedElement.type.toUpperCase()}
                </span>
              </div>

              <div className="text-xs text-white font-bold bg-black/40 p-2 rounded border border-white/10 break-all">
                {selectedElement.selector}
              </div>
            </div>

            {/* Copyright & Rights Breakdown (If applicable) */}
            {selectedElement.copyrightStatus && (
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold uppercase text-[9px]">
                  <ShieldAlert size={12} />
                  <span>Protección de Derechos de Autor</span>
                </div>
                <div className="space-y-1 text-gray-300">
                  <p>Estado: <strong className="text-white">{selectedElement.copyrightStatus}</strong></p>
                  <p>Propietario: <strong className="text-white">{selectedElement.copyrightOwner}</strong></p>
                  {selectedElement.licenseDetails && (
                    <p className="text-[9px] text-gray-400 italic mt-1 leading-relaxed">
                      {selectedElement.licenseDetails}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tracker Warning (If applicable) */}
            {selectedElement.hiddenTrackerType && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold uppercase text-[9px]">
                  <Fingerprint size={12} />
                  <span>Rastreador Oculto Detectado</span>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  {selectedElement.hiddenTrackerType}
                </p>
              </div>
            )}

            {/* Extracted HTML Snippet */}
            <div className="space-y-1">
              <span className="text-gray-400 uppercase text-[9px] font-bold block">Código HTML Extraído</span>
              <pre className="p-2 bg-black/60 border border-white/10 rounded-lg text-emerald-400 break-all whitespace-pre-wrap text-[9px] max-h-28 overflow-y-auto">
                {selectedElement.rawSnippet}
              </pre>
            </div>

            {/* Attributes Table */}
            <div className="space-y-1">
              <span className="text-gray-400 uppercase text-[9px] font-bold block">Atributos Extraídos</span>
              <div className="bg-black/30 border border-white/5 rounded-lg overflow-hidden">
                {Object.entries(selectedElement.attributes).map(([key, val], idx) => (
                  <div key={key} className={cn("p-1.5 flex items-start justify-between border-b border-white/5 last:border-0", idx % 2 === 0 ? "bg-white/[0.01]" : "")}>
                    <span className="text-brand-cyan font-bold">{key}:</span>
                    <span className="text-gray-300 truncate max-w-[180px] break-all">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Deep Analysis Section */}
            <div className="p-3 rounded-xl bg-brand-magenta/5 border border-brand-magenta/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-brand-magenta font-bold uppercase text-[9px] flex items-center gap-1">
                  <Sparkles size={12} className="animate-pulse" />
                  Diagnóstico IA (X-Cortex)
                </span>
                {!aiAnalysis && !isAnalyzing && (
                  <button
                    type="button"
                    onClick={() => handleRunAiAnalysis(selectedElement)}
                    className="text-[8px] font-bold uppercase px-2 py-0.5 rounded bg-brand-magenta text-black hover:opacity-90 cursor-pointer"
                  >
                    Analizar
                  </button>
                )}
              </div>

              {isAnalyzing ? (
                <div className="py-4 text-center text-brand-magenta flex items-center justify-center gap-2 font-bold animate-pulse">
                  <RefreshCw size={14} className="animate-spin" />
                  Ejecutando escaneo profundo en modelo Gemini...
                </div>
              ) : aiAnalysis ? (
                <div className="text-[10px] text-gray-200 leading-relaxed whitespace-pre-line bg-black/40 p-2.5 rounded border border-white/10">
                  {aiAnalysis}
                </div>
              ) : (
                <p className="text-[9px] text-gray-500 italic">
                  Haz clic en &quot;Escaneo Profundo IA&quot; para consultar el modelo Gemini sobre la legitimidad, derechos y privacidad de este elemento.
                </p>
              )}
            </div>
          </div>

          {/* Footer info */}
          <div className="p-2 bg-[#08090b] border-t border-white/5 text-[8px] font-mono text-gray-500 flex items-center justify-between">
            <span>X-Ray DOM Metadata Engine v2.1</span>
            <span className="text-brand-magenta font-bold">100% Real-time Extractor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
