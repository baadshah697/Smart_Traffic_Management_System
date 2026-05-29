import { useEffect, useState } from 'react';
import axios from 'axios';
import { Award, ShieldAlert, Search, Star } from 'lucide-react';

const OfficerAudit = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAudit = async () => {
    const token = localStorage.getItem('access_token');
    try {
      const res = await axios.get('http://127.0.0.1:8000/admin/module/audit/performance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
      setLoading(false);
    } catch (err) { console.error("Audit Sync Failed"); setLoading(false); }
  };

  useEffect(() => { fetchAudit(); }, []);

  if (loading) return <div className="p-20 text-red-500 animate-pulse font-black uppercase italic">Syncing Strategic Data...</div>;

  return (
    <div className="p-12 animate-in fade-in zoom-in-95 duration-700">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Personnel <span className="text-red-600">Audit</span></h2>
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em] mt-2">Bhopal PTU Intelligence-Led Ranking</p>
        </div>
        <div className="bg-white/5 border border-white/5 px-6 py-3 rounded-2xl flex items-center gap-3">
            <Search size={14} className="text-white/20" />
            <input type="text" placeholder="Search Badge..." className="bg-transparent border-none outline-none text-[10px] font-black uppercase text-white placeholder:text-white/10 w-32" />
        </div>
      </div>

      <div className="bg-white/5 border border-white/5 rounded-[3.5rem] overflow-hidden backdrop-blur-xl admin-scrollbar">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest text-center">Rank</th>
              <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest">Officer Identity</th>
              <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest">Status</th>
              <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest">Revenue</th>
              <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest">Efficiency Index</th>
              <th className="p-8 text-[10px] font-black uppercase text-white/30 tracking-widest">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((officer, i) => (
              <tr key={i} className="hover:bg-white/[0.03] transition-colors group">
                <td className="p-8 font-black italic text-white/20 text-3xl text-center">#{i + 1}</td>
                <td className="p-8">
                  <div className="flex items-center gap-6">
                    <div className="h-12 w-12 bg-red-600/20 rounded-2xl flex items-center justify-center text-red-500 font-black italic border border-red-500/20">
                      {officer.badge ? officer.badge.substring(0,1) : 'O'}
                    </div>
                    <div>
                        <span className="font-black text-white uppercase tracking-widest block">{officer.badge || 'UNKNOWN'}</span>
                        {/* 🔥 STRATEGIC ALIGNMENT BADGE */}
                        {officer.is_strategic && (
                            <span className="flex items-center gap-1 text-[8px] font-black text-yellow-500 uppercase mt-1">
                                <Star size={10} fill="#eab308" /> Oracle Aligned
                            </span>
                        )}
                    </div>
                  </div>
                </td>
                <td className="p-8">
                   <span className="bg-white/5 px-4 py-2 rounded-lg font-black text-white/40 text-[10px]">{officer.total_issued} Issued</span>
                </td>
                <td className="p-8 font-black text-green-500 italic text-xl">₹{officer.revenue_generated}</td>
                <td className="p-8">
                   <div className="flex items-center gap-4">
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden w-32">
                         <div className="h-full bg-red-600" style={{ width: `${officer.efficiency}%` }} />
                      </div>
                      <span className="text-xs font-black text-white">{officer.efficiency}%</span>
                   </div>
                </td>
                <td className="p-8">
                   <button className="p-4 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all">
                      <ShieldAlert size={20} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OfficerAudit;