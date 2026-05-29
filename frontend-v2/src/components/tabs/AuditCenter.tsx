import { useEffect, useState } from 'react';
import { apiService } from '../../api/apiService';
import { ClipboardList, ShieldCheck, User } from 'lucide-react';

const AuditCenter = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await apiService.getAuditLogs();
        setLogs(res.data);
      } catch (err) {
        console.error("Audit access denied");
      }
    };
    fetchLogs();
  }, []);

  return (
    <div className="flex-1 bg-[#F3F4F9] p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-800 italic flex items-center gap-3">
          <ShieldCheck className="text-purple-600" size={32} /> System Audit Trail
        </h1>
        <p className="text-gray-400 font-bold mt-1 uppercase text-xs tracking-widest">Security & Activity Monitoring</p>
      </div>

      <div className="space-y-4">
        {logs.map((log: any) => (
          <div key={log.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 flex items-center justify-between hover:shadow-md transition">
            <div className="flex items-center gap-6">
              <div className="bg-purple-50 p-4 rounded-2xl">
                <ClipboardList className="text-purple-600" size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-gray-800 uppercase text-sm">{log.action_type}</span>
                  <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-bold text-gray-500">TABLE: {log.table_name}</span>
                </div>
                <p className="text-xs text-gray-400 font-bold mt-1 flex items-center gap-1">
                  <User size={12} /> Changed by ID: {log.changed_by.slice(0, 8)}...
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Timestamp</div>
              <div className="text-xs font-bold text-gray-600">{new Date(log.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AuditCenter;