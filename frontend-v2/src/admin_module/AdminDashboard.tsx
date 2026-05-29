import { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, AreaChart, Area 
} from 'recharts';
import axios from 'axios';
import { ShieldCheck, DollarSign, Users, Activity, Zap, TrendingUp, CreditCard } from 'lucide-react';

const AdminDashboard = () => {
  // 🎨 ADMIN BRANDING (Crimson & Gold)
  const design = {
    pageBg: "#020617",         
    textColor: "#F8FAFC",      
    accentColor: "#dc2626",    // Crimson Red
    secondaryAccent: "#fbbf24", // Gold
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
  };

  const [stats, setStats] = useState({ revenue: 0, pending: 0, officers: 0, nodes: 0 });
  const [revenueData, setRevenueData] = useState<any[]>([]); // For the Area Chart
  const [violationMix, setViolationMix] = useState<any[]>([]); // For the Pie Chart
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      const token = localStorage.getItem('access_token');
      try {
        setLoading(true);
        const res = await axios.get('http://127.0.0.1:8000/admin/module/stats/all', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const d = res.data;
        setStats({
          revenue: d.revenue || 0,
          pending: d.pending_revenue || 0,
          officers: d.officer_count || 0,
          nodes: d.parking?.length || 0
        });

        // Mapping violation types for the Pie Chart
        setViolationMix(d.violations || []);
        
        // Mocking a revenue trend (or use real back-end trend if available)
        setRevenueData([
          { day: 'Mon', amount: d.revenue * 0.1 },
          { day: 'Tue', amount: d.revenue * 0.2 },
          { day: 'Wed', amount: d.revenue * 0.15 },
          { day: 'Thu', amount: d.revenue * 0.25 },
          { day: 'Fri', amount: d.revenue * 0.3 },
        ]);

        setLoading(false);
      } catch (err) {
        console.error("Dashboard Sync Failed", err);
        setLoading(false);
      }
    };
    fetchAdminData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#020617]">
        <ShieldCheck className="animate-pulse text-red-600 mb-4" size={48} />
        <span className="font-black text-white/40 uppercase tracking-[0.3em] italic">
          Decrypting Financial Records...
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-y-auto p-8 font-sans"
         style={{ backgroundColor: design.pageBg, color: design.textColor }}>
      
      {/* 🌌 Admin Crimson Glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[180px] opacity-10 pointer-events-none"
           style={{ background: `radial-gradient(circle, ${design.accentColor} 0%, transparent 70%)` }}></div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Root <span className="text-red-600">Console</span></h2>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-2">Bhopal PTU Treasury & Oversight</p>
          </div>
          
          <div className="flex items-center gap-4 border border-white/10 backdrop-blur-md px-6 py-3 rounded-2xl bg-white/5">
              <TrendingUp className="text-green-500" size={16} />
              <span className="text-[9px] font-black uppercase tracking-widest opacity-60">System Recovery: 98.4%</span>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Total Revenue', val: `₹${stats.revenue}`, color: 'text-green-400', icon: <DollarSign size={20}/>, glow: 'rgba(34, 197, 94, 0.1)' },
            { label: 'Pending Dues', val: `₹${stats.pending}`, color: 'text-red-500', icon: <CreditCard size={20}/>, glow: 'rgba(239, 68, 68, 0.1)' },
            { label: 'Active Personnel', val: stats.officers, color: 'text-blue-400', icon: <Users size={20}/>, glow: 'rgba(59, 130, 246, 0.1)' },
            { label: 'Infrastructure', val: stats.nodes, color: 'text-amber-400', icon: <Activity size={20}/>, glow: 'rgba(251, 191, 36, 0.1)' },
          ].map((card, i) => (
            <div key={i} style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder, boxShadow: `0 0 40px ${card.glow}` }}
                 className="p-8 rounded-[2.5rem] border backdrop-blur-xl hover:scale-[1.02] transition-all group">
              <div className={`p-4 w-fit rounded-2xl bg-white/5 mb-6 ${card.color} group-hover:bg-red-600 group-hover:text-white transition-colors`}>{card.icon}</div>
              <p className="text-white/30 text-[9px] font-black uppercase tracking-widest">{card.label}</p>
              <p className={`text-3xl font-black ${card.color} mt-2 tracking-tighter italic`}>{card.val}</p>
            </div>
          ))}
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Revenue Trend Area Chart */}
          <div className="lg:col-span-2 p-10 rounded-[3.5rem] border border-white/5 bg-white/5 backdrop-blur-xl">
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black italic uppercase tracking-tight">Revenue Inflow Trend</h3>
                <Zap size={18} className="text-yellow-500 animate-bounce" />
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={design.accentColor} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={design.accentColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.2)', fontSize: 10}} dy={10} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '20px', border: 'none' }} />
                    <Area type="monotone" dataKey="amount" stroke={design.accentColor} strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
          </div>

          {/* Violation Breakdown Pie Chart */}
          <div className="p-10 rounded-[3.5rem] border border-white/5 bg-white/5 backdrop-blur-xl flex flex-col items-center">
            <h3 className="text-xl font-black italic uppercase tracking-tight mb-10 text-center w-full">Violation Mix</h3>
            <div className="h-64 w-full flex flex-col items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={violationMix} innerRadius={70} outerRadius={95} paddingAngle={8} dataKey="count" nameKey="type" stroke="none">
                    {violationMix.map((entry, index) => (
                      <Cell key={index} fill={['#dc2626', '#fbbf24', '#3b82f6', '#a855f7'][index % 4]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '15px', backgroundColor: '#000', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                  <ShieldCheck className="text-white/10" size={40} />
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                {violationMix.slice(0, 4).map((v, i) => (
                  <div key={i} className="flex flex-col p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-[8px] font-black text-white/30 uppercase truncate">{v.type}</span>
                    <span className="text-sm font-black text-white">{v.count}</span>
                  </div>
                ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;