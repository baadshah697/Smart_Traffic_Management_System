import { useEffect, useState } from 'react';
import { apiService } from '../api/apiService';
import { FileDown, PieChart as PieIcon, TrendingUp, ShieldCheck, Activity, CreditCard, Zap, DollarSign } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const Reports = () => {
  // 🎨 DESIGN CONTROL PANEL
  const design = {
    pageBg: "#020617",
    accentColor: "#9333ea", // Purple
    secondaryAccent: "#10b981", // Success Green
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
  };

  const [violationData, setViolationData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalFines: 0, paidCount: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(true);

  const VIOLATION_COLORS = ['#a855f7', '#3b82f6', '#f59e0b', '#10b981'];
  const PAYMENT_COLORS = ['#10b981', '#475569'];

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        const response = await apiService.getViolations(); 
        const data = response.data || [];

        const vCounts = data.reduce((acc: any, curr: any) => {
          acc[curr.violation_type] = (acc[curr.violation_type] || 0) + 1;
          return acc;
        }, {});
        setViolationData(Object.keys(vCounts).map(key => ({ name: key, value: vCounts[key] })));

        const paid = data.filter((v: any) => v.status === 'paid').length;
        const pending = data.filter((v: any) => v.status === 'pending').length;
        
        setPaymentData([
          { name: 'Settled', value: paid },
          { name: 'Outstanding', value: pending }
        ]);

        setSummary({
          totalFines: data.length * 500,
          paidCount: paid,
          pendingCount: pending
        });

        setLoading(false);
      } catch (err) {
        console.error("Report Fetch Error:", err);
        setLoading(false);
      }
    };
    fetchReportData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#020617]">
        <Activity className="animate-spin text-purple-600 mb-4" size={48} />
        <span className="font-black text-white/20 uppercase tracking-[0.4em] italic animate-pulse">
          Decrypting Financial Archives...
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-y-auto p-8 font-sans transition-all duration-700"
         style={{ backgroundColor: design.pageBg, color: "#ffffff" }}>
      
      {/* 🌌 High-Performance Background Auras */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] opacity-10 pointer-events-none"
           style={{ background: `radial-gradient(circle, ${design.accentColor} 0%, transparent 70%)` }}></div>

      <div className="relative z-10">
        {/* Header Section */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-4">
              <div className="p-3 bg-white text-black rounded-2xl">
                <TrendingUp size={28} />
              </div>
              BTU <span className="text-purple-500">Analytics</span>
            </h1>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-3">
              Bhopal Metropolitan Revenue & Performance Audit
            </p>
          </div>
          
          <button className="flex items-center gap-3 bg-white/5 border border-white/10 px-8 py-4 rounded-2xl font-black text-[10px] uppercase text-white hover:bg-white hover:text-black transition-all group">
            <FileDown size={18} className="group-hover:translate-y-0.5 transition-transform" /> 
            Generate PDF Audit
          </button>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
          {/* Violation Chart */}
          <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
               className="p-10 rounded-[3.5rem] border backdrop-blur-xl relative overflow-hidden group">
            <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-3">
                    <PieIcon size={20} className="text-purple-500" /> Violation Distribution
                </h3>
                <Zap size={16} className="text-white/10" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={violationData} innerRadius={80} outerRadius={110} paddingAngle={8} dataKey="value" stroke="none">
                    {violationData.map((_, index) => (
                      <Cell key={`v-cell-${index}`} fill={VIOLATION_COLORS[index % VIOLATION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} 
                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase', opacity: 0.5 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Chart */}
          <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
               className="p-10 rounded-[3.5rem] border backdrop-blur-xl group">
            <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-3">
                    <CreditCard size={20} className="text-green-500" /> Collection Efficiency
                </h3>
                <DollarSign size={16} className="text-white/10" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} innerRadius={80} outerRadius={110} paddingAngle={12} dataKey="value" stroke="none">
                    {paymentData.map((_, index) => (
                      <Cell key={`p-cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} 
                  />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase', opacity: 0.5 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Summary Footer Card */}
        <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
             className="p-10 rounded-[3.5rem] border backdrop-blur-xl flex justify-between items-center shadow-2xl relative overflow-hidden">
          
          {/* Subtle Scanning Light */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-pulse pointer-events-none"></div>

          <div className="flex gap-16 relative z-10">
              <div className="group">
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-3 group-hover:text-purple-500 transition-colors">Total Revenue Logged</p>
                  <p className="text-4xl font-black text-white italic tracking-tighter">
                    ₹{summary.totalFines.toLocaleString()}
                  </p>
              </div>
              <div>
                  <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-3">Recovery Precision</p>
                  <p className="text-4xl font-black text-green-500 italic tracking-tighter">
                      {summary.totalFines > 0 ? ((summary.paidCount / (summary.paidCount + summary.pendingCount)) * 100).toFixed(1) : 0}%
                  </p>
              </div>
          </div>

          <div className="flex items-center gap-6 bg-white/5 border border-white/10 px-8 py-6 rounded-[2.5rem] relative z-10">
              <div className="p-3 bg-purple-500 rounded-2xl shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                <ShieldCheck className="text-white" size={28} />
              </div>
              <div>
                <p className="text-[11px] font-black text-white uppercase tracking-widest leading-tight">
                    BTU Official <br/><span className="text-purple-400">Audit Trail Active</span>
                </p>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;