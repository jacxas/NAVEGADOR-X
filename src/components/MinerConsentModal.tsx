import { useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '@/src/lib/a11y';

interface MinerConsentModalProps {
  onAccept: (cpuCap: number) => void;
  onDecline: () => void;
}

/**
 * Aviso del módulo de minería.
 *
 * Importante: este módulo NO mina criptomonedas. No hay cálculo criptográfico,
 * ni conexión a redes, ni ingresos. Todos los valores son ficticios y se generan
 * localmente para mostrar la interfaz. El texto de este aviso lo dice de forma
 * explícita para que nadie active la demostración pensando que obtendrá ganancias.
 */
export function MinerConsentModal({ onAccept, onDecline }: MinerConsentModalProps) {
  const [cpuCap, setCpuCap] = useState(30);
  const [accepted, setAccepted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Diálogo modal de verdad: el foco no se escapa al fondo y Escape cancela.
  useFocusTrap(dialogRef, { onEscape: onDecline });

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="miner-title"
      aria-describedby="miner-summary"
    >
      <div className="card max-w-md w-full mx-4 space-y-5">
        <h2 id="miner-title" className="text-xl font-bold bg-grad-x bg-clip-text text-transparent">
          Módulo de minería · Demostración de interfaz
        </h2>

        <div id="miner-summary" className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
          <p className="text-[12px] leading-relaxed text-amber-100/90">
            <strong className="text-amber-300">Esto no mina nada.</strong> No se realiza ningún cálculo criptográfico,
            no se conecta a ninguna red ni se generan ingresos. Las cifras que verás (hashrate, X-Token, nodos) son
            ficticias y se calculan con números aleatorios en tu propio equipo, solo para mostrar cómo se vería el
            panel. No hay consumo de CPU por minería.
          </p>
        </div>

        <div className="text-sm text-slate-300 space-y-2">
          <p>Al activar la demostración se pondrá en marcha una animación de la interfaz:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Una tarea local que solo actualiza números en pantalla</li>
            <li>Se puede detener en cualquier momento</li>
            <li>Intensidad del indicador configurable (valores de ejemplo)</li>
            <li>Simulación de parada automática por batería baja</li>
          </ul>
        </div>

        {/* Slider de intensidad */}
        <div>
          <label className="text-sm text-slate-300 block mb-1">
            Intensidad del indicador: <strong className="text-white">{cpuCap}%</strong>
          </label>
          <input
            type="range"
            min="10"
            max="80"
            step="5"
            value={cpuCap}
            onChange={(e) => setCpuCap(+e.target.value)}
            className="w-full accent-[#7b2cff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            aria-label="Intensidad del indicador de la demostración"
          />
          <p className="text-xs text-slate-500 mt-1">Es un valor estético: no limita ni reserva CPU real.</p>
        </div>

        {/* Casilla de confirmación */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 rounded border-border-panel bg-space-black"
            aria-required="true"
          />
          <span className="text-sm text-slate-300">
            Entiendo que es una <strong className="text-white">demostración visual</strong> y que no genera ninguna
            ganancia ni mina criptomonedas.
          </span>
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => accepted && onAccept(cpuCap)}
            disabled={!accepted}
            className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed !py-2 text-xs uppercase tracking-widest"
          >
            Iniciar demostración
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 bg-slate-700 hover:bg-slate-600 rounded-xl py-3 text-xs font-bold uppercase tracking-widest transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
