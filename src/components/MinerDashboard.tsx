import { useState, useEffect, useRef } from 'react';
import { Cpu, Zap, Database, TrendingUp, Search, Info, AlertTriangle, Blocks } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { MinerConsentModal } from './MinerConsentModal';
import { useMiner } from '@/src/hooks/useMiner';
import { db, auth, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const data = [
  { name: '12:00', hash: 120 },
  { name: '12:05', hash: 135 },
  { name: '12:10', hash: 128 },
  { name: '12:15', hash: 145 },
  { name: '12:20', hash: 160 },
  { name: '12:25', hash: 155 },
  { name: '12:30', hash: 172 },
  { name: '12:35', hash: 185 },
];

export function MinerDashboard() {
  const { start, stop, stats } = useMiner();
  const [isMining, setIsMining] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [nodes, setNodes] = useState(0);
  const [cpuCap, setCpuCap] = useState(30);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [autoStopBattery, setAutoStopBattery] = useState(true);
  const [isPluggedIn, setIsPluggedIn] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  
  const earningsRef = useRef(0);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  // Sync earnings with Firestore
  useEffect(() => {
    if (!user) {
      setEarnings(0.00421); // Mock for non-logged in
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setEarnings(data.earnings || 0);
        earningsRef.current = data.earnings || 0;
      }
    }, (error) => {
      console.warn('[MinerDashboard] User doc snapshot error:', error);
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsub();
  }, [user]);

  // El contador de X-COIN es una simulación local: no se persiste en Firestore.
  // Escribirlo en `users.earnings` convertía una demo en un saldo real.

  useEffect(() => {
    // Battery & Idle simulation
    const batteryInterval = setInterval(() => {
      setBatteryLevel(prev => {
        if (isPluggedIn) return Math.min(100, prev + 0.5);
        
        const drain = isMining ? 0.5 : 0.1;
        const newLevel = Math.max(0, prev - drain);
        
        // Auto-stop logic (Sprint 3 + powerMonitor snippet logic)
        if (autoStopBattery && isMining) {
          if (newLevel < 20) {
            setIsMining(false);
          }
          if (!isPluggedIn && isIdle) {
            setIsMining(false); // Simulated: powerMonitor.on('on-battery') + idle(60)
          }
        }
        
        return newLevel;
      });
    }, 5000);

    return () => clearInterval(batteryInterval);
  }, [isMining, autoStopBattery, isPluggedIn, isIdle]);

  useEffect(() => {
    if (isMining) {
      start(cpuCap);
    } else {
      stop();
    }
  }, [isMining, start, stop]);

  useEffect(() => {
    let interval: any;
    if (isMining) {
      // Primary simulation loop for nodes and earnings
      interval = setInterval(() => {
        setEarnings(prev => {
          const next = prev + (0.0000001 * (cpuCap / 30));
          earningsRef.current = next;
          return next;
        });
        
        // Fetch "main process" metrics (nodes only now, as hook handles hashrate/cpu)
        fetch('/api/miner/status')
          .then(res => (res.ok ? res.json() : null))
          .then(status => {
            if (status && typeof status.nodes === 'number') setNodes(status.nodes);
          })
          .catch(() => {
            // Sin servidor (Edición de Escritorio o despliegue estático) se mantiene
            // la simulación local: este panel es una demostración de interfaz.
          });
      }, 2000);
    } else {
      setNodes(0);
    }
    return () => clearInterval(interval);
  }, [isMining, cpuCap]);

  // Use stats from hook
  const effectiveHashRate = isMining ? stats.hashRate : 0;
  const effectiveCpuLoad = isMining ? stats.cpu : 0;

  return (
    <div className="p-10 max-w-6xl mx-auto space-y-8">
      {/* Aviso de honestidad: este módulo no mina nada */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="text-[11px] leading-relaxed text-amber-100/90">
          <span className="font-bold uppercase tracking-wider text-amber-300">Simulación · </span>
          este panel es una demostración de interfaz. <span className="font-semibold">No realiza ningún cálculo
          criptográfico, no se conecta a ninguna red ni genera ingresos.</span> Todos los valores son ficticios y se
          calculan localmente. El equipo del proyecto ha decidido mantenerlo únicamente como muestra visual y no
          implementar minería real.
        </div>
      </div>

      {/* Header Info */}
      <div className="flex items-end justify-between border-b border-border-subtle pb-6">
        <div className="space-y-1">
          <h2 className="text-sm font-bold tracking-[0.3em] text-gray-500 uppercase">Módulo de demostración</h2>
          <p className="text-3xl font-light text-white">Estado del <span className="text-brand-magenta">Terminal</span></p>
        </div>
        <div className="text-right">
           <div className="text-[10px] uppercase font-mono tracking-tighter text-gray-600 mb-1">X-Token acumulado (demostración)</div>
           <div className="text-2xl font-bold font-mono text-brand-cyan mb-2">{earnings.toFixed(8)}</div>
           <div className="flex gap-4 justify-end">
              <div className="text-right">
                <div className="text-[8px] uppercase font-mono tracking-tighter text-gray-500">User (70%)</div>
                <div className="text-xs font-bold font-mono text-white">{(earnings * 0.7).toFixed(8)}</div>
              </div>
              <div className="text-right">
                <div className="text-[8px] uppercase font-mono tracking-tighter text-gray-500">Platform (30%)</div>
                <div className="text-xs font-bold font-mono text-gray-600">{(earnings * 0.3).toFixed(8)}</div>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Control Panel */}
        <div className="col-span-12 lg:col-span-4 card p-8 flex flex-col relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-grad-x" />
           
           <div className="flex items-center justify-between mb-8">
             <div className="h-10 w-10 rounded-lg bg-[#141418] border border-white/5 flex items-center justify-center">
                <Cpu className={cn("text-brand-magenta", isMining && "animate-pulse")} size={20} />
             </div>
             <span className={cn(
               "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border",
               isMining ? "text-brand-cyan border-brand-cyan/40" : "text-gray-600 border-white/5"
             )}>
               {isMining ? "SIMULANDO" : "OFFLINE"}
             </span>
           </div>

           <div className="space-y-1 mb-8">
             <div className="text-4xl font-bold font-mono text-white">{effectiveHashRate.toFixed(1)} <span className="text-xs text-gray-600 ml-1">MH/s</span></div>
             <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Navegador Local</div>
           </div>

           <div className="space-y-8 flex-1">
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
                   <span>Carga del Sistema</span>
                   <span className={isMining ? "text-brand-cyan" : "text-gray-700"}>{effectiveCpuLoad.toFixed(0)}%</span>
                </div>
                <div className="w-full h-1.5 bg-[#1a1a1c] rounded-full overflow-hidden">
                   <div 
                    className="h-full bg-brand-cyan transition-all duration-1000" 
                    style={{ width: `${effectiveCpuLoad}%` }}
                   />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-[#141418] p-4 rounded-xl border border-white/5">
                    <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1">Nodos Activos</div>
                    <div className="text-sm font-bold font-mono">{nodes}</div>
                 </div>
                 <div className="bg-[#141418] p-4 rounded-xl border border-white/5">
                    <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 text-brand-cyan">Batería</div>
                    <div className="text-sm font-bold font-mono flex items-center gap-2">
                       {batteryLevel.toFixed(0)}%
                       <span className={cn(
                         "h-2 w-2 rounded-full",
                         batteryLevel > 50 ? "bg-green-500" : batteryLevel > 20 ? "bg-yellow-500" : "bg-red-500 animate-pulse"
                       )} />
                    </div>
                 </div>
                 <div className="bg-[#141418] p-4 rounded-xl border border-white/5 text-left">
                    <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 text-brand-cyan">Energía</div>
                    <button 
                      onClick={() => setIsPluggedIn(!isPluggedIn)}
                      className="text-[10px] font-bold font-mono uppercase bg-transparent border-none text-gray-400 hover:text-white"
                    >
                      {isPluggedIn ? "CA (CARGANDO)" : "BATERÍA"}
                    </button>
                 </div>
                 <div className="bg-[#141418] p-4 rounded-xl border border-white/5 text-left">
                    <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 text-brand-magenta">Usuario</div>
                    <button 
                      onClick={() => setIsIdle(!isIdle)}
                      className="text-[10px] font-bold font-mono uppercase bg-transparent border-none text-gray-400 hover:text-white"
                    >
                      {isIdle ? "IDLE (INACTIVO)" : "ACTIVO"}
                    </button>
                 </div>
              </div>

              {isMining && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 pt-4 border-t border-white/5"
                >
                   <div className="flex justify-between items-center">
                     <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Intensidad Nodo</span>
                     <span className="text-[10px] font-mono text-brand-magenta">{cpuCap}%</span>
                   </div>
                   <input 
                     type="range"
                     min="10"
                     max="80"
                     step="5"
                     value={cpuCap}
                     onChange={(e) => setCpuCap(Number(e.target.value))}
                     className="w-full h-1 bg-[#1a1a1c] rounded-lg appearance-none cursor-pointer accent-brand-magenta"
                   />
                   <label className="flex items-center gap-2 cursor-pointer group">
                     <input 
                       type="checkbox"
                       checked={autoStopBattery}
                       onChange={(e) => setAutoStopBattery(e.target.checked)}
                       className="rounded border-white/10 bg-space-black text-brand-cyan"
                     />
                     <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest group-hover:text-gray-300">Auto-stop batería baja (20%)</span>
                   </label>
                </motion.div>
              )}
           </div>

           <button 
            onClick={() => {
              if (isMining) {
                setIsMining(false);
              } else {
                setIsConsentModalOpen(true);
              }
            }}
            disabled={batteryLevel < 20 && !isMining}
            className={cn(
              "mt-8 w-full py-3 rounded-lg font-bold uppercase tracking-widest text-xs transition-all",
              isMining 
                ? "bg-[#1e1e24] text-white border border-white/5 hover:bg-white/10" 
                : (batteryLevel < 20 ? "bg-red-500/10 text-red-500 border border-red-500/20 cursor-not-allowed" : "btn-primary !py-2 text-black")
            )}
           >
             {batteryLevel < 20 && !isMining ? "Batería Crítica" : isMining ? "Detener simulación" : "Iniciar simulación"}
           </button>
        </div>

        {/* Charts and Network Stats */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
           <div className="card p-8 h-[380px] relative overflow-hidden">
              <h2 className="panel-header">Real-time Performance Overlay</h2>
              
              <div className="h-64 w-full mt-8">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data}>
                    <defs>
                      <linearGradient id="colorHash" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff3cac" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ff3cac" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis dataKey="name" hide />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f1720', border: '1px solid #232c38', borderRadius: '8px', fontSize: '10px' }}
                      itemStyle={{ color: '#ff3cac' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="hash" 
                      stroke="#ff3cac" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorHash)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="absolute bottom-6 left-8 right-8 flex justify-between items-center text-[10px] font-mono text-gray-600">
                 <div className="flex gap-4">
                   <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-brand-magenta" /> Tráfico simulado</div>
                   <div className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-brand-cyan" /> Sincronización simulada</div>
                 </div>
                 <span>STABLE_IDLE: 12ms</span>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isConsentModalOpen && (
          <MinerConsentModal 
            onAccept={(cap) => {
              console.log(`Setting CPU cap to ${cap}%`);
              setCpuCap(cap);
              setIsConsentModalOpen(false);
              setIsMining(true);
            }} 
            onDecline={() => setIsConsentModalOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
