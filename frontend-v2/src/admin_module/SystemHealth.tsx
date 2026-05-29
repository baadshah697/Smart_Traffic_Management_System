import { useEffect, useState } from 'react';
import axios from 'axios';
import { Cpu, Database, HardDrive, Activity, Zap, ShieldCheck } from 'lucide-react';

const SystemHealth = () => {
  const [vitals, setVitals] = useState<any>(null);
  const [history, setHistory] = useState<number[]>([]); // For the small sparkline effect

  const fetchLiveStatus = async () => {
    const token = localStorage.getItem('access_token');
    try {
      const res = await axios.get('http://127.0.0.1:8000/admin/module/health/live-vitals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVitals(res.data);
      setHistory(prev => [...prev.slice(-10), res.data.cpu]); // Keep last 10 CPU points
    } catch (err) {
      console.error("Health Link Severed");
    }
  };

  useEffect(() => {
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 3000); // 💓 Heartbeat every 3 seconds
    return () => clearInterval(interval);
  }, []);

  if (!vitals) return (
    <div className="p-20 flex flex-col items-center justify-center text-red-500 font-black italic uppercase tracking-widest">
      <Zap className="animate-bounce mb-4" /> Initiating Neural Link...
    </div>
  );

  return (
    <div className="p-12 animate-in fade-in duration-700">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">System <span className="text-red-600">Vitals</span></h2>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mt-2 text-glow">Real-time Hardware Telemetry</p>
        </div>
        <div className="flex items-center gap-3 px-6 py-3 bg-red-600/10 border border-red-500/20 rounded-2xl">
          <div className="h-2 w-2 bg-red-500 rounded-full animate-ping" />
          <span className="text-[9px] font-black text-red-500 uppercase tracking-widest italic">Live Feed Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* CPU Card */}
        <div className="bg-white/5 border border-white/5 p-8 rounded-[3rem] backdrop-blur-xl relative overflow-hidden group">
          <Cpu className="text-red-500 mb-6 group-hover:scale-110 transition-transform" size={24} />
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Core Load</p>
          <p className="text-4xl font-black text-white mt-2 italic">{vitals.cpu}%</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5">
             <div className="h-full bg-red-600 transition-all duration-1000" style={{ width: `${vitals.cpu}%` }} />
          </div>
        </div>

        {/* DB Latency Card */}
        <div className="bg-white/5 border border-white/5 p-8 rounded-[3rem] backdrop-blur-xl group">
          <Database className="text-amber-500 mb-6" size={24} />
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">DB Latency</p>
          <p className="text-4xl font-black text-white mt-2 italic">{vitals.db_latency}ms</p>
          <p className="text-[8px] font-black text-green-500 uppercase mt-2">{vitals.db_status}</p>
        </div>

        {/* Evidence Storage Card */}
        <div className="bg-white/5 border border-white/5 p-8 rounded-[3rem] backdrop-blur-xl group">
          <HardDrive className="text-blue-500 mb-6" size={24} />
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Evidence Disk</p>
          <p className="text-4xl font-black text-white mt-2 italic">{vitals.storage_used}%</p>
          <p className="text-[8px] font-black text-white/20 uppercase mt-2">{vitals.storage_free_gb} GB Remaining</p>
        </div>

        {/* RAM Card */}
        <div className="bg-white/5 border border-white/5 p-8 rounded-[3rem] backdrop-blur-xl group">
          <Activity className="text-purple-500 mb-6" size={24} />
          <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Memory Buffer</p>
          <p className="text-4xl font-black text-white mt-2 italic">{vitals.ram}%</p>
          <p className="text-[8px] font-black text-white/20 uppercase mt-2">OMEN 16 Optimized</p>
        </div>
      </div>

      {/* Network Integrity Section */}
      <div className="mt-10 bg-white/5 border border-white/5 p-10 rounded-[4rem] backdrop-blur-2xl flex items-center justify-between">
         <div className="flex items-center gap-8">
            <div className="p-5 bg-red-600 rounded-3xl shadow-xl shadow-red-600/20">
               <ShieldCheck className="text-white" size={32} />
            </div>
            <div>
               <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Mainframe Security</h3>
               <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mt-1">All encryption protocols nominal</p>
            </div>
         </div>
         <div className="text-right">
            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Last Sync</p>
            <p className="text-xs font-mono text-red-500 mt-1">{new Date().toLocaleTimeString()}</p>
         </div>
      </div>
    </div>
  );
};

export default SystemHealth;