import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Save, Database, ShieldAlert, Sliders, 
  HardDriveDownload, Activity, Zap, ShieldCheck 
} from 'lucide-react';

const GlobalSettings = () => {
  const [config, setConfig] = useState<any>(null);
  const [localFines, setLocalFines] = useState<any>({}); 
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const res = await axios.get('http://127.0.0.1:8000/admin/module/settings/config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConfig(res.data);
      setLocalFines(res.data.fine_multipliers);
    } catch (err) {
      console.error("Failed to fetch system configuration", err);
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    const token = localStorage.getItem('access_token');
    try {
      // Deploys new rates to Supabase system_configs
      await axios.post('http://127.0.0.1:8000/admin/module/settings/update-fines', 
        { new_fines: localFines }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Visual feedback for the BTU Admin
      alert("CRITICAL UPDATE: System policies updated. AI Engine now enforcing new fine rates.");
    } catch (err) {
      console.error("Deployment failed", err);
      alert("Error: Mainframe write-access denied.");
    } finally {
      setIsDeploying(false);
    }
  };

  const updateLocalFine = (key: string, value: number) => {
    setLocalFines({ ...localFines, [key]: value });
  };

  if (!config) return (
    <div className="p-20 flex flex-col items-center justify-center text-red-500 animate-pulse font-black italic">
      <Activity className="mb-4" />
      ACCESSING CORE MAINFRAME...
    </div>
  );

  return (
    <div className="p-12 animate-in fade-in slide-in-from-top-4 duration-700">
      {/* 🏛️ Header Section */}
      <div className="flex justify-between items-center mb-12">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">
            The <span className="text-red-600">Architect</span>
          </h2>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mt-2 italic">
            Global System Configuration & Scaling
          </p>
        </div>
        
        <button 
          onClick={handleDeploy}
          disabled={isDeploying}
          className={`flex items-center gap-3 px-8 py-4 bg-red-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-xl shadow-red-900/20 active:scale-95 ${isDeploying ? 'opacity-50 cursor-wait' : 'hover:bg-red-700'}`}
        >
          {isDeploying ? <Zap className="animate-spin" size={16} /> : <Save size={16} />}
          Deploy Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* 🛠️ Fine Scaling Module */}
        <div className="bg-white/5 border border-white/5 p-10 rounded-[4rem] backdrop-blur-xl">
          <h3 className="text-sm font-black uppercase text-white/30 mb-8 tracking-widest flex items-center gap-2 italic">
            <Sliders size={16} className="text-red-500" /> Fine Scaling (₹)
          </h3>
          <div className="space-y-10">
            {Object.entries(localFines).map(([key, val]: any) => (
              <div key={key} className="group">
                <div className="flex justify-between mb-4">
                  <span className="text-xs font-black text-white uppercase italic group-hover:text-red-500 transition-colors">
                    {key.replace('_', ' ')} Violation
                  </span>
                  <span className="text-xs font-black text-red-500">₹{val}</span>
                </div>
                <input 
                  type="range" 
                  min="100" 
                  max="5000" 
                  step="50"
                  value={val} 
                  onChange={(e) => updateLocalFine(key, parseInt(e.target.value))}
                  className="w-full accent-red-600 bg-white/5 h-1.5 rounded-full appearance-none cursor-pointer" 
                />
              </div>
            ))}
          </div>
        </div>

        {/* ⚡ System Operations & Hardware Integrity */}
        <div className="space-y-8">
          <div className="bg-white/5 border border-white/5 p-10 rounded-[3rem] backdrop-blur-2xl">
            <h3 className="text-sm font-black uppercase text-white/30 mb-6 tracking-widest flex items-center gap-2 italic">
              <ShieldCheck size={16} className="text-green-500" /> System Integrity
            </h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-black/20 rounded-3xl border border-white/5">
                <p className="text-[8px] font-black text-white/20 uppercase mb-1">AI Engine</p>
                <p className="text-sm font-black text-white italic">DUAL-MODE ACTIVE</p>
              </div>
              <div className="p-6 bg-black/20 rounded-3xl border border-white/5">
                <p className="text-[8px] font-black text-white/20 uppercase mb-1">OMEN Optimization</p>
                <p className="text-sm font-black text-green-500 italic">GPU ACCELERATED</p>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-4 p-4 bg-red-900/10 border border-red-900/20 rounded-2xl">
              <ShieldAlert size={20} className="text-red-500" />
              <p className="text-[9px] font-bold text-red-200/50 uppercase leading-tight">
                Warning: Changes made here override the current local municipal traffic bylaws for Bhopal.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/5 p-8 rounded-[3rem] flex items-center justify-between group cursor-pointer hover:bg-white/10 transition-all">
             <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-600 rounded-2xl group-hover:rotate-12 transition-transform">
                  <Database size={20} className="text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase italic">Manual Database Sync</p>
                  <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Last backup: {config.last_backup}</p>
                </div>
             </div>
             <HardDriveDownload size={20} className="text-white/10 group-hover:text-white transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;