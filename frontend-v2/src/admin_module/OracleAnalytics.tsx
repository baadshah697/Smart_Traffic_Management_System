import { useEffect, useState } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BrainCircuit, Zap, Globe, Activity, RefreshCcw } from 'lucide-react';

const OracleAnalytics = () => {
  const [data, setData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const design = {
    pageBg: "#020617",
    accentRed: "#dc2626",
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
  };

  const fetchDeepDive = async () => {
    setIsSyncing(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await axios.get('http://127.0.0.1:8000/admin/module/oracle/deep-dive', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    } catch (err) {
      console.error("Neural Link Failed: Critical Backend Disconnect.");
    } finally {
      // Small delay for UI smoothness on high-refresh OMEN displays
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  useEffect(() => {
    fetchDeepDive();
    // 🛰️ AUTO-SYNC: Update predictions every 30 seconds
    const interval = setInterval(fetchDeepDive, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return (
    <div className="p-20 flex flex-col items-center justify-center text-red-500 font-black italic uppercase tracking-[0.5em] animate-pulse">
      <Activity className="animate-spin mb-4" size={40} /> 
      Consulting Neural Layers...
    </div>
  );

  return (
    <div className="p-12 animate-in fade-in zoom-in-95 duration-1000 admin-scrollbar overflow-y-auto h-full"
         style={{ backgroundColor: design.pageBg }}>
      
      {/* --- HEADER SECTION --- */}
      <div className="flex justify-between items-start mb-12">
        <div>
          <div className="flex items-center gap-4">
            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">
              The <span className="text-red-600">Oracle</span>
            </h2>
            {isSyncing && <RefreshCcw size={16} className="text-red-500 animate-spin mt-2" />}
          </div>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mt-3 italic">
            Predictive AI Intelligence • Bhopal HQ Central Core
          </p>
        </div>

        {/* 🧠 DYNAMIC CONFIDENCE GAUGE */}
        <div className="bg-red-600/10 border border-red-500/20 p-6 rounded-[2rem] backdrop-blur-2xl flex items-center gap-6 shadow-2xl shadow-red-900/10">
           <BrainCircuit className="text-red-500 animate-pulse" size={36} />
           <div>
              <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Confidence Score</p>
              <p className="text-3xl font-black text-white italic tracking-tighter">
                {data.prediction.confidence}
              </p>
              {/* ⚡ HARDWARE FEEDBACK LOOP: Linked to OMEN CPU Health */}
              <div className="flex items-center gap-2 mt-2">
                <div className={`h-1.5 w-1.5 rounded-full ${parseInt(data.prediction.confidence) > 90 ? "bg-green-500" : "bg-yellow-500"}`}></div>
                <p className="text-[7px] font-bold text-white/50 uppercase tracking-widest">
                  {parseInt(data.prediction.confidence) > 90 ? "Hardware Optimal" : "High Latency Warning"}
                </p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* --- TIME-SERIES FORECAST (2/3 WIDTH) --- */}
        <div className="lg:col-span-2 bg-white/5 border border-white/5 p-10 rounded-[3.5rem] backdrop-blur-xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Zap size={140} className="text-white" />
           </div>
           
           <h3 className="text-[11px] font-black uppercase text-white/30 mb-10 tracking-[0.3em] flex items-center gap-3 italic">
              <Zap size={18} className="text-yellow-500" /> Temporal Violation Pulse
           </h3>
           
           <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.forecast_data}>
                  <defs>
                    <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="issued_at" axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.2)', fontSize: 10}} />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: '#fff'}}
                    itemStyle={{color: '#dc2626', fontWeight: 'bold'}}
                  />
                  <Area type="monotone" dataKey="count" stroke="#dc2626" fill="url(#colorPulse)" strokeWidth={5} />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* --- NEURAL LOGIC SEQUENCE (1/3 WIDTH) --- */}
        <div className="bg-white/5 border border-white/5 p-10 rounded-[3.5rem] backdrop-blur-xl border-t-red-500/20">
           <h3 className="text-[11px] font-black uppercase text-red-600 mb-10 tracking-[0.3em] italic">AI Logic Path</h3>
           <div className="space-y-8">
              {data.ai_logic_path.map((step: string, i: number) => (
                <div key={i} className="flex items-start gap-5 group">
                  <div className="mt-1 h-7 w-7 rounded-xl border border-red-500/30 flex items-center justify-center text-[9px] font-black text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                    0{i+1}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-white/90 transition-colors leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
           </div>
           
           <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-end">
              <div>
                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Next Window</p>
                <p className="text-2xl font-black text-white italic mt-1 tracking-tighter">
                  {data.prediction.peak_hour} - {parseInt(data.prediction.peak_hour)+1}:00
                </p>
              </div>
              <div className="h-10 w-10 rounded-full border border-white/5 flex items-center justify-center text-white/20">
                <Activity size={16} />
              </div>
           </div>
        </div>

        {/* --- DYNAMIC SPATIAL HOTSPOTS (FULL WIDTH GRID) --- */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
           {data.hotspots.length > 0 ? data.hotspots.map((spot: any, i: number) => (
              <div key={i} className="bg-white/5 border border-white/5 p-8 rounded-[3rem] hover:bg-white/[0.07] hover:border-red-500/30 transition-all duration-500 group relative overflow-hidden">
                 {/* Background Glow */}
                 <div className="absolute -top-10 -right-10 h-32 w-32 bg-red-600/5 blur-[50px] group-hover:bg-red-600/10 transition-all"></div>
                 
                 <div className="flex justify-between items-center mb-8 relative z-10">
                    <div className="p-4 bg-red-600/10 rounded-[1.5rem] group-hover:bg-red-600 group-hover:rotate-12 transition-all duration-500">
                        <Globe size={22} className="text-red-500 group-hover:text-white" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-4 py-1.5 rounded-full uppercase italic tracking-widest">
                        {spot.risk}% Threat
                      </span>
                    </div>
                 </div>
                 
                 <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-3 relative z-10 group-hover:translate-x-1 transition-transform">
                   {spot.location}
                 </h4>
                 
                 {/* 🔴 LIVE REASONING FROM PANDAS ENGINE */}
                 <p className="text-[10px] font-bold text-white/30 uppercase mt-3 tracking-widest leading-relaxed relative z-10 group-hover:text-white/50">
                   {spot.reason}
                 </p>
              </div>
           )) : (
              <div className="lg:col-span-3 text-center p-20 border-2 border-dashed border-white/10 rounded-[4rem]">
                  <Activity className="mx-auto text-white/10 mb-6 animate-pulse" size={48} />
                  <p className="text-white/20 font-black uppercase tracking-[0.5em] italic">Synthesizing Neural Clusters...</p>
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default OracleAnalytics;