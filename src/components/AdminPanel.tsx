import { useState, useEffect } from 'react';
import { OwnershipPanel } from './OwnershipPanel';
import { 
  Users, 
  ShieldCheck, 
  Activity, 
  Database, 
  RefreshCw,
  Search,
  Settings as SettingsIcon,
  Trash2,
  AlertTriangle,
  Zap,
  Terminal,
  Lock,
  Unlock,
  Bell,
  CheckCircle2,
  XCircle,
  Flag,
  Globe,
  Cpu,
  Server,
  Filter,
  ArrowUpRight,
  ChevronRight
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc,
  query,
  orderBy,
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  earnings: number;
  lastActive: string;
  status?: 'active' | 'flagged' | 'banned';
}

interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'security';
  timestamp: any;
}

interface VPNNode {
  id: string;
  name: string;
  country: string;
  status: 'online' | 'busy' | 'offline';
  load: number;
  type: 'free' | 'premium';
}

type AdminTab = 'users' | 'infrastructure' | 'security' | 'terminal' | 'ownership';

/** Nombres visibles de las pestañas, en lugar del identificador interno. */
const ADMIN_TAB_LABELS: Record<AdminTab, string> = {
  users: 'Usuarios',
  infrastructure: 'Infraestructura',
  security: 'Seguridad',
  terminal: 'Terminal',
  ownership: 'Titularidad',
};

const chartData = [
  { name: '00:00', load: 12, tokens: 400 },
  { name: '04:00', load: 30, tokens: 600 },
  { name: '08:00', load: 75, tokens: 1200 },
  { name: '12:00', load: 45, tokens: 800 },
  { name: '16:00', load: 90, tokens: 1500 },
  { name: '20:00', load: 55, tokens: 950 },
  { name: '23:59', load: 20, tokens: 500 },
];

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const userEmail = db.app.options.projectId; // Simplificado para la demo
  const isRoot = auth.currentUser?.email === 'cryptojacxas@gmail.com';
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [nodes, setNodes] = useState<VPNNode[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [systemStatus, setSystemStatus] = useState<'nominal' | 'maintenance' | 'alert'>('nominal');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEarnings: 0,
    activeNodes: 0,
    flaggedUsers: 0
  });

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];
      setUsers(userData);
      setStats(prev => ({
        ...prev,
        totalUsers: userData.length,
        totalEarnings: userData.reduce((acc, curr) => acc + (curr.earnings || 0), 0),
        flaggedUsers: userData.filter(u => u.status === 'flagged' || u.status === 'banned').length
      }));
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubNodes = onSnapshot(collection(db, 'vpn_nodes'), (snapshot) => {
      const nodeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VPNNode));
      setNodes(nodeData);
      setStats(prev => ({
        ...prev,
        activeNodes: nodeData.filter(n => n.status === 'online').length
      }));
    }, (error) => {
      console.warn('[AdminPanel] vpn_nodes snapshot error:', error);
      handleFirestoreError(error, OperationType.LIST, 'vpn_nodes');
    });

    const unsubLogs = onSnapshot(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(15)), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogEntry)));
    }, (error) => {
      console.warn('[AdminPanel] logs snapshot error:', error);
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    return () => {
      unsubUsers();
      unsubNodes();
      unsubLogs();
    };
  }, []);

  const handleUpdateUserStatus = async (uid: string, status: UserData['status']) => {
    const userRef = doc(db, 'users', uid);
    try {
      await updateDoc(userRef, { status });
      await addDoc(collection(db, 'logs'), {
        message: `AUTHORITY OVERRIDE: User ${uid} protocol marked as ${status ? status.toUpperCase() : 'ACTIVE'}`,
        type: status === 'active' ? 'info' : 'security',
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    try {
      await addDoc(collection(db, 'logs'), {
        message: `ROOT BROADCAST: ${broadcastMessage}`,
        type: 'warning',
        timestamp: serverTimestamp()
      });
      setBroadcastMessage('');
      alert("Comando de difusión enviado con éxito.");
    } catch (error) {
      console.error(error);
    }
  };

  // `h-full min-h-0` en vez de `calc(100vh - 64px)`: la altura fija no tenía en
  // cuenta la barra de pestañas ni la barra de direcciones, así que el panel se
  // salía del contenedor y quedaba cortado por abajo.
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#050507] overflow-hidden">
      {/* Header Bar */}
      <header className="h-16 border-b border-white/5 bg-[#0a0a0c] px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-magenta/10 rounded-lg border border-brand-magenta/20">
              <ShieldCheck size={18} className="text-brand-magenta" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tighter uppercase italic">Control <span className="text-brand-magenta">Alpha-7</span></h1>
              <div className="flex items-center gap-2 text-[7px] font-bold text-brand-cyan tracking-[0.3em] font-mono">
                <span className="h-0.5 w-0.5 rounded-full bg-brand-cyan animate-pulse" />
                KERNEL: ROOT_LEVEL_0
              </div>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-white/5 mx-2" />

          <nav className="flex items-center gap-1" aria-label="Secciones del panel de administración">
            {(['users', 'infrastructure', 'security', 'terminal', 'ownership'] as AdminTab[])
              .filter((tab) => isRoot || tab === 'users' || tab === 'security' || tab === 'ownership')
              .map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest transition-all border border-transparent",
                  activeTab === tab 
                    ? "bg-brand-magenta/10 text-brand-magenta border-brand-magenta/30 shadow-[0_0_10px_rgba(255,60,172,0.1)]" 
                    : "text-gray-600 hover:text-gray-400"
                )}
              >
                {ADMIN_TAB_LABELS[tab]}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex items-center gap-4 text-right">
             <div>
               <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest font-mono">Nodes</p>
               <p className="text-[10px] font-bold text-white font-mono">{stats.totalUsers}</p>
             </div>
             <div className="h-6 w-[1px] bg-white/5" />
             <div>
               <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest font-mono">Health</p>
               <p className="text-[10px] font-bold text-brand-cyan font-mono">99.9%</p>
             </div>
           </div>
           
           <div className={cn(
             "px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-all",
             systemStatus === 'nominal' ? "bg-brand-cyan/5 border-brand-cyan/20 text-brand-cyan" : "bg-red-500/10 border-red-500/20 text-red-500"
           )}>
             <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
             <span className="text-[8px] font-bold uppercase tracking-widest">Sys_{systemStatus}</span>
           </div>
        </div>
      </header>

      {/* Admin Content */}
      <main className="min-h-0 flex-1 overflow-y-auto p-8 custom-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatMetric icon={<Users size={16} />} label="Total Nodes" value={stats.totalUsers} trend="+12" color="magenta" />
                <StatMetric icon={<Database size={16} />} label="Yield Flow" value={stats.totalEarnings.toFixed(2)} trend="+4.5%" color="cyan" />
                <StatMetric icon={<Flag size={16} />} label="Anomalies" value={stats.flaggedUsers} trend="-2" color="yellow" />
                <StatMetric icon={<Zap size={16} />} label="Protocol" value="Kernel_A7" trend="STABLE" color="cyan" />
              </div>

              <div className="card p-0 overflow-hidden border-white/5">
                <div className="p-6 bg-[#141418] border-b border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-8">
                      <h3 className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Identity Intelligence Repository</h3>
                      <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input 
                          type="text" 
                          placeholder="Search identity signature..." 
                          className="bg-black/60 border border-white/5 rounded-lg pl-9 pr-4 py-1.5 text-[9px] font-mono text-gray-400 focus:border-brand-magenta/30 outline-none w-72 transition-all"
                        />
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <button className="p-1.5 border border-white/5 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-all">
                       <Filter size={14} />
                     </button>
                     <button className="p-1.5 border border-white/5 rounded text-gray-500 hover:text-white hover:bg-white/5 transition-all">
                       <RefreshCw size={14} />
                     </button>
                   </div>
                </div>

                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                     <thead>
                       <tr className="bg-black/40 border-b border-white/5">
                         <th className="p-5 text-[8px] font-bold text-gray-600 uppercase tracking-widest font-mono text-center w-20">Type</th>
                         <th className="p-5 text-[8px] font-bold text-gray-600 uppercase tracking-widest font-mono">Entity Signature</th>
                         <th className="p-5 text-[8px] font-bold text-gray-600 uppercase tracking-widest font-mono">Token Yield</th>
                         <th className="p-5 text-[8px] font-bold text-gray-600 uppercase tracking-widest font-mono">Protocol Status</th>
                         <th className="p-5 text-[8px] font-bold text-gray-600 uppercase tracking-widest font-mono text-right">Authority</th>
                       </tr>
                     </thead>
                     <tbody>
                       {users.map(user => (
                         <tr key={user.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-all group">
                           <td className="p-5 text-center">
                             <div className="p-2 bg-white/5 rounded-lg inline-block text-gray-600">
                               <Cpu size={14} />
                             </div>
                           </td>
                           <td className="p-5">
                             <div className="flex items-center gap-4">
                               <div className={cn(
                                 "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[10px] border bg-black transition-all",
                                 user.status === 'banned' ? "border-red-500/40 text-red-500" :
                                 user.status === 'flagged' ? "border-yellow-500/40 text-yellow-500" :
                                 "border-white/10 text-gray-500 group-hover:border-brand-magenta/30"
                               )}>
                                 {user.displayName?.[0] || user.email?.[0]}
                               </div>
                               <div>
                                 <div className="text-[10px] font-bold text-white uppercase tracking-tight">{user.displayName || 'Anon_Node'}</div>
                                 <div className="text-[8px] font-mono text-gray-600">{user.email}</div>
                               </div>
                             </div>
                           </td>
                           <td className="p-5">
                             <div className="text-[11px] font-mono text-brand-cyan tracking-tighter">{user.earnings?.toFixed(8)} <span className="text-[7px] text-gray-800">X-COIN</span></div>
                           </td>
                           <td className="p-5">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest border",
                                user.status === 'banned' ? "border-red-500/30 text-red-500 bg-red-500/5" :
                                user.status === 'flagged' ? "border-yellow-500/30 text-yellow-500 bg-yellow-500/5" :
                                "border-brand-cyan/30 text-brand-cyan bg-brand-cyan/5"
                              )}>
                                {user.status || 'Active'}
                              </span>
                           </td>
                           <td className="p-5 text-right">
                             <div className="flex items-center justify-end gap-2">
                               <button 
                                 onClick={() => handleUpdateUserStatus(user.id, user.status === 'banned' ? 'active' : 'banned')}
                                 className={cn(
                                   "p-2 rounded-lg transition-all",
                                   user.status === 'banned' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                                 )}
                               >
                                 {user.status === 'banned' ? <Unlock size={14} /> : <Lock size={14} />}
                               </button>
                               <button className="p-2 rounded-lg bg-white/5 text-gray-500 hover:text-white">
                                 <SettingsIcon size={14} />
                               </button>
                             </div>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'ownership' && (
            <motion.div
              key="ownership"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <OwnershipPanel />
            </motion.div>
          )}

          {activeTab === 'infrastructure' && isRoot && (
            <motion.div 
              key="infrastructure"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              <div className="lg:col-span-2 space-y-6">
                 <div className="card p-6 h-72 bg-[#141418] border-white/5">
                    <div className="flex items-center justify-between mb-8">
                       <div>
                         <h3 className="text-[10px] font-bold text-white uppercase tracking-[0.2em] mb-1">Network traffic analysis</h3>
                         <p className="text-[9px] text-gray-500 font-mono italic">Packet distribution • Local time 24h</p>
                       </div>
                    </div>
                    <div className="h-40 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={chartData}>
                           <defs>
                             <linearGradient id="colorCyan" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#00f2ff" stopOpacity={0.1}/>
                               <stop offset="95%" stopColor="#00f2ff" stopOpacity={0}/>
                             </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                           <XAxis dataKey="name" fontSize={8} axisLine={false} tickLine={false} stroke="#4b5563" />
                           <Tooltip 
                             contentStyle={{ backgroundColor: '#0a0a0c', border: '1px solid #ffffff10', fontSize: '9px', fontFamily: 'monospace' }}
                             itemStyle={{ color: '#00f2ff' }}
                           />
                           <Area type="monotone" dataKey="load" stroke="#00f2ff" fillOpacity={1} fill="url(#colorCyan)" strokeWidth={2} />
                         </AreaChart>
                       </ResponsiveContainer>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {nodes.map(node => (
                      <div key={node.id} className="card p-5 border-white/5 hover:border-brand-cyan/20 transition-all bg-[#0a0a0c]">
                         <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                               <div className="p-2 rounded-lg bg-brand-cyan/10 text-brand-cyan">
                                 <Server size={12} />
                               </div>
                               <div>
                                 <h4 className="text-[9px] font-bold text-white uppercase tracking-widest">{node.name}</h4>
                                 <p className="text-[8px] text-gray-600 font-mono">{node.country} • {node.type.toUpperCase()}</p>
                               </div>
                            </div>
                            <div className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              node.status === 'online' ? "bg-brand-cyan shadow-[0_0_8px_#00f2ff]" : "bg-red-500"
                            )} />
                         </div>
                         <div className="space-y-2">
                            <div className="flex items-center justify-between text-[8px] font-mono text-gray-500">
                               <span>Load Capacity</span>
                               <span>{node.load}%</span>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                               <div 
                                 className="h-full bg-brand-cyan transition-all duration-1000" 
                                 style={{ width: `${node.load}%` }} 
                               />
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="card p-6 bg-brand-magenta/5 border-brand-magenta/20">
                    <h3 className="text-[9px] font-bold text-brand-magenta uppercase tracking-[0.2em] mb-4">Network Protocols</h3>
                    <div className="space-y-3">
                       <ActionBtn icon={<RefreshCw size={12} />} label="Force Global Resync" />
                       <ActionBtn icon={<Trash2 size={12} />} label="Wipe System Cache" />
                       <ActionBtn 
                         icon={<AlertTriangle size={12} />} 
                         label="KERNEL MAINTENANCE" 
                         color="red"
                         onClick={() => setSystemStatus(systemStatus === 'maintenance' ? 'nominal' : 'maintenance')}
                        />
                    </div>
                 </div>

                 <div className="card p-6 border-white/10">
                    <h3 className="text-[9px] font-bold text-white uppercase tracking-[0.2em] mb-4">Terminal Broadcast</h3>
                    <textarea 
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder="Enter command message..."
                      className="w-full h-24 bg-black/60 border border-white/5 rounded-xl p-3 text-[9px] font-mono text-brand-magenta placeholder:text-gray-800 outline-none focus:border-brand-magenta/40 transition-all mb-4 resize-none"
                    />
                    <button 
                      onClick={handleSendBroadcast}
                      className="w-full py-2.5 rounded-lg bg-brand-magenta text-black text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <Zap size={12} /> EXEC BROADCAST
                    </button>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div 
              key="security"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
               <div className="lg:col-span-2 card p-6 border-white/5 bg-[#141418]">
                  <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-2 text-brand-magenta">
                        <Terminal size={16} />
                        <h3 className="text-[10px] font-bold text-white uppercase tracking-[0.2em]">Live system audit</h3>
                     </div>
                  </div>
                  <div className="space-y-3 max-h-[440px] overflow-y-auto pr-4 custom-scrollbar">
                     {logs.map((log) => (
                       <div key={log.id} className="p-3 rounded-lg bg-black/40 border-l-2 border-white/5 flex gap-3" style={{ borderLeftColor: log.type === 'security' ? '#ff3cac' : log.type === 'warning' ? '#f59e0b' : '#00f2ff33' }}>
                          <span className="text-[9px] font-mono text-gray-700">{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : '..:..'}</span>
                          <div className="flex-1 overflow-hidden">
                             <p className="text-[9px] font-mono text-gray-400 break-all">{log.message}</p>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="card p-6 border-red-500/20 bg-red-500/5">
                     <h3 className="text-[9px] font-bold text-red-500 uppercase tracking-[0.2em] mb-4">Total Lockdown</h3>
                     <button className="w-full py-3 rounded-lg bg-red-500 text-black text-[9px] font-bold uppercase tracking-widest hover:bg-white hover:text-red-500 transition-all">
                       TERMINATE ALL CONNECTIONS
                     </button>
                  </div>
                  
                  <div className="card p-6 border-white/5 h-[340px] flex flex-col justify-between">
                     <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em]">Threat Protection</h3>
                     <div className="space-y-6">
                        {[
                          { l: 'Auth Shield', v: 'ACTIVE', c: 'cyan' },
                          { l: 'IP Rotation', v: 'ROTATING', c: 'magenta' },
                          { l: 'DDoS Defense', v: 'STANDBY', c: 'gray-700' }
                        ].map((s, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-[9px] font-mono text-gray-600 italic">{s.l}</span>
                            <span className={cn("text-[9px] font-bold uppercase", `text-${s.c}`)}>{s.v}</span>
                          </div>
                        ))}
                     </div>
                     <div className="h-12 w-full bg-black rounded-lg border border-white/5 flex items-center justify-center">
                        <Activity size={24} className="text-brand-magenta animate-pulse opacity-40" />
                     </div>
                  </div>
               </div>
            </motion.div>
          )}

          {activeTab === 'terminal' && isRoot && (
            <motion.div 
              key="terminal"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card bg-black border-brand-cyan/20 h-[500px] font-mono p-1 relative overflow-hidden"
            >
               <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_50%,_transparent_0%,_rgba(0,0,0,0.5)_100%)] z-10" />
               <div className="h-6 bg-[#0a0a0c] border-b border-white/5 flex items-center px-4 gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500/50" />
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500/50" />
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500/50" />
               </div>
               <div className="p-8 text-[10px] text-brand-cyan h-[450px] overflow-y-auto custom-scrollbar">
                  <pre className="text-brand-magenta mb-6 leading-none">
{`   _  _   _  _ _  _ ___  _ ____ _ 
  /\\/ \\ |/\\/| |\\/| |__] | |___  \\/ 
 /  \\_/ |  \\| |  | |    | |___ _/\\ `}
                  </pre>
                  <p className="mb-2 italic opacity-50"># Root Authorization Protocol: cryptojacxas@X-KRNL</p>
                  <p className="mb-6">{`>`} Accessing level 0 kernel sub-routines...</p>
                  
                  <div className="space-y-1">
                    <p className="flex gap-3"><span className="text-brand-magenta shrink-0">$ scan --nodes</span> <span className="text-white">Executing cluster-wide scan... Found {stats.totalUsers} active identity signatures.</span></p>
                    <p className="flex gap-3"><span className="text-brand-magenta shrink-0">$ x-link info</span> <span className="text-white">Kernel Version A.7.4 | Uptime [982:12:44] | Memory [24.2 GB]</span></p>
                    <p className="flex gap-3"><span className="text-brand-magenta shrink-0">$ _</span> <span className="animate-pulse">_</span></p>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 60, 172, 0.2); }
      `}</style>
    </div>
  );
}

function StatMetric({ icon, label, value, trend, color }: { icon: any, label: string, value: string | number, trend: string, color: 'magenta' | 'cyan' | 'yellow' }) {
  const accentClass = color === 'magenta' ? "text-brand-magenta" : color === 'cyan' ? "text-brand-cyan" : "text-yellow-500";
  return (
    <div className={cn("card p-5 group hover:border-white/10 transition-all bg-[#0a0a0c]")}>
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-lg bg-black border border-white/5", accentClass)}>
          {icon}
        </div>
        <span className={cn("text-[7px] font-bold px-1.5 py-0.5 rounded border border-white/5", accentClass)}>{trend}</span>
      </div>
      <div className="text-xl font-bold text-white font-mono tracking-tighter mb-0.5">{value}</div>
      <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">{label}</div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, color }: { icon: any, label: string, onClick?: () => void, color?: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full py-2.5 px-4 rounded-lg bg-black border border-white/5 text-[8px] font-bold uppercase tracking-widest flex items-center justify-between hover:bg-white/[0.02] transition-all",
        color === 'red' ? "text-red-500 border-red-500/10" : "text-white"
      )}
    >
      {label}
      <span className="text-gray-600">{icon}</span>
    </button>
  );
}
