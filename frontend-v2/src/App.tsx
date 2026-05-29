import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import OfficerDashboard from './pages/OfficerDashboard';
import Surveillance from './pages/Surveillance';
import ChallanLogs from './pages/ChallanLogs';
import AccidentReport from './pages/AccidentReport';
import TrafficCongestion from './pages/TrafficCongestion';
import ParkingManagement from './pages/ParkingManagement';
import Reports from './pages/Reports';
import Login from './pages/Login';
import CitizenPortal from './pages/CitizenPortal';
import BhopalMap from './pages/BhopalMap'; // 👈 1. IMPORT THE NEW MAP

// 🔥 ADMIN IMPORTS
import AdminSidebar from './admin_module/AdminSidebar';
import OfficerRecruitment from './admin_module/OfficerRecruitment';
import AdminDashboard from './admin_module/AdminDashboard';
import SystemHealth from './admin_module/SystemHealth';
import OfficerAudit from './admin_module/OfficerAudit';
import OracleAnalytics from './admin_module/OracleAnalytics'; 
import GlobalSettings from './admin_module/GlobalSettings';

function App() {
  const [activeTab, setActiveTab] = useState('citizen-home');
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem('user_role'));

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    setUserRole(role);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
    setUserRole(null);
    setActiveTab('citizen-home');
  };

  if (activeTab === 'citizen-home') {
    return <CitizenPortal onGoToLogin={() => setActiveTab('login')} />;
  }

  if (activeTab === 'login' && !userRole) {
    return <Login setAuth={(role) => {
      setUserRole(role);
      setActiveTab('overview'); 
    }} />;
  }

  if (!userRole) {
    return <Login setAuth={(role) => {
      setUserRole(role);
      setActiveTab('overview');
    }} />;
  }

  // 🛡️ ADMIN PART
  if (userRole === 'admin') {
    return (
      <div className="flex h-screen bg-[#020617] text-white overflow-hidden relative font-sans">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/20 rounded-full blur-[120px]"></div>
        </div>

        <AdminSidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onLogout={handleLogout} 
        />

        <main className="flex-1 h-full overflow-y-auto relative z-10 admin-scrollbar">
          {activeTab === 'overview' && <AdminDashboard />} 
          {activeTab === 'officer-mgmt' && <OfficerRecruitment />}
          {activeTab === 'health' && <SystemHealth />}
          {activeTab === 'audit' && <OfficerAudit />}
          {activeTab === 'oracle' && <OracleAnalytics />}
          {activeTab === 'settings' && <GlobalSettings />}
          {activeTab === 'live-map' && (
            <div className="h-screen w-full flex flex-col">
              <div className="flex-1 p-6 pb-24 overflow-hidden">
                <BhopalMap />
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // 👮 OFFICER PART
  return (
    <div className="flex h-screen bg-transparent text-slate-900 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/20 rounded-full blur-[120px]"></div>
      </div>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
        role={userRole} 
      />

      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        {activeTab === 'overview' && <OfficerDashboard />}
        {activeTab === 'surveillance' && <Surveillance />}
        {activeTab === 'live-map' && <BhopalMap />} {/* 👈 3. OFFICER MAP TAB */}
        {activeTab === 'e-challan' && <ChallanLogs />}
        {activeTab === 'accidents' && <AccidentReport />}
        {activeTab === 'traffic' && <TrafficCongestion />}
        {activeTab === 'parking' && <ParkingManagement />}
        {activeTab === 'reports' && <Reports />}
      </main>
    </div>
  );
}

export default App;