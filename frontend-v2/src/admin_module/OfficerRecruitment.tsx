import React, { useState } from 'react';
import axios from 'axios';
import { UserPlus, ShieldCheck, ShieldAlert, Copy, Check } from 'lucide-react';

const OfficerRecruitment = () => {
  const [badge, setBadge] = useState('');
  const [creds, setCreds] = useState<{ email: string; pass: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRecruit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCreds(null);
    setCopied(false);
    
    const token = localStorage.getItem('access_token');
    
    try {
      const res = await axios.post(
        `http://127.0.0.1:8000/admin/module/recruit-officer`,
        { badge: badge }, 
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      // 🔥 Updated to match the "officer_details" key from your backend logic
      if (res.data.officer_details) {
        setCreds({
          email: res.data.officer_details.email,
          pass: res.data.officer_details.initial_password
        });
        setBadge('');
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Check Admin Session";
      alert(`Recruitment Failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (creds) {
      const text = `Officer Credentials\nEmail: ${creds.email}\nPassword: ${creds.pass}`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-12 animate-in fade-in duration-700">
      <div className="flex items-center gap-6 mb-12">
        <div className="w-16 h-16 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 border border-red-500/20">
          <UserPlus size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Recruit Officer</h2>
          <p className="text-white/30 text-[10px] font-bold uppercase tracking-[0.3em]">Bhopal PTU Personnel Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Input Section */}
        <div className="bg-white/5 border border-white/5 p-10 rounded-[3rem] backdrop-blur-xl h-fit">
          <form onSubmit={handleRecruit} className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-2 italic">Standard Badge ID</label>
              <input 
                type="text" 
                required
                value={badge}
                className="w-full bg-black/40 border border-white/5 rounded-2xl px-8 py-5 text-white focus:border-red-500 transition-all outline-none font-black uppercase tracking-widest placeholder:text-white/5"
                placeholder="Ex: BPL101"
                onChange={(e) => setBadge(e.target.value)}
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-6 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl shadow-red-600/20 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? "Establishing Neural Link..." : "Initialize Official Account"}
            </button>
          </form>
          <p className="mt-6 text-[8px] text-white/10 uppercase tracking-[0.4em] text-center italic">
            Automated email & BTU-pattern password generation active
          </p>
        </div>

        {/* Result Section */}
        {creds ? (
          <div className="bg-gradient-to-br from-red-600/10 to-transparent border border-red-500/20 p-10 rounded-[3rem] flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500 relative group">
            <ShieldCheck size={50} className="text-red-500 mb-6" />
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-8 italic">Access Granted</h3>
            
            <div className="w-full space-y-4">
               <div className="bg-black/60 p-5 rounded-2xl border border-white/5 flex flex-col items-start relative group/item">
                  <span className="text-[9px] font-black text-white/20 uppercase mb-1 tracking-widest">Official Email</span>
                  <span className="text-white text-sm font-mono font-bold">{creds.email}</span>
               </div>
               
               <div className="bg-black/60 p-5 rounded-2xl border border-white/5 flex flex-col items-start relative group/item">
                  <span className="text-[9px] font-black text-white/20 uppercase mb-1 tracking-widest">System Password</span>
                  <span className="text-red-400 font-black font-mono tracking-widest text-lg">{creds.pass}</span>
               </div>
            </div>

            <button 
              onClick={copyToClipboard}
              className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-red-500 transition-colors"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
              {copied ? "Copied to Clipboard" : "Copy Credentials"}
            </button>
          </div>
        ) : (
            <div className="border-2 border-dashed border-white/5 rounded-[3rem] flex flex-col items-center justify-center opacity-20 min-h-[400px]">
                <ShieldAlert size={48} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest italic">Awaiting BTU Command</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default OfficerRecruitment;