import React, { useState } from 'react';
import { apiService } from '../api/apiService';
import { 
  MapPin, AlertTriangle, FileText, CheckCircle2, 
  Activity, ShieldAlert, Users, Skull, Target 
} from 'lucide-react';

const AccidentReport = () => {
  // 🎨 DESIGN CONTROL PANEL
  const design = {
    pageBg: "#020617",
    accentColor: "#f43f5e", // Urgent Rose/Red
    secondaryAccent: "#9333ea", // Purple
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
  };

  // 🔥 UPDATED STATE: Added latitude and longitude for Heatmap synchronization
  const [formData, setFormData] = useState({ 
    severity: 'Minor', 
    description: '',
    injuries: 0,
    fatalities: 0,
    latitude: 23.2599,  // Default: Bhopal Center
    longitude: 77.4126
  });
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      // 🧠 Payload construction with strict float/integer parsing
      const payload = {
        ...formData,
        injuries: parseInt(formData.injuries.toString()) || 0,
        fatalities: parseInt(formData.fatalities.toString()) || 0,
        latitude: parseFloat(formData.latitude.toString()),
        longitude: parseFloat(formData.longitude.toString())
      };
      
      await apiService.reportAccident(payload);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error("Report failed:", err);
      setStatus('idle');
    }
  };

  return (
    <div className="flex-1 relative overflow-y-auto p-8 flex items-center justify-center font-sans transition-all duration-700"
         style={{ backgroundColor: design.pageBg, color: "#ffffff" }}>
      
      {/* 🌌 Atmospheric Red Alert Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] opacity-10 pointer-events-none animate-pulse"
           style={{ background: `radial-gradient(circle, ${design.accentColor} 0%, transparent 70%)` }}></div>

      <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
           className="relative z-10 backdrop-blur-3xl p-12 rounded-[3.5rem] border shadow-2xl w-full max-w-2xl overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-20"></div>

        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
              Incident <span className="text-red-500">Report</span>
            </h1>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-2">
              BTU Field Unit — Rapid Logging Terminal
            </p>
          </div>
          <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
            <ShieldAlert className="text-red-500" size={24} />
          </div>
        </div>
        
        {status === 'success' ? (
          <div className="text-center py-20 bg-white/5 rounded-[2.5rem] border border-white/5 animate-in zoom-in-95 duration-300">
            <div className="relative inline-block mb-6">
                <CheckCircle2 size={64} className="text-green-500 relative z-10" />
                <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-ping"></div>
            </div>
            <h3 className="text-2xl font-black italic uppercase tracking-tight text-white">Entry Validated</h3>
            <p className="text-white/30 font-black uppercase text-[10px] tracking-widest mt-2">Report Logged in BTU Audit Trail</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500"/> Priority Level
              </label>
              <div className="relative">
                <select 
                  value={formData.severity}
                  className="w-full p-5 bg-white/5 rounded-2xl border border-white/10 outline-none font-black text-xs uppercase tracking-widest text-white appearance-none cursor-pointer focus:border-red-500 transition-all"
                  onChange={e => setFormData({...formData, severity: e.target.value})}
                >
                  <option className="bg-slate-900" value="Minor">Minor (Property Damage)</option>
                  <option className="bg-slate-900" value="Moderate">Moderate (Non-Life Threatening)</option>
                  <option className="bg-slate-900 text-red-400" value="Major">Major / Fatal (Critical Response)</option>
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <Activity size={16} />
                </div>
              </div>
            </div>

            {/* 🔥 GIS DATA: Latitude & Longitude Input */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-red-500/5 p-6 rounded-[2.5rem] border border-red-500/10">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <MapPin size={14} className="text-red-500"/> Latitude
                </label>
                <input 
                  type="number" step="0.0001" required 
                  className="w-full p-5 bg-white/5 rounded-2xl border border-white/10 outline-none font-bold text-white focus:border-red-500 transition-all" 
                  value={formData.latitude}
                  onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value) || 0})} 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Target size={14} className="text-red-500"/> Longitude
                </label>
                <input 
                  type="number" step="0.0001" required 
                  className="w-full p-5 bg-white/5 rounded-2xl border border-white/10 outline-none font-bold text-white focus:border-red-500 transition-all" 
                  value={formData.longitude}
                  onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value) || 0})} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} className="text-red-500"/> Injuries
                </label>
                <input 
                  type="number" min="0" required 
                  className="w-full p-5 bg-white/5 rounded-2xl border border-white/10 outline-none font-bold text-white focus:border-red-500 transition-all" 
                  value={formData.injuries}
                  onChange={e => setFormData({...formData, injuries: parseInt(e.target.value) || 0})} 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Skull size={14} className="text-red-500"/> Fatalities
                </label>
                <input 
                  type="number" min="0" required 
                  className="w-full p-5 bg-white/5 rounded-2xl border border-white/10 outline-none font-bold text-white focus:border-red-500 transition-all" 
                  value={formData.fatalities}
                  onChange={e => setFormData({...formData, fatalities: parseInt(e.target.value) || 0})} 
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-red-500"/> Tactical Summary
              </label>
              <textarea 
                rows={4} required
                placeholder="Describe vehicle types, specific location details, and visible damages..."
                className="w-full p-5 bg-white/5 rounded-2xl border border-white/10 outline-none font-bold text-white focus:border-red-500 focus:bg-white/10 transition-all placeholder:text-white/10 resize-none"
                onChange={e => setFormData({...formData, description: e.target.value})} 
              />
            </div>

            <button 
              disabled={status === 'loading'}
              className="group w-full relative overflow-hidden bg-white text-black hover:bg-red-600 hover:text-white p-6 rounded-2xl font-black uppercase text-xs tracking-[0.3em] transition-all shadow-2xl active:scale-95"
            >
              <span className="relative z-10 flex items-center justify-center gap-3">
                {status === 'loading' ? (
                  <Activity className="animate-spin" size={18} />
                ) : (
                  <>Submit Official Report</>
                )}
              </span>
            </button>
          </form>
        )}

        <div className="mt-10 pt-8 border-t border-white/5 flex justify-center">
            <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.4em]">Secure BTU Field Encryption Protocol v2.4</p>
        </div>
      </div>
    </div>
  );
};

export default AccidentReport;