import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { apiService } from '../api/apiService';
import { ExternalLink, Search, Activity, ShieldCheck, Fingerprint, RefreshCw, Send, CheckCircle2 } from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000';

// Editable inline state per violation row
interface RowEdit {
  plate: string;
  phone: string;
  issued: boolean;
  loading: boolean;
  error: string;
}

const ChallanLogs = () => {
  const design = {
    pageBg: "#020617",
    accentColor: "#9333ea",
    secondaryAccent: "#3b82f6",
    glassBg: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.08)",
  };

  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  // Per-row edit state keyed by violation id
  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>({});

  const token = localStorage.getItem('access_token');

  const fetchLogs = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      setIsSyncing(true);
      const response = await apiService.getViolations(searchTerm);
      const data: any[] = response.data || [];
      setLogs(data);
      // Initialize row edits for any new rows
      setRowEdits(prev => {
        const next = { ...prev };
        data.forEach(log => {
          if (!next[log.id]) {
            const isUnknown = !log.plate_number || ['UNKNOWN','PENDING','PENDINGRECOGNITION'].includes(log.plate_number.toUpperCase());
            next[log.id] = { plate: isUnknown ? '' : log.plate_number, phone: '', issued: false, loading: false, error: '' };
          }
        });
        return next;
      });
    } catch (err) {
      console.error("BTU Archive Sync Error:", err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchLogs(true);
    const interval = setInterval(() => fetchLogs(false), 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const updateRow = (id: string, updates: Partial<RowEdit>) => {
    setRowEdits(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  };

  const handleVerifyAndIssue = async (log: any) => {
    const row = rowEdits[log.id];
    if (!row || !row.plate || !row.phone) return;

    updateRow(log.id, { loading: true, error: '' });
    try {
      await axios.post(
        `${API_BASE_URL}/challans/issue`,
        {
          violation_id: log.id,
          vehicle_number: row.plate.replace(/[\s-]/g, '').toUpperCase(),
          phone_number: row.phone,
          violation_type: log.violation_type,
          owner_name: 'Unknown',
          location: log.camera_id || 'Bhopal',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      updateRow(log.id, { issued: true, loading: false });
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to issue challan';
      updateRow(log.id, { error: msg, loading: false });
    }
  };

  return (
    <div className="flex-1 relative overflow-y-auto p-8 font-sans transition-all duration-700"
         style={{ backgroundColor: design.pageBg, color: "#ffffff" }}>

      {/* 🌌 Atmospheric Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] opacity-10 pointer-events-none"
           style={{ background: `radial-gradient(circle, ${design.accentColor} 0%, transparent 70%)` }}></div>

      <div className="relative z-10">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white flex items-center gap-4">
              Evidence <span className="text-purple-500">Archives</span>
              {isSyncing && <RefreshCw size={20} className="animate-spin text-purple-500/50" />}
            </h1>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-2">
              Bhopal BTU AI Violation Database
            </p>
          </div>

          <div className="relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-purple-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder="FILTER PLATE NUMBER..."
              className="pl-14 pr-8 py-5 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md outline-none font-black text-xs uppercase tracking-widest w-96 focus:border-purple-500/50 focus:bg-white/10 transition-all text-white placeholder:text-white/10 shadow-2xl"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ backgroundColor: design.glassBg, borderColor: design.glassBorder }}
             className="rounded-[3.5rem] border backdrop-blur-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-6 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Violation Class</th>
                <th className="p-6 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">AI Confidence</th>
                <th className="p-6 text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">Visual Evidence</th>
                {/* 🔥 NEW EDITABLE COLUMNS */}
                <th className="p-6 text-[11px] font-black text-purple-400 uppercase tracking-[0.2em]">Plate No.</th>
                <th className="p-6 text-[11px] font-black text-purple-400 uppercase tracking-[0.2em]">Owner Phone</th>
                <th className="p-6 text-[11px] font-black text-purple-400 uppercase tracking-[0.2em]">Verify & Issue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-32 text-center">
                    <Activity className="animate-spin text-purple-500 mx-auto mb-4" size={40} />
                    <span className="font-black text-white/20 uppercase tracking-[0.4em] italic text-xs">Accessing Encrypted Records...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-32 text-center">
                    <Fingerprint className="text-white/10 mx-auto mb-4" size={48} />
                    <p className="font-black text-white/20 uppercase tracking-widest text-xs italic">No matching logs found in archive</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const row = rowEdits[log.id] || { plate: '', phone: '', issued: false, loading: false, error: '' };
                  const canIssue = row.plate.length >= 6 && row.phone.length >= 10;

                  return (
                    <tr key={log.id} className="hover:bg-white/[0.03] transition-all group cursor-default">
                      {/* Violation Class */}
                      <td className="p-6">
                        <span className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-[9px] font-black uppercase border border-red-500/20 tracking-widest">
                          {log.violation_type}
                        </span>
                      </td>

                      {/* AI Confidence */}
                      <td className="p-6">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-white/60 font-black font-mono">
                            {(log.confidence_score * 100).toFixed(1)}%
                          </span>
                          <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500" style={{ width: `${log.confidence_score * 100}%` }}></div>
                          </div>
                        </div>
                      </td>

                      {/* Evidence */}
                      <td className="p-6">
                        <a href={log.evidence_image_url || '#'} target="_blank" rel="noreferrer"
                           className="inline-flex items-center gap-3 bg-white/5 hover:bg-purple-600 px-5 py-3 rounded-2xl transition-all border border-white/5">
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">View</span>
                          <ExternalLink size={12} className="text-white" />
                        </a>
                      </td>

                      {/* 🔥 Editable Plate */}
                      <td className="p-6">
                        {row.issued ? (
                          <span className="font-black text-green-400 uppercase tracking-wider text-sm">{row.plate}</span>
                        ) : (
                          <input
                            type="text"
                            value={row.plate}
                            onChange={e => updateRow(log.id, { plate: e.target.value.toUpperCase() })}
                            placeholder="MP09AB1234"
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-black text-xs uppercase tracking-wider outline-none focus:border-purple-500 w-36 placeholder:text-white/20"
                          />
                        )}
                      </td>

                      {/* 🔥 Editable Phone */}
                      <td className="p-6">
                        {row.issued ? (
                          <span className="font-black text-green-400 text-sm">{row.phone}</span>
                        ) : (
                          <input
                            type="tel"
                            value={row.phone}
                            onChange={e => updateRow(log.id, { phone: e.target.value.replace(/\D/g, '') })}
                            placeholder="9876543210"
                            maxLength={10}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-black text-xs tracking-wider outline-none focus:border-purple-500 w-36 placeholder:text-white/20"
                          />
                        )}
                      </td>

                      {/* 🔥 Verify & Issue Button */}
                      <td className="p-6">
                        {row.issued ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle2 size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Challan Issued</span>
                          </div>
                        ) : row.loading ? (
                          <Activity size={18} className="animate-spin text-purple-400" />
                        ) : (
                          <div className="flex flex-col gap-1">
                            <button
                              disabled={!canIssue}
                              onClick={() => handleVerifyAndIssue(log)}
                              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                                canIssue
                                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                                  : 'bg-white/5 text-white/20 cursor-not-allowed'
                              }`}
                            >
                              <Send size={13} />
                              Verify & Issue
                            </button>
                            {row.error && <span className="text-red-400 text-[9px] font-bold">{row.error}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="bg-white/5 border border-white/5 px-6 py-3 rounded-2xl flex items-center gap-4 backdrop-blur-xl">
            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">Total Entries Indexed:</span>
            <span className="text-sm font-black text-purple-400 italic">{logs.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChallanLogs;