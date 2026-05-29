import { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend 
} from 'recharts';
import { apiService } from '../api/apiService';
import { 
  AlertCircle, Camera, FileText, Car, Activity, Zap, 
  ShieldCheck, PlusCircle, X, Send, ShieldAlert
} from 'lucide-react';

const OfficerDashboard = () => {
  const design = {
    pageBg: "#020617",
    textColor: "#F8FAFC",
    accentColor: "#9333ea",
    secondaryAccent: "#3b82f6",
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
  };

  const [stats, setStats] = useState({ violations: 0, activeNodes: 0, accidents: 0, congestion: 0 });
  const [parkingData, setParkingData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSystemOnline, setIsSystemOnline] = useState(true);
  const [selectedCam, setSelectedCam] = useState<any>(null);

  const [showTerminal, setShowTerminal] = useState(false);
  const [challanForm, setChallanForm] = useState({ 
    plate: '', 
    type: 'No Helmet',
    owner: 'Unknown' 
  });

  useEffect(() => {
    const fetchDashboardData = async (isHeartbeat = false) => {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const saved = localStorage.getItem('selected_camera');
      if (saved) setSelectedCam(JSON.parse(saved));

      try {
        if (!isHeartbeat) setLoading(true);
        const [vRes, cRes, tRes, pRes, aRes] = await Promise.all([
          apiService.getViolations(),
          apiService.getCameras(),
          apiService.getCongestion(),
          apiService.getParking(),
          apiService.getAccidentAnalytics() 
        ]);

        // 🔥 UPDATED CALCULATION: Summing actual injuries and fatalities
        const totalAccidentImpact = aRes.data?.reduce((sum: number, m: any) => 
            sum + (m.injuries || 0) + (m.fatalities || 0), 0) || 0;

        setStats({
          violations: vRes.data?.length || 0,
          activeNodes: cRes.data?.filter((cam: any) => cam.is_active).length || 0,
          accidents: totalAccidentImpact, // Total life-impact count
          congestion: tRes.data?.filter((r: any) => r.is_closed).length || 0
        });

        // 🔥 Map data to show injuries and fatalities separately in the chart
        setAnalytics(aRes.data || []);
        
        if (pRes.data && pRes.data.length > 0) {
          const mainLot = pRes.data[0];
          const capacity = mainLot.total_capacity || mainLot.total_slots || 0;
          const occupied = mainLot.occupied || 0;
          setParkingData([
            { name: 'Occupied', value: occupied },
            { name: 'Available', value: Math.max(0, capacity - occupied) },
          ]);
        }
        setIsSystemOnline(true);
        setLoading(false);
      } catch (err) {
        setIsSystemOnline(false);
        setLoading(false);
      }
    };
    fetchDashboardData();
    const heartbeat = setInterval(() => fetchDashboardData(true), 15000); // 15s faster heartbeat
    return () => clearInterval(heartbeat);
  }, []);

  const handleIssueChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        violation_type: challanForm.type,
        plate_number: challanForm.plate.toUpperCase(),
        camera_id: selectedCam.id,
        evidence_image_url: "manual_entry",
        confidence_score: 1.0
      };
      
      await apiService.issueChallan(payload);
      alert(`SUCCESS: Challan issued at ${selectedCam.location_name}`);
      setShowTerminal(false);
      setChallanForm({ plate: '', type: 'No Helmet', owner: 'Unknown' });
    } catch (err) {
      alert("Enforcement Sync Failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#020617]">
        <Activity className="animate-spin text-purple-600 mb-4" size={48} />
        <span className="font-black text-white/40 uppercase tracking-[0.3em] italic animate-pulse">Syncing Command Center...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-y-auto p-8 font-sans transition-all duration-700"
         style={{ backgroundColor: design.pageBg, color: design.textColor }}>
      
      {/* Glow Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10 pointer-events-none"
           style={{ background: `radial-gradient(circle, ${design.accentColor} 0%, transparent 70%)` }}></div>

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-12">
          <div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Bhopal Traffic HQ</h2>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-2">Central AI Surveillance Terminal</p>
          </div>
          
          <div className="flex flex-wrap gap-4">
             {selectedCam && (
                <div style={{ backgroundColor: 'rgba(147, 51, 234, 0.1)', borderColor: design.accentColor }}
                     className="flex items-center gap-6 border px-8 py-4 rounded-3xl animate-in fade-in zoom-in duration-500">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="text-purple-400" size={18} />
                        <div>
                            <p className="text-[8px] font-black uppercase text-purple-400">Patrolling Hotspot</p>
                            <p className="text-sm font-black italic uppercase tracking-tight">{selectedCam.location_name}</p>
                        </div>
                    </div>
                    <button 
                      onClick={() => setShowTerminal(true)}
                      className="bg-white text-black px-6 py-2 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-purple-600 hover:text-white transition-all flex items-center gap-2"
                    >
                      <PlusCircle size={14} /> Issue Challan
                    </button>
                </div>
             )}

             <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
                  className="flex items-center gap-4 border backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                    Network: {isSystemOnline ? 'Encrypted' : 'Interrupted'}
                  </span>
                  <div className={`h-2 w-2 rounded-full animate-pulse ${isSystemOnline ? 'bg-green-500' : 'bg-red-500 shadow-[0_0_10px_red]'}`}></div>
             </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Violations', val: stats.violations, color: 'text-purple-400', icon: <FileText size={20}/>, glow: 'rgba(147, 51, 234, 0.1)' },
            { label: 'Nodes Active', val: stats.activeNodes, color: 'text-blue-400', icon: <Camera size={20}/>, glow: 'rgba(59, 130, 246, 0.1)' },
            { label: 'Accident Impact', val: stats.accidents, color: 'text-red-400', icon: <AlertCircle size={20}/>, glow: 'rgba(244, 63, 94, 0.1)' },
            { label: 'Congestion', val: stats.congestion, color: 'text-orange-400', icon: <Car size={20}/>, glow: 'rgba(249, 115, 22, 0.1)' },
          ].map((card, i) => (
            <div key={i} style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder, boxShadow: `0 0 40px ${card.glow}` }}
                 className="p-8 rounded-[2.5rem] border backdrop-blur-xl group hover:scale-[1.02] transition-all cursor-crosshair">
              <div className={`p-4 w-fit rounded-2xl bg-white/5 mb-6 ${card.color} group-hover:bg-white group-hover:text-black transition-colors`}>{card.icon}</div>
              <p className="text-white/30 text-[9px] font-black uppercase tracking-widest">{card.label}</p>
              <p className={`text-4xl font-black ${card.color} mt-2 tracking-tighter`}>{card.val}</p>
            </div>
          ))}
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
               className="lg:col-span-2 p-10 rounded-[3.5rem] border backdrop-blur-xl">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black italic uppercase tracking-tight">Accident Analytics (Monthly)</h3>
                <Zap size={18} className="text-purple-400 animate-bounce" />
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 'bold'}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 'bold'}} dx={-10} />
                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ backgroundColor: '#0f172a', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: '30px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold'}} />
                    {/* 🔥 Visualizing Injuries vs Fatalities based on SQL Data */}
                    <Bar dataKey="injuries" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={12} name="Injuries" />
                    <Bar dataKey="fatalities" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={12} name="Fatalities" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
          </div>

          <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
               className="p-10 rounded-[3.5rem] border backdrop-blur-xl flex flex-col items-center">
            <h3 className="text-xl font-black italic uppercase tracking-tight mb-10 text-center w-full">Parking Load</h3>
            <div className="h-64 w-full flex flex-col items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={parkingData} innerRadius={75} outerRadius={100} paddingAngle={12} dataKey="value" stroke="none">
                    <Cell fill="#9333ea" />
                    <Cell fill="rgba(255,255,255,0.05)" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                  <span className="text-4xl font-black text-white italic">{parkingData[0]?.value || 0}</span>
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em] mt-1">Occupied</span>
              </div>
            </div>
            <div className="mt-10 p-5 bg-white/5 rounded-2xl border border-white/5 w-full text-center">
                <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">Sensor ID: DB-MALL-LOT1</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enforcement Terminal Modal (Unchanged) */}
      {showTerminal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#0f172a] border border-white/10 rounded-[4rem] p-12 w-full max-w-xl shadow-[0_0_80px_rgba(147,51,234,0.2)] relative">
            <button onClick={() => setShowTerminal(false)} className="absolute top-10 right-10 text-white/20 hover:text-white transition-colors">
              <X size={32}/>
            </button>
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-purple-600 rounded-2xl"><ShieldAlert className="text-white" size={24} /></div>
              <div>
                <h3 className="text-3xl font-black italic uppercase text-white tracking-tighter">Enforcement Terminal</h3>
                <p className="text-[9px] text-purple-400 font-black uppercase tracking-[0.3em] mt-1">Location: {selectedCam.location_name}</p>
              </div>
            </div>
            <form onSubmit={handleIssueChallan} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase ml-4">Vehicle Plate Number</label>
                <input required placeholder="MP04AB1234" className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-sm font-black font-mono text-white outline-none focus:border-purple-500 transition-all placeholder:text-white/10"
                       onChange={e => setChallanForm({...challanForm, plate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase ml-4">Violation Type</label>
                <select className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-sm font-black text-white outline-none focus:border-purple-500 appearance-none"
                        onChange={e => setChallanForm({...challanForm, type: e.target.value})}>
                  <option value="No Helmet">No Helmet</option>
                  <option value="Triple Riding">Triple Riding</option>
                  <option value="Wrong Side">Wrong Side</option>
                  <option value="Speeding">Speeding</option>
                </select>
              </div>
              <button className="w-full bg-purple-600 text-white p-7 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-4 hover:bg-white hover:text-black transition-all shadow-xl active:scale-95">
                <Send size={18} /> Authorize & Sync
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerDashboard;