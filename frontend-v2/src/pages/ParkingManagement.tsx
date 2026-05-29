import { useEffect, useState } from 'react';
import { apiService } from '../api/apiService';
import { ParkingCircle, Plus, Trash2, Edit3, X, Activity, MapPin, Check, FileText, CheckCircle } from 'lucide-react';

const ParkingManagement = () => {
  const design = {
    pageBg: "#020617",
    accentColor: "#3b82f6", 
    secondaryAccent: "#9333ea", 
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
  };

  const [lots, setLots] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', location: '', total_slots: 0 });

  const fetchParking = async () => {
    try {
      const response = await apiService.getParking();
      setLots(response.data);
      const reqRes = await apiService.getParkingRequests();
      setRequests(reqRes.data || []);
      setError(false);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchParking(); 
    const interval = setInterval(fetchParking, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAddLot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // 💡 Sends 0 occupied by default for new lots
      await apiService.createParkingLot({ ...formData, occupied: 0 }); 
      setShowAddModal(false);
      setFormData({ name: '', location: '', total_slots: 0 });
      fetchParking();
    } catch (err) {
      alert("Deployment Failed: Please check your network connection.");
    }
  };

  // 🔥 NEW: Function to update occupancy live
  const handleUpdateOccupancy = async (lot: any, newValue: number) => {
    try {
      await apiService.updateParkingLot(lot.id, {
        name: lot.name,
        location: lot.location,
        total_slots: lot.total_slots,
        occupied: newValue
      });
      fetchParking();
    } catch (err) {
      alert("Sync Failed: Could not update occupancy.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("☢️ BTU COMMAND: Decommission this parking node?")) {
      try {
        await apiService.deleteParkingLot(id);
        fetchParking();
      } catch (err) {
        alert("Action Failed: System could not process the deletion.");
      }
    }
  };

  const handleApproveReq = async (id: string) => {
    try {
      await apiService.approveParkingRequest(id);
      fetchParking();
    } catch(err) {
      alert("Failed to approve. Lot might be full.");
    }
  };

  const handleRejectReq = async (id: string) => {
    try {
      await apiService.rejectParkingRequest(id);
      fetchParking();
    } catch(err) {
      alert("Failed to reject.");
    }
  };

  return (
    <div className="flex-1 relative overflow-y-auto p-8 font-sans transition-all duration-700"
         style={{ backgroundColor: design.pageBg, color: "#ffffff" }}>
      
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10 pointer-events-none"
           style={{ background: `radial-gradient(circle, ${design.accentColor} 0%, transparent 70%)` }}></div>

      <div className="relative z-10">
        <div className="mb-12 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                <ParkingCircle size={28} className="text-white" />
              </div>
              Parking <span className="text-blue-500">Nodes</span>
            </h1>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-3">BTU Logistics & Infrastructure Control</p>
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="group bg-white text-black hover:bg-blue-600 hover:text-white px-8 py-4 rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-2xl active:scale-95"
          >
            <Plus size={16} className="group-hover:rotate-90 transition-transform" /> Deploy New Lot
          </button>
        </div>

        {error || (!loading && lots.length === 0) ? (
          <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
               className="flex flex-col items-center justify-center p-24 rounded-[4rem] border-2 border-dashed border-white/5 backdrop-blur-md">
            <Activity size={48} className="text-white/10 mb-6 animate-pulse" />
            <h2 className="text-white/20 font-black italic uppercase tracking-[0.4em] text-center">Infrastructure Link Offline</h2>
            <button onClick={() => setShowAddModal(true)} className="mt-6 text-blue-500 font-black text-[10px] uppercase tracking-widest hover:text-white transition-colors">Force Manual Initialization</button>
          </div>
        ) : (
          <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
               className="rounded-[3.5rem] border backdrop-blur-xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="p-8 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Infrastructure</th>
                  <th className="p-8 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Sector</th>
                  <th className="p-8 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Real-time Occupancy</th>
                  <th className="p-8 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Quick Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {lots.map((lot) => {
                  const totalSlots = lot.total_slots || lot.total_capacity || 1;
                  const occupancyRate = ((lot.occupied || 0) / totalSlots) * 100;
                  
                  return (
                    <tr key={lot.id} className="hover:bg-white/[0.03] transition-all group cursor-default">
                      <td className="p-8">
                        <div className="flex flex-col">
                            <span className="font-black text-lg text-white tracking-tighter uppercase italic">{lot.name}</span>
                            <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest opacity-60">ID_NODE_{lot.id.slice(0,8)}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-2 text-white/40">
                            <MapPin size={14} className="text-blue-500" />
                            <span className="font-black uppercase text-[10px] tracking-widest">{lot.location || "Central Sector"}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                            <span className={occupancyRate > 90 ? 'text-red-400' : 'text-blue-400'}>
                                {occupancyRate.toFixed(0)}% Load
                            </span>
                            <span className="text-white/20 italic">{lot.occupied || 0} / {totalSlots}</span>
                          </div>
                          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)] ${occupancyRate > 90 ? 'bg-red-500 shadow-red-500/50' : 'bg-blue-500'}`} 
                              style={{ width: `${occupancyRate}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-3">
                            {/* 🔥 NEW: Occupancy Input Wrapper */}
                            <div className="flex items-center bg-white/5 rounded-2xl border border-white/5 p-1 group-hover:border-blue-500/30 transition-all">
                                <input 
                                  type="number" 
                                  defaultValue={lot.occupied}
                                  className="w-14 bg-transparent border-none outline-none font-black text-blue-400 text-center text-xs placeholder:text-white/10"
                                  onBlur={(e) => handleUpdateOccupancy(lot, parseInt(e.target.value))}
                                />
                                <div className="p-2 text-white/10 group-hover:text-blue-500 transition-colors">
                                    <Edit3 size={14} />
                                </div>
                            </div>

                            <button 
                              onClick={() => handleDelete(lot.id)}
                              className="p-4 bg-white/5 hover:bg-red-600 text-white/20 hover:text-white rounded-2xl transition-all border border-white/5"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── PARKING REQUESTS ───────────────────────────────────────────── */}
        <div className="mt-12 mb-6">
           <h2 className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-4 text-white">
              Live Access Requests
           </h2>
           <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-1">Pending Citizen Applications</p>
        </div>

        {requests.length === 0 && !loading && (
          <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
               className="flex flex-col items-center justify-center p-12 rounded-[3.5rem] border backdrop-blur-md">
            <CheckCircle size={32} className="text-green-500/50 mb-3" />
            <h2 className="text-white/40 font-black italic uppercase tracking-[0.2em] text-center text-sm">All Clear. No Pending Approvals.</h2>
          </div>
        )}

        {requests.length > 0 && (
          <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
               className="rounded-[3.5rem] border backdrop-blur-xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="p-8 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Vehicle & Citizen</th>
                  <th className="p-8 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Application Details</th>
                  <th className="p-8 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Action Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.map((req) => (
                    <tr key={req.id} className="hover:bg-white/[0.03] transition-all group cursor-default">
                      <td className="p-8">
                        <div className="flex flex-col">
                            <span className="font-black text-lg text-white tracking-widest">{req.vehicle_number}</span>
                            <span className="text-[9px] text-blue-500 font-black uppercase tracking-widest opacity-60">REQ_ID: {req.id.slice(0,8)}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex flex-col gap-1 text-white/60">
                            <span className="font-black uppercase text-[11px] tracking-widest flex items-center gap-2"><MapPin size={12} className="text-blue-500" /> {req.parking_lots?.name}</span>
                            <span className="font-bold uppercase text-[9px] tracking-widest text-white/40">Reason: {req.reason} • {req.estimated_duration} mins</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className="flex items-center gap-3">
                            <button onClick={() => handleApproveReq(req.id)} className="bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex border border-green-500/20">
                                Verify & Approve
                            </button>
                            <button onClick={() => handleRejectReq(req.id)} className="p-3 bg-white/5 hover:bg-red-600/20 text-white/40 hover:text-red-500 rounded-2xl transition-all border border-white/5 hover:border-red-500/30">
                                <X size={16} />
                            </button>
                        </div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div style={{ backgroundColor: "#0f172a", borderColor: design.glassBorder }}
                 className="rounded-[3rem] p-10 w-full max-w-lg border shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h3 className="font-black italic uppercase text-white text-xl tracking-tight">Expand Infrastructure</h3>
                  <p className="text-[9px] text-white/30 font-black uppercase tracking-widest mt-1">Deploy New BTU Parking Sensor Node</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-white/5 text-white/40 hover:text-white rounded-2xl transition-all">
                  <X size={24}/>
                </button>
              </div>
              
              <form onSubmit={handleAddLot} className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] ml-2">Node Name</label>
                        <input required placeholder="e.g. BITTAN MARKET MULTILEVEL" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all"
                            onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] ml-2">Assigned Sector</label>
                        <input required placeholder="LOCATION AREA" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all"
                            onChange={e => setFormData({...formData, location: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] ml-2">Total Capacity</label>
                        <input required type="number" placeholder="MAX VEHICLE SLOTS" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-black font-mono text-blue-400 outline-none focus:border-blue-500 transition-all"
                            onChange={e => setFormData({...formData, total_slots: parseInt(e.target.value)})} />
                    </div>
                </div>
                <button className="w-full bg-white text-black hover:bg-blue-600 hover:text-white p-6 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl">
                  Deploy BTU Node
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParkingManagement;