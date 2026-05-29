import React, { useState } from 'react';
import { apiService } from '../api/apiService';
import { ShieldAlert, Lock, Mail, Activity, ShieldCheck, User } from 'lucide-react';

const Login = ({ setAuth }: { setAuth: (role: string) => void }) => {
  const design = {
    pageBg: "#020617",
    accentColor: "#9333ea",    // Purple for Officer
    adminColor: "#3b82f6",     // Blue for Admin
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 🔘 New State: Track which section is active
  const [viewMode, setViewMode] = useState<'officer' | 'admin'>('officer');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('username', email); 
    formData.append('password', password);

    try {
      const data = await apiService.login(formData);
      const token = data.access_token;
      const role = data.role; 

      if (token && role) {
        localStorage.setItem('access_token', token);
        localStorage.setItem('user_role', role);
        setAuth(role);
      } else {
        throw new Error("Invalid response from server.");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="h-screen w-screen flex items-center justify-center relative overflow-hidden font-sans transition-colors duration-700"
      style={{ backgroundColor: design.pageBg }}
    >
      {/* 🌌 Dynamic Atmospheric Glows */}
      <div 
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 pointer-events-none transition-colors duration-700"
        style={{ background: `radial-gradient(circle, ${viewMode === 'admin' ? design.adminColor : design.accentColor} 0%, transparent 70%)` }}
      ></div>

      <form 
        onSubmit={handleLogin} 
        style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
        className="backdrop-blur-2xl p-12 rounded-[3.5rem] border-2 shadow-2xl w-full max-w-md relative z-10 transition-all"
      >
        {/* 🏢 Sector Switcher (The New Section) */}
        <div className="flex bg-white/5 p-1.5 rounded-full border border-white/5 mb-10">
          <button 
            type="button"
            onClick={() => setViewMode('officer')}
            className={`flex-1 py-3 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              viewMode === 'officer' ? 'bg-purple-600 text-white shadow-lg' : 'text-white/30'
            }`}
          >
            <User size={12} /> Officer
          </button>
          <button 
            type="button"
            onClick={() => setViewMode('admin')}
            className={`flex-1 py-3 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              viewMode === 'admin' ? 'bg-blue-600 text-white shadow-lg' : 'text-white/30'
            }`}
          >
            <ShieldCheck size={12} /> Admin
          </button>
        </div>

        <div className="flex flex-col items-center mb-8 text-center">
          <div className={`p-4 rounded-3xl text-white shadow-lg transition-all duration-500 ${viewMode === 'admin' ? 'bg-blue-600 shadow-blue-500/20' : 'bg-purple-600 shadow-purple-500/20'}`}>
            {viewMode === 'admin' ? <ShieldCheck size={32} /> : <ShieldAlert size={32} />}
          </div>
          <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase mt-4">
            BTU <span style={{ color: viewMode === 'admin' ? design.adminColor : design.accentColor }}>{viewMode === 'admin' ? 'Control' : 'Field'}</span>
          </h1>
          <p className="text-white/30 font-black uppercase text-[8px] tracking-[0.4em] mt-2">
            {viewMode === 'admin' ? 'Central Management Terminal' : 'Traffic Command Node'}
          </p>
        </div>
        
        {error && (
          <div className="text-red-400 text-[10px] font-black uppercase tracking-widest mb-6 bg-red-500/10 p-4 rounded-2xl border border-red-500/20 animate-pulse text-center">
            {error}
          </div>
        )}
        
        <div className="space-y-5">
          <div className="relative">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={18} />
            <input 
              type="email" 
              placeholder={viewMode === 'admin' ? "Admin Identifier" : "Officer Email"}
              required
              className="w-full pl-14 pr-6 py-5 bg-white/5 rounded-2xl border border-white/10 outline-none font-bold transition-all text-sm text-white placeholder:text-white/10 focus:border-white/30"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={18} />
            <input 
              type="password" 
              placeholder="System Password" 
              required
              className="w-full pl-14 pr-6 py-5 bg-white/5 rounded-2xl border border-white/10 outline-none font-bold transition-all text-sm text-white placeholder:text-white/10 focus:border-white/30"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-black shadow-2xl transition-all uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 ${
              loading 
                ? 'bg-white/20 text-white/40 cursor-not-allowed' 
                : viewMode === 'admin' 
                  ? 'bg-blue-600 text-white hover:bg-white hover:text-black' 
                  : 'bg-purple-600 text-white hover:bg-white hover:text-black'
            }`}
          >
            {loading ? <Activity className="animate-spin" size={16} /> : `Unlock ${viewMode === 'admin' ? 'Console' : 'Dashboard'}`}
          </button>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center gap-2">
          <p className="text-[8px] font-black text-white/10 uppercase tracking-[0.5em]">
            Bhopal Traffic Unit — Secure Node
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;