import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { apiService } from '../api/apiService';
import { 
  Camera, Plus, X, Globe, Cpu, RefreshCw, 
  Trash2, Tag, ShieldCheck, ShieldAlert, Activity, Volume2 
} from 'lucide-react';

const Surveillance = () => {
  const design = {
    pageBg: "#020617",
    accentColor: "#9333ea", 
  };

  const [cameras, setCameras] = useState<any[]>([]);
  
  const [signalStates, setSignalStates] = useState<any>(() => {
    const saved = localStorage.getItem('btu_live_signals');
    return saved ? JSON.parse(saved) : {};
  }); 

  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null); 
  const [liveFines, setLiveFines] = useState<any>({});
  
  const [voiceMode, setVoiceMode] = useState<'en' | 'hi' | 'both' | 'muted'>(() => {
    const saved = localStorage.getItem('btu_voice_mode');
    return (saved as any) || 'both';
  });

  const [spokenIds] = useState(() => new Set<string>());
  const isFirstLoad = useRef(true);

  const handleVoiceModeChange = (mode: 'en' | 'hi' | 'both' | 'muted') => {
    setVoiceMode(mode);
    localStorage.setItem('btu_voice_mode', mode);
  };

  const speakAnnouncement = (ann: any) => {
    if (voiceMode === 'muted') return;
    const synth = window.speechSynthesis;
    if (!synth) return;

    const speakEn = () => {
      const utterEn = new SpeechSynthesisUtterance(ann.text_en);
      utterEn.lang = 'en-US';
      const voices = synth.getVoices();
      const enVoice = voices.find(v => v.lang.startsWith('en'));
      if (enVoice) utterEn.voice = enVoice;
      
      utterEn.onend = () => {
        if (voiceMode === 'both') speakHi();
      };
      synth.speak(utterEn);
    };

    const speakHi = () => {
      const utterHi = new SpeechSynthesisUtterance(ann.text_hi);
      utterHi.lang = 'hi-IN';
      const voices = synth.getVoices();
      const hiVoice = voices.find(v => v.lang.startsWith('hi'));
      if (hiVoice) utterHi.voice = hiVoice;
      synth.speak(utterHi);
    };

    if (voiceMode === 'en' || voiceMode === 'both') {
      speakEn();
    } else if (voiceMode === 'hi') {
      speakHi();
    }
  };
  
  const [formData, setFormData] = useState({ 
    location_name: '', 
    ip_address: '', // This is the stream source (0 or URL)
    latitude: '', 
    longitude: '' 
  });

  const token = localStorage.getItem('access_token');
  const API_BASE_URL = 'http://127.0.0.1:8000';

  const fetchCameras = async () => {
    try {
      const response = await apiService.getCameras();
      setCameras(response.data);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const fetchLiveRates = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/admin/module/settings/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.fine_multipliers) {
        setLiveFines(res.data.fine_multipliers);
      }
    } catch (err) {
      console.error("Policy sync failed");
    }
  };

  useEffect(() => { 
    fetchCameras(); 
    fetchLiveRates();

    const savedCam = localStorage.getItem('selected_camera');
    if (savedCam) {
      const parsed = JSON.parse(savedCam);
      setActiveNode(parsed.id);
    }

    const dataInterval = setInterval(async () => {
      try {
        const [res, annRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/traffic/congestion`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_BASE_URL}/traffic/announcements`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        const roads = res.data || [];
        const announcements = annRes.data || [];

        if (isFirstLoad.current) {
          if (announcements.length > 0) {
            const mostRecent = announcements[announcements.length - 1];
            speakAnnouncement(mostRecent);
          }
          announcements.forEach((ann: any) => {
            spokenIds.add(ann.id);
          });
          isFirstLoad.current = false;
        } else {
          announcements.forEach((ann: any) => {
            if (!spokenIds.has(ann.id)) {
              spokenIds.add(ann.id);
              speakAnnouncement(ann);
            }
          });
        }

        setSignalStates((prev: any) => {
          const newState = { ...prev }; 
          roads.forEach((sig: any) => {
            const camId = sig.camera_id;
            if (!camId) return;

            const densityPct = sig.congestion_level || 0;

            newState[camId] = {
              phase: sig.current_state || 'red',
              timer: sig.recommended_time || 0,
              vehicle_count: sig.vehicle_count || 0,
              density_pct: densityPct,
              is_emergency: sig.is_emergency || false
            };
          });
          
          localStorage.setItem('btu_live_signals', JSON.stringify(newState));
          return newState;
        });
      } catch (err) {
        console.error("Telemetry sync failed");
      }
    }, 1000); // Polling every 1s matches RL prediction tick!

    return () => {
      clearInterval(dataInterval);
    };
  }, [token]);

  const handleToggleNode = (cam: any) => {
    if (activeNode === cam.id) {
      setActiveNode(null);
      localStorage.removeItem('selected_camera');
    } else {
      setActiveNode(cam.id);
      localStorage.setItem('selected_camera', JSON.stringify(cam));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Logic for adding any camera
      const payload = {
        location_name: formData.location_name,
        ip_address: formData.ip_address, // Stream source (e.g., '0' or 'http://...')
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude)
      };
      await apiService.registerCamera(payload);
      setShowAddModal(false);
      setFormData({ location_name: '', ip_address: '', latitude: '', longitude: '' });
      fetchCameras();
    } catch (err) {
      alert("Deployment Failed. Check stream source.");
    }
  };

  const handleReconnect = (id: string) => {
    setSyncing(id);
    setTimeout(() => { fetchCameras(); setSyncing(null); }, 1500);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`⚠️ DECOMMISSION NODE [${name}]?`)) {
      try {
        await apiService.deleteCamera(id);
        fetchCameras();
      } catch (err) {
        alert("Purge Failed.");
      }
    }
  };

  return (
    <div className="flex-1 relative h-screen overflow-y-auto p-12 font-sans transition-all duration-700 admin-scrollbar"
         style={{ backgroundColor: design.pageBg, color: "#ffffff" }}>
      
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] opacity-10 pointer-events-none"
           style={{ background: `radial-gradient(circle, ${design.accentColor} 0%, transparent 70%)` }}></div>

      <div className="relative z-10 max-w-[1600px] mx-auto">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-16">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-4">
              <div className="p-3 bg-purple-600 rounded-2xl shadow-xl shadow-purple-900/20">
                <Camera size={28} className="text-white" />
              </div>
              Live <span className="text-purple-500">AI Streams</span>
            </h1>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-3 italic">
              BTU Central Command — Bhopal Metropolitan Hub
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            {Object.entries(liveFines).map(([key, val]: any) => (
              <div key={key} className="bg-white/5 border border-white/5 px-6 py-4 rounded-3xl flex items-center gap-4 backdrop-blur-xl">
                <div className="p-2 bg-purple-500/20 rounded-xl text-purple-400"><Tag size={14} /></div>
                <div>
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">{key}</p>
                  <p className="text-sm font-black text-white italic tracking-tighter">₹{val}</p>
                </div>
              </div>
            ))}
            
            <div className="flex bg-white/5 border border-white/10 p-1 rounded-3xl items-center gap-1 backdrop-blur-xl">
              <div className="px-3 text-white/40 flex items-center gap-1.5">
                <Volume2 size={14} className={voiceMode === 'muted' ? 'text-red-500 animate-pulse' : 'text-purple-400'} />
                <span className="text-[8px] font-black uppercase tracking-widest hidden sm:inline">Voice</span>
              </div>
              <button 
                onClick={() => handleVoiceModeChange('en')}
                className={`px-4 py-2.5 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all ${voiceMode === 'en' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                EN
              </button>
              <button 
                onClick={() => handleVoiceModeChange('hi')}
                className={`px-4 py-2.5 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all ${voiceMode === 'hi' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                HI
              </button>
              <button 
                onClick={() => handleVoiceModeChange('both')}
                className={`px-4 py-2.5 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all ${voiceMode === 'both' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                BOTH
              </button>
              <button 
                onClick={() => handleVoiceModeChange('muted')}
                className={`px-4 py-2.5 rounded-2xl text-[8px] font-black uppercase tracking-widest transition-all ${voiceMode === 'muted' ? 'bg-red-600 text-white shadow-lg shadow-red-950/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                MUTED
              </button>
            </div>

            <button onClick={() => setShowAddModal(true)} className="bg-white text-black hover:bg-purple-600 hover:text-white px-8 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ml-4">
              <Plus size={16} /> Deploy Node
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[50vh]">
            <Cpu className="text-purple-500 animate-pulse mb-6" size={56} />
            <span className="font-black text-white/20 uppercase tracking-[0.5em] italic">Initializing Grid...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {cameras.map((cam) => {
              const signal = signalStates[cam.id] || { phase: 'red', timer: 15, vehicle_count: 0, density_pct: 0, is_emergency: false };
              const activeColor = signal.phase;

              let ringColor = 'border-white/5';
              let textTheme = 'text-white';
              let barColor = 'bg-blue-500';

              if (activeColor === 'green') {
                ringColor = 'border-green-500/30 ring-2 ring-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.1)]';
                textTheme = 'text-green-400';
              } else if (activeColor === 'yellow') {
                ringColor = 'border-orange-500/30 ring-2 ring-orange-500/10 shadow-[0_0_30px_rgba(249,115,22,0.1)]';
                textTheme = 'text-orange-500';
              } else if (activeColor === 'red') {
                ringColor = 'border-red-500/30 ring-2 ring-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.1)]';
                textTheme = 'text-red-500';
              }

              if (signal.density_pct >= 80) barColor = 'bg-red-500 shadow-[0_0_10px_#ef4444]';
              else if (signal.density_pct >= 40) barColor = 'bg-orange-500 shadow-[0_0_10px_#f97316]';
              else barColor = 'bg-green-500';

              return (
                <div key={cam.id} className={`bg-white/5 p-6 rounded-[3rem] border backdrop-blur-xl transition-all duration-700 relative ${activeNode === cam.id ? 'border-purple-500 ring-4 ring-purple-500/30' : ringColor}`}>
                  
                  <div className="absolute top-10 left-10 z-20 flex items-center gap-4 p-4 rounded-3xl border border-white/10 bg-black/80 backdrop-blur-2xl shadow-2xl">
                    <div className="flex flex-col gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${activeColor === 'red' ? 'bg-red-500 shadow-[0_0_15px_#ef4444] scale-125' : 'bg-red-950'}`}></div>
                        <div className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${activeColor === 'yellow' ? 'bg-orange-500 shadow-[0_0_15px_#f97316] scale-125' : 'bg-orange-950'}`}></div>
                        <div className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${activeColor === 'green' ? 'bg-green-500 shadow-[0_0_15px_#22c55e] scale-125' : 'bg-green-950'}`}></div>
                    </div>
                    <div className="pr-2 border-l border-white/10 pl-4 min-w-[80px]">
                        <p className="text-[7px] font-black uppercase text-white/30 tracking-widest mb-0.5">AI Phase</p>
                        <p className={`text-xl font-black uppercase tracking-tighter ${signal.is_emergency ? 'animate-pulse' : ''} ${textTheme}`}>
                            {activeColor === 'yellow' ? 'ORANGE' : activeColor} {signal.timer}s
                        </p>
                    </div>
                  </div>

                  <div className="absolute top-10 right-10 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[9px] font-black text-white uppercase tracking-widest italic">Live Feed</span>
                  </div>

                  <div className="aspect-video bg-black rounded-[2.5rem] overflow-hidden border border-white/10 relative group">
                    <img 
                      src={`${API_BASE_URL}/cameras/live/${cam.id}?token=${token}&sync=${syncing === cam.id ? Date.now() : ''}`}
                      alt={cam.location_name}
                      className={`w-full h-full object-cover grayscale-[0.1] transition-all duration-700 ${syncing === cam.id ? 'opacity-20' : 'opacity-100'}`}
                      onError={(e) => { e.currentTarget.src = "https://placehold.co/800x450/020617/7e22ce?text=SIGNAL+ENCRYPTED"; }}
                    />
                    
                    <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-8 pt-16 flex justify-between items-end">
                      <div className="flex items-center gap-3">
                        <Camera size={24} className="text-white/40" />
                        <h3 className="text-2xl md:text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-md">{cam.location_name}</h3>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right flex flex-col items-end min-w-[100px]">
                            <p className="text-[8px] font-black uppercase text-white/50 tracking-widest mb-1.5">Load Density</p>
                            <div className="flex items-center gap-2 justify-end mb-2">
                                <Activity size={14} className={signal.density_pct >= 80 ? 'text-red-400 animate-pulse' : 'text-blue-400'} />
                                <span className="text-lg font-black text-white">{signal.vehicle_count || 0} Veh</span>
                            </div>
                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden shadow-inner">
                                <div className={`h-full transition-all duration-1000 ${barColor}`} style={{ width: `${signal.density_pct}%` }}></div>
                            </div>
                        </div>

                        <div className="text-right border-l border-white/10 pl-6 flex flex-col items-end">
                            <p className="text-[8px] font-black uppercase text-white/50 tracking-widest mb-1">Master ID</p>
                            <span className="text-xs font-mono text-purple-400/80 uppercase">#{cam.id.slice(0, 6)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-between items-center px-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-white/30 uppercase tracking-widest flex items-center gap-2">
                        <Globe size={12} /> {cam.latitude}°N / {cam.longitude}°E
                      </span>
                    </div>
                    
                    <div className="flex gap-2">
                      <button onClick={() => handleToggleNode(cam)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest shadow-lg ${activeNode === cam.id ? 'bg-purple-600 text-white' : 'bg-white/10 text-white hover:bg-white hover:text-black'}`}>
                        {activeNode === cam.id ? <><ShieldCheck size={14} /> Locked</> : <><ShieldAlert size={14} /> Lock Signal</>}
                      </button>
                      <button onClick={() => handleReconnect(cam.id)} className="p-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-2xl transition-all border border-white/5"><RefreshCw size={18} className={syncing === cam.id ? 'animate-spin' : ''} /></button>
                      <button onClick={() => handleDelete(cam.id, cam.location_name)} className="p-3 bg-white/5 hover:bg-red-600/20 text-white/40 hover:text-red-500 rounded-2xl transition-all border border-white/5"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🛡️ DEPLOY NODE MODAL: Universal source support */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-slate-900 border border-purple-500/30 p-10 rounded-[3rem] w-full max-w-lg relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors hover:text-white">
              <X />
            </button>
            
            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-2">
              Deploy <span className="text-purple-500">New Node</span>
            </h2>
            <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-8 italic">
              Hardware Registry — Central Command
            </p>

            <form onSubmit={handleRegister} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <p className="text-[7px] font-black text-purple-400 uppercase ml-2 tracking-widest">Zone Location</p>
                <input required placeholder="E.G., MP NAGAR ZONE-1" className="bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold placeholder:text-white/10 outline-none focus:border-purple-500/50 transition-all" value={formData.location_name} onChange={e => setFormData({...formData, location_name: e.target.value})} />
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[7px] font-black text-purple-400 uppercase ml-2 tracking-widest">Stream Source (0=Webcam | URL=Remote)</p>
                <input required placeholder="0 OR RTSP/HTTP URL" className="bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold placeholder:text-white/10 outline-none focus:border-purple-500/50 transition-all" value={formData.ip_address} onChange={e => setFormData({...formData, ip_address: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-[7px] font-black text-purple-400 uppercase ml-2 tracking-widest">Lat</p>
                  <input required placeholder="23.2599" className="bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold placeholder:text-white/10 outline-none focus:border-purple-500/50 transition-all" value={formData.latitude} onChange={e => setFormData({...formData, latitude: e.target.value})} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[7px] font-black text-purple-400 uppercase ml-2 tracking-widest">Long</p>
                  <input required placeholder="77.4126" className="bg-white/5 border border-white/10 p-5 rounded-2xl text-white font-bold placeholder:text-white/10 outline-none focus:border-purple-500/50 transition-all" value={formData.longitude} onChange={e => setFormData({...formData, longitude: e.target.value})} />
                </div>
              </div>

              <button type="submit" className="bg-purple-600 p-6 rounded-3xl text-white font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all mt-4 shadow-2xl shadow-purple-900/20 text-[10px]">
                Execute Deployment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Surveillance;