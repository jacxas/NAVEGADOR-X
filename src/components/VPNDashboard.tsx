import { useState, useEffect } from 'react';
import { Shield, Globe, Lock, Loader2, MapPin, Signal, Activity, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { SimulationNotice } from './SimulationNotice';
import { NetworkPanel } from './NetworkPanel';

interface Node {
  id: string;
  name: string;
  country: string;
  latency: number;
  status: 'online' | 'busy' | 'offline';
  load: number;
  protocols: string[];
  type?: 'free' | 'premium';
}

import { ConnectionPanel } from './ConnectionPanel';
import { ConnectionStatus } from './ConnectionStatus';

export function VPNDashboard() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedNode, setSelectedNode] = useState('zh-01');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/vpn/servers')
      .then(res => {
        const ct = res.headers.get('content-type');
        if (res.ok && ct && ct.includes('application/json')) {
          return res.json();
        }
        throw new Error("Formato no válido o servidor no disponible");
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setNodes(data);
        } else {
          throw new Error("Datos de nodos vacíos");
        }
        setIsLoading(false);
      })
      .catch(() => {
        setNodes([
          { id: 'zh-01', name: 'Zurich Secure 01', country: 'Suiza', latency: 12, status: 'online', load: 34, protocols: ['WireGuard', 'OpenVPN'], type: 'premium' },
          { id: 'is-01', name: 'Reykjavik Vault', country: 'Islandia', latency: 45, status: 'online', load: 18, protocols: ['WireGuard'], type: 'premium' },
          { id: 'sg-01', name: 'Singapore Cyber', country: 'Singapur', latency: 120, status: 'online', load: 62, protocols: ['WireGuard', 'Tor'], type: 'free' },
          { id: 'nl-01', name: 'Amsterdam Freedom', country: 'Países Bajos', latency: 28, status: 'online', load: 45, protocols: ['WireGuard'], type: 'free' }
        ]);
        setIsLoading(false);
      });
  }, []);

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <div className="p-10 max-w-6xl mx-auto grid grid-cols-12 gap-8">
      {/* Estado real de la conexión: qué hace el programa con tu red y qué no. */}
      <div className="col-span-12">
        <ConnectionStatus />
      </div>

      {/* Configuración de red real: esto sí afecta a tu conexión */}
      <div className="col-span-12">
        <NetworkPanel />
      </div>

      <div className="col-span-12">
        <SimulationNotice module="VPN X (lista de nodos)">
          Esa lista es decorativa: esos servidores no existen y no puedes conectarte a ellos. Para enrutar tu tráfico de
          verdad, usa el panel de red de arriba con un servidor de tu confianza.
        </SimulationNotice>
      </div>

      {/* Connection Status Card */}
      <div className="col-span-12 md:col-span-4 space-y-6">
        {selectedNodeData ? (
          <ConnectionPanel 
            server={selectedNodeData} 
            onConnect={(id, proto) => {
              setIsConnecting(true);
              setTimeout(() => {
                setIsConnecting(false);
                setIsConnected(true);
              }, 1500);
            }}
            onDisconnect={() => setIsConnected(false)}
            onProtocolChange={(proto) => console.log("Protocol:", proto)}
          />
        ) : (
          <div className="card p-8 text-center text-gray-600 italic text-xs">
            Selecciona un nodo para configurar la conexión
          </div>
        )}

        <div className="card p-6 bg-brand-magenta/5 border-brand-magenta/10">
           <div className="flex items-center gap-3 mb-4">
             <Shield size={16} className="text-brand-magenta" />
             <span className="text-[10px] font-bold uppercase tracking-widest text-brand-magenta">Seguridad Avanzada</span>
           </div>
           <p className="text-[10px] text-gray-500 leading-relaxed font-mono">
             Cifrado post-cuántico activo. Protocolo X-Layer v2 detectado.
           </p>
        </div>
      </div>

      {/* Nodes and Stats */}
      <div className="col-span-12 md:col-span-8 space-y-8">
        <div className="card p-8 relative overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <h2 className="panel-header !mb-0">Global Network Status</h2>
            <div className="flex items-center gap-2">
               <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[8px] font-bold uppercase tracking-widest text-gray-400">
                 Free
               </span>
               <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand-magenta/10 border border-brand-magenta/20 text-[8px] font-bold uppercase tracking-widest text-brand-magenta">
                 <Zap size={8} /> Premium
               </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-1">
             {isLoading ? (
               <div className="flex items-center justify-center p-8 text-gray-600 animate-pulse text-xs font-mono">
                 Sincronizando nodos de red...
               </div>
             ) : (
               nodes.map((node) => (
                 <button
                   key={node.id}
                   onClick={() => setSelectedNode(node.id)}
                   className={cn(
                     "flex items-center justify-between p-3 rounded-xl border border-transparent transition-all",
                     selectedNode === node.id 
                      ? "bg-[#141418] border-white/10" 
                      : "hover:bg-white/[0.02]"
                   )}
                 >
                   <div className="flex items-center gap-4">
                     <MapPin size={14} className={selectedNode === node.id ? "text-brand-cyan" : "text-gray-600"} />
                     <div className="text-left flex items-center gap-3">
                        <div>
                          <div className="text-xs font-bold">{node.name}</div>
                          <div className="text-[9px] uppercase tracking-widest text-gray-500 font-mono">{node.country}</div>
                        </div>
                        {node.type === 'premium' && (
                          <span className="text-[7px] px-1.5 py-0.5 rounded-sm bg-brand-magenta/20 text-brand-magenta font-bold uppercase tracking-widest">PRO</span>
                        )}
                     </div>
                   </div>

                   <div className="flex items-center gap-6">
                      <div className="text-[10px] font-mono text-gray-500">{node.latency}ms</div>
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        node.status === 'online' ? "bg-brand-cyan shadow-[0_0_8px_rgba(0,255,255,0.5)]" : "bg-yellow-500"
                      )} />
                   </div>
                 </button>
               ))
             )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 text-center">
           <div className="card p-6">
             <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Tráfico</div>
             <div className="text-lg font-bold font-mono">1.2 GB</div>
           </div>
           <div className="card p-6">
             <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Velocidad</div>
             <div className="text-lg font-bold font-mono text-brand-cyan">980 Mbps</div>
           </div>
           <div className="card p-6">
             <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Leaks</div>
             <div className="text-lg font-bold font-mono text-brand-magenta">0</div>
           </div>
        </div>
      </div>
    </div>
  );
}
