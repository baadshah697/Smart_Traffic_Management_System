import { 
  LayoutDashboard, Camera, Car, AlertTriangle, 
  FileText, BarChart3, LogOut, ParkingCircle, Shield,Map as MapIcon
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  role: string | null; 
}

const Sidebar = ({ activeTab, setActiveTab, onLogout, role }: SidebarProps) => {
  const design = {
    sidebarBg: "rgba(2, 6, 23, 0.95)", // Slightly more solid for better text contrast
    accentColor: "#9333ea",           
    glassBorder: "rgba(255, 255, 255, 0.05)",
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} />, roles: ['admin', 'officer'] },
    { id: 'surveillance', label: 'Surveillance', icon: <Camera size={20} />, roles: ['admin', 'officer'] },
    { id: 'live-map', label: 'Live Grid Map', icon: <MapIcon size={20} />, roles: ['admin', 'officer'] },
    { id: 'traffic', label: 'Traffic', icon: <Car size={20} />, roles: ['admin', 'officer'] },
    { id: 'accidents', label: 'Accidents', icon: <AlertTriangle size={20} />, roles: ['admin', 'officer'] },
    { id: 'parking', label: 'Parking', icon: <ParkingCircle size={20} />, roles: ['admin', 'officer'] },
    { id: 'e-challan', label: 'E-Challan', icon: <FileText size={20} />, roles: ['admin', 'officer'] },
    { id: 'reports', label: 'Reports', icon: <BarChart3 size={20} />, roles: ['admin'] },
  ];

  return (
    <div 
      style={{ backgroundColor: design.sidebarBg, borderColor: design.glassBorder }}
      className="w-72 h-screen flex flex-col border-r backdrop-blur-3xl z-50 transition-all duration-500"
    >
      {/* 🏙️ FIXED: BTU Branding Section (Does not scroll) */}
      <div className="p-10 flex flex-col items-center text-center shrink-0">
        <div className="relative group">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-[2.2rem] flex items-center justify-center mb-6 shadow-2xl shadow-purple-500/20">
            <Shield className="text-white" size={32} />
          </div>
          <div className="absolute inset-0 bg-purple-500 blur-3xl opacity-20 -z-10 animate-pulse"></div>
        </div>
        <h1 className="text-2xl font-black text-white tracking-[0.2em] uppercase italic leading-none">BTU</h1>
        <div className="flex items-center gap-2 mt-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
            <div className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse"></div>
            <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                {role ? `BTU ${role}` : 'AUTH_REQD'}
            </p>
        </div>
      </div>

      {/* 🚀 SCROLLABLE: Navigation Items Section */}
      <nav className="flex-1 px-6 space-y-3 mt-6 overflow-y-auto 
                      scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent 
                      hover:scrollbar-thumb-purple-500/30 transition-all duration-300">
        {menuItems.map((item) => {
          if (role && !item.roles.includes(role.toLowerCase())) return null;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-6 py-5 rounded-[1.8rem] transition-all duration-500 group relative ${
                isActive ? 'text-white' : 'text-white/30 hover:text-white hover:bg-white/5'
              }`}
            >
              {isActive && (
                <div className="absolute left-[-1.5rem] w-2 h-10 rounded-r-full bg-purple-500 shadow-[0_0_15px_#9333ea]"></div>
              )}
              <div className={`${isActive ? 'text-purple-400' : 'group-hover:text-purple-300'} transition-colors`}>
                {item.icon}
              </div>
              <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-80'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 🚪 FIXED: Logout Section (Always visible at bottom) */}
      <div className="p-10 border-t border-white/5 shrink-0">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-4 px-6 py-5 rounded-[1.8rem] text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300 group"
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Close Session</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;