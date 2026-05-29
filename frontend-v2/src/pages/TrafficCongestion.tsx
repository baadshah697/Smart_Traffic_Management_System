import { useEffect, useState } from 'react';
import { apiService } from '../api/apiService';
import { Car, MapPin, RefreshCcw, Activity, Zap, Navigation, ShieldAlert, Timer } from 'lucide-react';

const TrafficCongestion = () => {
  const design = {
    pageBg: "#020617",
    accentColor: "#f97316", 
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
  };

  const [roads, setRoads] = useState<any[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTraffic = async () => {
    try {
      const response = await apiService.getCongestion();
      // Ensure we sort by name or ID to keep the UI stable during updates
      const sortedData = (response.data || []).sort((a: any, b: any) => a.road_name.localeCompare(b.road_name));
      setRoads(sortedData);
      setError(false);
    } catch (err) {
      console.error("Telemetry Link Interrupted");
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraffic();
    // 🔥 REAL-TIME SYNC: Matches the OMEN 16 GPU's live telemetry processing speed
    const interval = setInterval(fetchTraffic, 3000); 
    return () => clearInterval(interval);
  }, []);

  if (error || (!loading && roads.length === 0)) {
    return (
      <div className="flex-1 relative flex flex-col items-center justify-center p-8 overflow-hidden" style={{ backgroundColor: design.pageBg }}>
        <div className="absolute inset-0 bg-red-500/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
             className="relative z-10 p-16 rounded-[4rem] border backdrop-blur-3xl flex flex-col items-center text-center max-w-lg shadow-2xl">
          <RefreshCcw size={64} className="text-white/10 mb-8 animate-spin-slow" />
          <h2 className="text-white/40 font-black italic uppercase tracking-[0.4em] text-xl">Telemetry Lost</h2>
          <p className="text-white/20 text-[10px] font-black mt-4 uppercase tracking-[0.3em] leading-relaxed">
            CRITICAL: UNABLE TO ESTABLISH LINK WITH BHOPAL SMART CITY GRID. CHECK BACKEND.
          </p>
          <button onClick={() => window.location.reload()} className="mt-10 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase text-white hover:bg-white hover:text-black transition-all">
            Retry Protocol
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-y-auto p-8 font-sans transition-all duration-700 admin-scrollbar"
         style={{ backgroundColor: design.pageBg, color: "#ffffff" }}>
      
      {/* Background Glow Effect */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10 pointer-events-none"
           style={{ background: `radial-gradient(circle, ${design.accentColor} 0%, transparent 70%)` }}></div>

      <div className="relative z-10 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-4">
              <div className="p-3 bg-orange-500 rounded-2xl shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                <Car size={28} className="text-white" />
              </div>
              Congestion <span className="text-orange-500">Monitor</span>
            </h1>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-3 italic">
              BTU AI GRID — Dynamic Traffic Management Hub
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-md">
            <Activity size={14} className="text-green-500 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/60">Live Node Telemetry Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {roads.map((road) => {
            const currentLevel = road.congestion_level || 0;
            const isHighCongestion = currentLevel >= 80;
            const signalState = (road.current_state || 'red').toLowerCase();
            const isEmergency = road.is_emergency;

            return (
              <div key={road.id} 
                   style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
                   className={`p-8 rounded-[3.5rem] border backdrop-blur-xl group hover:scale-[1.02] transition-all duration-500 shadow-2xl relative overflow-hidden ${
                     isEmergency ? 'border-red-500 ring-4 ring-red-500/10' : 'hover:border-orange-500/30'
                   }`}>
                
                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                <div className="flex justify-between items-start mb-8">
                  {/* 🚦 AI SIGNAL STATE: Matches Statement 7 requirements */}
                  <div className="flex flex-col gap-1.5 p-3 bg-black/40 rounded-2xl border border-white/5">
                    <div className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${signalState === 'red' ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-red-900/20'}`} />
                    <div className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${signalState === 'yellow' ? 'bg-yellow-500 shadow-[0_0_10px_#eab308]' : 'bg-yellow-900/20'}`} />
                    <div className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${signalState === 'green' ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-green-900/20'}`} />
                  </div>
                  
                  <div className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-500 ${
                    isEmergency 
                      ? 'bg-red-500 text-white border-red-400 animate-pulse' 
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                  }`}>
                    {isEmergency ? '🚨 Emergency Override' : `🟢 Signal: ${signalState}`}
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className={`text-2xl font-black tracking-tighter italic uppercase transition-colors ${isHighCongestion || isEmergency ? 'text-red-500' : 'text-white group-hover:text-orange-400'}`}>
                    {road.road_name}
                  </h3>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 opacity-30">
                      <Navigation size={12} />
                      <p className="text-[10px] font-black uppercase tracking-widest">{road.area} Sector</p>
                    </div>
                    <span className="text-[9px] font-mono text-white/40 uppercase">Vehicles: {road.vehicle_count || 0}</span>
                  </div>
                </div>
                
                <div className="mt-auto space-y-4">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                    <span className="text-white/20">Congestion Load</span>
                    <span className={isHighCongestion ? 'text-red-500 animate-pulse font-black' : 'text-orange-500'}>
                      {currentLevel}%
                    </span>
                  </div>

                  {/* 🏎️ DYNAMIC PROGRESS BAR: Visual density feedback */}
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden shadow-inner border border-white/5">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out ${
                        isHighCongestion 
                          ? 'bg-red-600 shadow-[0_0_15px_#ef4444]' 
                          : 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]'
                      }`} 
                      style={{ width: `${currentLevel}%` }} 
                    />
                  </div>

                  <div className="pt-4 flex items-center justify-between border-t border-white/5">
                      <div className="flex items-center gap-2 text-white/30">
                        <Timer size={12} />
                        <span className="text-[8px] font-black uppercase tracking-widest">{road.recommended_time}s Phase</span>
                      </div>
                      <div className="flex items-center gap-2 text-white/30">
                        <Zap size={12} />
                        <span className="text-[8px] font-black uppercase tracking-widest italic">Node: {road.camera_id?.slice(0,6) || 'AI_VIRT'}</span>
                      </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TrafficCongestion;