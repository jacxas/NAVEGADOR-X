import { useEffect, useState } from 'react';
import { AlertCircle, Globe, Loader2, MapPin, RefreshCw, Shield } from 'lucide-react';
import { NetworkPanel } from './NetworkPanel';
import { ConnectionStatus } from './ConnectionStatus';

interface VPNGateServer {
  id: string;
  hostName: string;
  ip: string;
  country: string;
  countryCode: string;
  pingMs: number | null;
  speedBytesPerSecond: number | null;
  activeSessions: number | null;
  loggingPolicy: 'no-log-claim' | 'some-logs' | 'unknown';
  protocol: 'OpenVPN';
}

interface VPNGateResponse {
  servers: VPNGateServer[];
  fetchedAt: number;
  cached: boolean;
}

const formatSpeed = (bytesPerSecond: number | null) => {
  if (bytesPerSecond === null) return '—';
  const mbps = (bytesPerSecond * 8) / 1_000_000;
  return mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbps` : `${mbps.toFixed(1)} Mbps`;
};

const loggingLabel = (policy: VPNGateServer['loggingPolicy']) => {
  if (policy === 'no-log-claim') return 'El servidor declara no guardar logs';
  if (policy === 'some-logs') return 'Declara conservar algunos registros';
  return 'Política no verificada';
};

export function VPNDashboard() {
  const [servers, setServers] = useState<VPNGateServer[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');

    fetch('/api/v1/vpn/servers', { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || `No se pudo consultar VPN Gate (HTTP ${response.status}).`);
        }
        if (!payload || !Array.isArray(payload.servers)) {
          throw new Error('La respuesta del catálogo VPN Gate no tiene el formato esperado.');
        }
        return payload as VPNGateResponse;
      })
      .then((payload) => {
        setServers(payload.servers);
        setFetchedAt(payload.fetchedAt);
        setSelectedId((current) =>
          payload.servers.some((server) => server.id === current)
            ? current
            : payload.servers[0]?.id || '',
        );
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === 'AbortError') return;
        setServers([]);
        setError(cause instanceof Error ? cause.message : 'Error desconocido consultando VPN Gate.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey]);

  const selected = servers.find((server) => server.id === selectedId);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto grid grid-cols-12 gap-8">
      <div className="col-span-12">
        <ConnectionStatus />
      </div>

      <div className="col-span-12">
        <NetworkPanel />
      </div>

      <section className="col-span-12 card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-brand-cyan" />
              <h2 className="panel-header !mb-0">VPN Gate · servidores públicos</h2>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Catálogo dinámico de relays voluntarios. Protocolo disponible: OpenVPN.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Actualizar catálogo
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">VPN Gate no está disponible</p>
              <p className="mt-1 text-amber-200/70">{error}</p>
              <p className="mt-2 text-amber-200/60">No se muestran servidores inventados ni se ha iniciado una conexión VPN.</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-xs text-gray-500">
            <Loader2 size={16} className="animate-spin" /> Consultando el catálogo oficial…
          </div>
        ) : servers.length === 0 && !error ? (
          <div className="py-12 text-center text-xs text-gray-500">VPN Gate no devolvió servidores OpenVPN válidos.</div>
        ) : servers.length > 0 ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-gray-500">
              <span>{servers.length} servidores válidos recibidos</span>
              {fetchedAt && <span>Actualizado: {new Date(fetchedAt).toLocaleString()}</span>}
            </div>
            <div className="max-h-[480px] space-y-1 overflow-y-auto pr-1">
              {servers.map((server) => (
                <button
                  type="button"
                  key={server.id}
                  onClick={() => setSelectedId(server.id)}
                  className={`flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left transition-colors ${
                    selectedId === server.id
                      ? 'border-brand-cyan/30 bg-brand-cyan/5'
                      : 'border-transparent hover:border-white/10 hover:bg-white/[0.02]'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <MapPin size={14} className="shrink-0 text-gray-500" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-gray-200">{server.country} · {server.hostName}</span>
                      <span className="mt-1 block text-[10px] font-mono text-gray-500">{server.ip} · {server.countryCode}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4 text-[10px] font-mono text-gray-400">
                    <span>{server.pingMs === null ? '—' : `${server.pingMs} ms`}</span>
                    <span>{formatSpeed(server.speedBytesPerSecond)}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {selected && (
        <section className="col-span-12 card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield size={15} className="text-brand-cyan" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Servidor seleccionado · solo información</h3>
          </div>
          <div className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-gray-500">Protocolo</p><p className="mt-1 text-gray-200">{selected.protocol}</p></div>
            <div><p className="text-gray-500">Sesiones reportadas</p><p className="mt-1 text-gray-200">{selected.activeSessions ?? 'Sin dato'}</p></div>
            <div><p className="text-gray-500">Velocidad anunciada</p><p className="mt-1 text-gray-200">{formatSpeed(selected.speedBytesPerSecond)}</p></div>
            <div><p className="text-gray-500">Política declarada</p><p className="mt-1 text-gray-200">{loggingLabel(selected.loggingPolicy)}</p></div>
          </div>
          <p className="mt-5 border-t border-white/5 pt-4 text-[10px] leading-relaxed text-amber-300/70">
            La selección no conecta el equipo. Los servidores son operados por voluntarios y sus políticas pueden variar.
            La conexión nativa OpenVPN se habilitará en una fase posterior, después de validar perfiles y el proceso del sistema.
          </p>
        </section>
      )}
    </div>
  );
}
