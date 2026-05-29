import { 
  UserPlus, LogOut, ShieldCheck, LayoutDashboard, 
  Activity, Award, BrainCircuit, Settings, Map as MapIcon // 👈 Import MapIcon
} from 'lucide-react';

const AdminSidebar = ({ activeTab, setActiveTab, onLogout }: any) => (
  <div className="w-80 h-screen bg-[#0f172a] border-r border-white/5 flex flex-col p-8 z-50">
    
    {/* 🏛️ Branding Section */}
    <div className="flex items-center gap-4 mb-16 px-2">
      <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-900/20">
        <ShieldCheck className="text-white" size={24} />
      </div>
      <div>
        <h1 className="text-sm font-black uppercase tracking-tighter text-white italic">
          BTU <span className="text-red-500">Root</span>
        </h1>
        <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.4em]">
          System Administrator
        </p>
      </div>
    </div>

    {/* 🛠️ Navigation Section */}
    <nav className="flex-1 space-y-4">
      
      {/* Root Overview */}
      <button 
        onClick={() => setActiveTab('overview')}
        className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${
          activeTab === 'overview' ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-white/30 hover:bg-white/5'
        }`}
      >
        <LayoutDashboard size={18} /> Root Overview
      </button>

      {/* 🔥 NEW: Grid Intelligence (Bhopal Map) */}
      <button 
        onClick={() => setActiveTab('live-map')}
        className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${
          activeTab === 'live-map' 
            ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' 
            : 'text-white/30 hover:bg-white/5'
        }`}
      >
        <MapIcon size={18} /> Grid Intelligence
      </button>

      {/* AI Oracle: Predictive Intelligence */}
      <button 
        onClick={() => setActiveTab('oracle')}
        className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${
          activeTab === 'oracle' 
            ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' 
            : 'text-white/30 hover:bg-white/5'
        }`}
      >
        <BrainCircuit size={18} /> AI Oracle
      </button>

      {/* Personnel Audit */}
      <button 
        onClick={() => setActiveTab('audit')}
        className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${
          activeTab === 'audit' ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-white/30 hover:bg-white/5'
        }`}
      >
        <Award size={18} /> Personnel Audit
      </button>

      {/* Officer Recruitment */}
      <button 
        onClick={() => setActiveTab('officer-mgmt')}
        className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${
          activeTab === 'officer-mgmt' ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-white/30 hover:bg-white/5'
        }`}
      >
        <UserPlus size={18} /> Recruit Personnel
      </button>
      
      {/* System Health */}
      <button 
        onClick={() => setActiveTab('health')}
        className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${
          activeTab === 'health' ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-white/30 hover:bg-white/5'
        }`}
      >
        <Activity size={18} /> System Health
      </button>

      {/* Global Settings */}
      <button 
        onClick={() => setActiveTab('settings')}
        className={`w-full flex items-center gap-4 p-5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${
          activeTab === 'settings' 
            ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' 
            : 'text-white/30 hover:bg-white/5'
        }`}
      >
        <Settings size={18} /> Global Settings
      </button>
    </nav>

    {/* 🔐 Logout */}
    <button 
      onClick={onLogout} 
      className="mt-auto flex items-center gap-4 p-5 text-red-500/50 hover:text-red-500 transition-colors font-black uppercase text-[10px] tracking-widest"
    >
      <LogOut size={18} /> Terminate Session
    </button>
  </div>
);

export default AdminSidebar;