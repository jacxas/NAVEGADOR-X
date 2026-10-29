/**
 * OwnershipPanel — titularidad, licencia y procedencia del navegador.
 *
 * Los datos que muestra no están escritos a mano: se leen del propio paquete de la
 * aplicación (autor, licencia, repositorio, versión) y del runtime que lo ejecuta
 * (Electron, Chromium, Node, rutas de instalación). Así, lo que afirma este panel
 * se puede comprobar en la máquina donde está instalado.
 *
 * Para dejar constancia pública de la titularidad, el apartado legal del sitio web
 * es el sitio natural; aquí queda la versión que viaja con el propio programa,
 * para que funcione también sin conexión.
 */

import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  ExternalLink,
  FileText,
  FolderOpen,
  Info,
  Scale,
  ShieldQuestion,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { desktopBridge, isDesktopApp, openExternal } from '@/src/lib/desktop';
import type { NativeAppInfo } from '@/src/types/desktop';
import { APP_VERSION_LABEL } from '@/src/lib/version';
import { copyText } from '@/src/lib/clipboard';

const REPOSITORY_FALLBACK = 'https://github.com/cryptojacxas-ship-it/NAVEGADOR-X';

export function OwnershipPanel() {
  const desktop = isDesktopApp();
  const [info, setInfo] = useState<NativeAppInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const bridge = desktopBridge();
    if (!bridge) return;
    void bridge.app.getInfo().then(setInfo);
  }, []);

  const author = info?.author || 'cryptojacxas-ship-it';
  const license = info?.license || 'MIT';
  const repository = info?.repository || REPOSITORY_FALLBACK;
  const version = info?.version || APP_VERSION_LABEL;

  const notice = [
    'AVISO DE TITULARIDAD — Navegador X',
    '=====================================',
    `Titular:            ${author}`,
    `Licencia:           ${license}`,
    `Versión:            ${version}`,
    `Repositorio:        ${repository}`,
    info?.description ? `Descripción:        ${info.description}` : '',
    info?.appPath ? `Instalado en:       ${info.appPath}` : '',
    info ? `Runtime:            Electron ${info.electron} · Chromium ${info.chrome} · Node ${info.node}` : '',
    '',
    `Este programa se distribuye bajo licencia ${license}. Se permite su uso, copia,`,
    'modificación y redistribución conservando este aviso y el fichero LICENSE.',
    'El nombre y la autoría del proyecto pertenecen a su titular.',
  ]
    .filter(Boolean)
    .join('\n');

  const copyNotice = async () => {
    // Mismo camino con plan B que el resto de la aplicación.
    const result = await copyText(notice);
    setCopied(result.ok);
    setTimeout(() => setCopied(false), 2500);
  };

  const rows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: 'Titular', value: author },
    { label: 'Licencia', value: license },
    { label: 'Versión', value: version, mono: true },
  ];

  if (info) {
    rows.push(
      { label: 'Plataforma', value: `${info.platform} · ${info.arch}`, mono: true },
      { label: 'Empaquetado', value: info.isPackaged ? 'Instalación empaquetada' : 'Ejecución desde el código fuente' },
      { label: 'Runtime', value: `Electron ${info.electron} · Chromium ${info.chrome}`, mono: true },
      { label: 'Node', value: info.node, mono: true },
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="card relative overflow-hidden p-6 md:p-8">
        <div className="absolute left-0 top-0 h-1 w-full bg-grad-x" />

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2">
              <BadgeCheck size={16} className="text-brand-cyan" />
              <h2 className="panel-header">Titularidad y procedencia</h2>
            </div>

            <p className="text-[12px] leading-relaxed text-gray-400">
              <strong className="text-white">{info?.name || 'Navegador X'}</strong> es un proyecto de{' '}
              <strong className="text-brand-cyan">{author}</strong>, distribuido bajo licencia{' '}
              <strong className="text-white">{license}</strong>. Los datos de esta ficha se leen del propio programa en
              ejecución, no están escritos a mano: puedes comprobarlos en el fichero{' '}
              <code className="font-mono text-[11px] text-gray-300">package.json</code> y en{' '}
              <code className="font-mono text-[11px] text-gray-300">LICENSE</code> de tu instalación.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => void copyNotice()}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors',
                  copied
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-brand-cyan/40 bg-brand-cyan/15 text-brand-cyan hover:bg-brand-cyan/25',
                )}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Aviso copiado' : 'Copiar aviso de titularidad'}
              </button>

              <button
                type="button"
                onClick={() => void openExternal(repository)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-colors hover:bg-white/10"
              >
                <ExternalLink size={12} />
                Repositorio
              </button>

              {info?.homepage && (
                <button
                  type="button"
                  onClick={() => void openExternal(info.homepage!)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-colors hover:bg-white/10"
                >
                  <FileText size={12} />
                  Sitio oficial
                </button>
              )}
            </div>
          </div>

          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-brand-cyan/30 bg-[#0d1117]">
            <Building2 size={30} className="text-brand-cyan" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ficha técnica */}
        <div className="card p-6">
          <h3 className="panel-header mb-5">Ficha del programa</h3>

          {!desktop && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <Info size={12} className="mt-0.5 shrink-0 text-gray-500" />
              <p className="text-[10px] leading-relaxed text-gray-500">
                Los datos del runtime se leen en la Edición de Escritorio. En la edición web solo se conocen los del
                paquete publicado.
              </p>
            </div>
          )}

          <div className="space-y-2 font-mono text-[10px]">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <span className="uppercase tracking-widest text-gray-600">{row.label}</span>
                <span className={cn('truncate text-gray-300', row.mono && 'font-mono')} title={row.value}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {info && (
            <div className="mt-5 space-y-2 border-t border-white/5 pt-5 font-mono text-[10px]">
              <div className="mb-1 flex items-center gap-1.5 text-gray-500">
                <FolderOpen size={11} />
                <span className="uppercase tracking-widest">Rutas de esta instalación</span>
              </div>
              {[
                { label: 'Programa', value: info.appPath },
                { label: 'Datos de usuario', value: info.userDataPath },
                { label: 'Descargas', value: info.downloadsPath },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3">
                  <span className="shrink-0 uppercase tracking-widest text-gray-600">{row.label}</span>
                  <span className="truncate text-gray-400" title={row.value}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verificación y licencia */}
        <div className="space-y-6">
          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldQuestion size={14} className="text-brand-cyan" />
              <h3 className="panel-header">Cómo verificar que es tuyo</h3>
            </div>

            <ul className="space-y-2 text-[11px] leading-relaxed text-gray-400">
              {[
                <>
                  El fichero <code className="font-mono text-gray-300">LICENSE</code> de la raíz del proyecto contiene el
                  texto completo de la licencia.
                </>,
                <>
                  <code className="font-mono text-gray-300">package.json</code> declara el campo{' '}
                  <code className="font-mono text-gray-300">author</code>, la{' '}
                  <code className="font-mono text-gray-300">license</code> y el{' '}
                  <code className="font-mono text-gray-300">repository</code> oficial.
                </>,
                <>
                  El historial de Git del repositorio es la prueba de autoría: cada confirmación queda firmada con fecha
                  y autor.
                </>,
                <>
                  Al publicar una versión, guarda el instalador y su suma de comprobación (SHA-256) junto a la fecha.
                  Cualquiera puede compararla con la que descargue.
                </>,
                <>
                  Este panel muestra la versión y el runtime reales: si alguien te dice que usa «otro» Navegador X, basta
                  comparar esta ficha.
                </>,
              ].map((item, index) => (
                <li key={index} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-cyan" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Scale size={14} className="text-amber-400" />
              <h3 className="panel-header">Qué dice la licencia {license}</h3>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-emerald-400">Permite</p>
                <ul className="space-y-1 text-[10.5px] leading-relaxed text-gray-400">
                  <li>Usar el programa con cualquier fin, también comercial.</li>
                  <li>Copiarlo y redistribuirlo.</li>
                  <li>Modificarlo y publicar tus cambios.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-amber-400">Exige</p>
                <ul className="space-y-1 text-[10.5px] leading-relaxed text-gray-400">
                  <li>Conservar el aviso de copyright y la licencia.</li>
                  <li>No usar el nombre del titular para promocionar derivados sin permiso.</li>
                  <li>Entregar el texto de la licencia junto al programa.</li>
                </ul>
              </div>
            </div>

            <p className="mt-4 border-t border-white/5 pt-4 text-[10px] leading-relaxed text-gray-600">
              Esta es una explicación en lenguaje llano, no asesoramiento legal. El texto que obliga es el del fichero{' '}
              <code className="font-mono text-gray-500">LICENSE</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
