import React, { useState } from 'react';
import axios from 'axios';
import { apiService } from '../api/apiService';
import {
  Search, CreditCard, CheckCircle, ShieldAlert, ExternalLink,
  MapPin, Activity, FileText, AlertTriangle, Download,
  UserPlus, Car, Phone, User, Palette, CheckCircle2, X
} from 'lucide-react';
import PublicParkingMap from './PublicParkingMap';

const API_BASE = 'http://127.0.0.1:8000';

interface CitizenPortalProps {
  onGoToLogin: () => void;
}

const design = {
  pageBg: "#020617",
  accentColor: "#9333ea",
  secondaryAccent: "#3b82f6"
};

// ── Screen state machine ──────────────────────────────────────────────────────
type Screen = 'idle' | 'searching' | 'register' | 'results';

const CitizenPortal: React.FC<CitizenPortalProps> = ({ onGoToLogin }) => {
  const [plate, setPlate] = useState('');
  const [challans, setChallans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState<Screen>('idle');
  const [paymentBanner, setPaymentBanner] = useState('');

  // Registration form state
  const [regName, setRegName]   = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regModel, setRegModel] = useState('');
  const [regColor, setRegColor] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError]   = useState('');

  // Parking State
  const [activeApp, setActiveApp] = useState<'challan' | 'parking'>('challan');
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState({ id: '', name: '' });
  const [parkReason, setParkReason] = useState('');
  const [parkDuration, setParkDuration] = useState(60);
  const [parkMsg, setParkMsg] = useState('');
  const [parkingRequests, setParkingRequests] = useState<any[]>([]);

  const handleOpenParkingReq = (lotId: string, lotName: string) => {
    setSelectedLot({ id: lotId, name: lotName });
    setParkMsg('');
    setParkReason('');
    setReqModalOpen(true);
  };

  const submitParkingReq = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = plate.replace(/[-\s]/g, '').toUpperCase();
    if (!cleanPlate) {
       setParkMsg('Please enter Vehicle Number above first.');
       return;
    }
    setLoading(true);
    try {
        const lookupRes = await axios.get(`${API_BASE}/citizen/lookup-vehicle/${cleanPlate}`);
        if (!lookupRes.data?.found) {
            setReqModalOpen(false);
            setScreen('register');
            setLoading(false);
            return;
        }
        await axios.post(`${API_BASE}/parking/apply`, {
            parking_lot_id: selectedLot.id,
            vehicle_number: cleanPlate,
            reason: parkReason,
            estimated_duration: parkDuration
        });
        setParkMsg('Request submitted successfully! Awaiting Officer Approval.');
        setTimeout(() => setReqModalOpen(false), 2000);
    } catch(e) {
        setParkMsg('Submission failed.');
    } finally {
        setLoading(false);
    }
  };

  // ── Search: check vehicle existence first ─────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = plate.replace(/[-\s]/g, '').toUpperCase();
    if (!cleanPlate) return;

    setLoading(true);
    setScreen('searching');
    setPaymentBanner('');
    try {
      // Step 3: Vehicle lookup gate
      const lookupRes = await axios.get(`${API_BASE}/citizen/lookup-vehicle/${cleanPlate}`);
      const found: boolean = lookupRes.data?.found ?? false;
      setPlate(cleanPlate);

      if (!found) {
        // Vehicle not in DB → show registration form
        setScreen('register');
        setLoading(false);
        return;
      }

      // Vehicle found → load challans
      const res = await apiService.getCitizenChallans(cleanPlate);
      setChallans(res.data || []);
      const pRes = await axios.get(`${API_BASE}/parking/my-requests/${cleanPlate}`);
      setParkingRequests(pRes.data || []);
      setScreen('results');
    } catch (err) {
      console.error('Search failed:', err);
      setChallans([]);
      setScreen('results');
    } finally {
      setLoading(false);
    }
  };

  // ── Vehicle Registration ──────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regPhone) { setRegError('Name and phone are required.'); return; }

    setRegLoading(true);
    setRegError('');
    try {
      await axios.post(`${API_BASE}/citizen/register-vehicle`, {
        plate_number: plate,
        owner_name: regName,
        phone: regPhone,
        vehicle_model: regModel,
        vehicle_color: regColor,
      });
      // After registration, proceed to results
      const res = await apiService.getCitizenChallans(plate);
      setChallans(res.data || []);
      const pRes = await axios.get(`${API_BASE}/parking/my-requests/${plate}`);
      setParkingRequests(pRes.data || []);
      setScreen('results');
    } catch (err: any) {
      setRegError(err?.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  // ── Payment ───────────────────────────────────────────────────────────────
  const handlePayment = async (id: string) => {
    try {
      setLoading(true);
      const payRes = await apiService.payChallan(id);
      const txnId = (payRes as any)?.data?.transaction_id || '';
      const res = await apiService.getCitizenChallans(plate);
      setChallans(res.data || []);
      setPaymentBanner(`✅ Payment confirmed! WhatsApp receipt sent to your registered number. TXN: ${txnId}`);
    } catch {
      setPaymentBanner('⚠️ Payment simulation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── PDF Receipt download ──────────────────────────────────────────────────
  const handleDownloadPDF = (challanId: string) => {
    window.open(`${API_BASE}/citizen/receipt/${challanId}/pdf`, '_blank');
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-screen w-full relative overflow-y-auto flex flex-col items-center pb-20 font-sans transition-colors duration-500"
      style={{ backgroundColor: design.pageBg, color: "#ffffff" }}
    >
      {/* Atmospheric glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] rounded-full blur-[150px] opacity-20 pointer-events-none animate-pulse"
           style={{ background: `radial-gradient(circle, ${design.accentColor} 0%, transparent 70%)` }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] rounded-full blur-[150px] opacity-10 pointer-events-none"
           style={{ background: `radial-gradient(circle, ${design.secondaryAccent} 0%, transparent 70%)` }} />

      {/* NAV */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl z-50">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 px-8 py-4 rounded-[2.5rem] flex justify-between items-center shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="bg-gradient-to-br from-orange-500 to-red-600 p-2.5 rounded-2xl text-white shadow-lg shadow-orange-500/50 relative z-10">
                <ShieldAlert size={22} />
              </div>
              <div className="absolute inset-0 bg-purple-500 blur-xl opacity-30" />
            </div>
            <div>
              <h1 className="text-sm font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                Bhopal <span className="text-purple-500">E-Challan</span>
              </h1>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] leading-none mt-0.5">Public Safety Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex bg-white/10 p-1 rounded-full border border-white/5 mt-2 md:mt-0">
               <button onClick={() => setActiveApp('challan')} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeApp === 'challan' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Challans</button>
               <button onClick={() => setActiveApp('parking')} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeApp === 'parking' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>GIS Parking</button>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/5">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] font-black text-white uppercase tracking-widest">Systems Active</span>
            </div>
            <button onClick={onGoToLogin}
              className="group text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-purple-600 flex items-center gap-2 transition-all duration-300">
              Officer Login
              <div className="p-2 bg-gray-50/10 rounded-lg group-hover:bg-purple-50/10 transition-colors">
                <ExternalLink size={14} />
              </div>
            </button>
          </div>
        </div>
      </nav>

      {reqModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-white/10 rounded-[3rem] p-10 w-full max-w-lg shadow-2xl relative overflow-hidden">
             <div className="absolute top-[-50px] left-[-50px] w-32 h-32 bg-blue-500 rounded-full blur-[100px] opacity-20 pointer-events-none" />
             <div className="flex justify-between items-center mb-8">
               <div>
                 <h3 className="font-black italic uppercase text-white text-xl tracking-tight">Request Parking</h3>
                 <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">{selectedLot.name}</p>
               </div>
               <button onClick={() => setReqModalOpen(false)} className="p-3 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-2xl transition-all">
                 <X size={20}/>
               </button>
             </div>
             <form onSubmit={submitParkingReq} className="space-y-6">
                <div>
                   <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-2 mb-2 block">Vehicle Number</label>
                   <input required value={plate} onChange={e => setPlate(e.target.value)} placeholder="MP04 AB 1234" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all uppercase" />
                </div>
                <div>
                   <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-2 mb-2 block">Reason for Parking</label>
                   <input required value={parkReason} onChange={e => setParkReason(e.target.value)} placeholder="Wait at station / Shopping / Official" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:border-blue-500 transition-all" />
                </div>
                <div>
                   <label className="text-[9px] font-black text-white/40 uppercase tracking-widest ml-2 mb-2 block">Estimated Duration (Mins)</label>
                   <input required type="number" value={parkDuration} onChange={e => setParkDuration(parseInt(e.target.value))} min={10} max={1440} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-sm font-black text-blue-400 outline-none focus:border-blue-500 transition-all" />
                </div>
                {parkMsg && <p className={`text-xs font-bold px-2 ${parkMsg.includes('failed') || parkMsg.includes('enter') ? 'text-red-400' : 'text-green-400'}`}>{parkMsg}</p>}
                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl">
                  {loading ? <Activity size={16} className="animate-spin mx-auto" /> : 'Submit Infrastructure Request'}
                </button>
             </form>
          </div>
        </div>
      )}

      {activeApp === 'parking' ? (
         <div className="w-full max-w-5xl mt-36 px-6">
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2 mt-12 text-center md:text-left">Live <span className="text-blue-500 underline decoration-4 underline-offset-8">Parking Map</span></h2>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mb-8 text-center md:text-left">Bhopal Municipal Corporation - Secure Slots</p>
            <PublicParkingMap onRequestClick={handleOpenParkingReq} />
         </div>
      ) : (
        <>
          {/* HERO + SEARCH */}
          <div className="w-full max-w-2xl mt-56 px-6 text-center">
        <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-[0.9] mb-4">
          Check Your <span className="text-purple-600 underline decoration-8 underline-offset-8">Traffic Health</span>
        </h2>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mb-12">
          Official Digital Secretariat — Bhopal, Madhya Pradesh
        </p>
        <form onSubmit={handleSearch} className="relative group">
          <input
            type="text"
            placeholder="MP04 AB 1234"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            className="w-full p-8 bg-white border-4 border-gray-100 rounded-[2.5rem] focus:border-purple-600 outline-none font-black text-4xl text-center uppercase transition-all shadow-2xl shadow-purple-100 placeholder:text-gray-200 text-slate-800"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-4 top-4 bg-purple-600 hover:bg-black p-5 rounded-[2rem] text-white shadow-xl transition-all active:scale-90 flex items-center justify-center min-w-[70px]"
          >
            {loading ? <Activity className="animate-spin" size={24} /> : <Search size={24} />}
          </button>
        </form>
      </div>

      {/* CONTENT AREA */}
      <div className="w-full max-w-3xl mt-20 px-6 space-y-6">

        {/* Payment Success Banner */}
        {paymentBanner && (
          <div className={`flex items-start gap-4 p-6 rounded-[2rem] border ${paymentBanner.startsWith('✅')
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'}`}>
            <span className="font-bold text-sm leading-relaxed flex-1">{paymentBanner}</span>
            <button onClick={() => setPaymentBanner('')}><X size={18} /></button>
          </div>
        )}

        {/* ── VEHICLE NOT FOUND — Registration Gate ───────────────────────── */}
        {screen === 'register' && (
          <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-purple-100 rounded-2xl text-purple-600"><UserPlus size={28} /></div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase">Vehicle Not Found</h3>
                <p className="text-slate-500 text-xs font-bold mt-1">
                  Register <span className="text-purple-600 font-black">{plate}</span> to continue. This grows the Bhopal traffic database.
                </p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {[
                { icon: <User size={16} />,    label: 'Owner Full Name *', value: regName,  setter: setRegName,  type: 'text',  placeholder: 'Rajesh Kumar' },
                { icon: <Phone size={16} />,   label: 'Phone Number *',    value: regPhone, setter: setRegPhone, type: 'tel',   placeholder: '9876543210' },
                { icon: <Car size={16} />,     label: 'Vehicle Model',     value: regModel, setter: setRegModel, type: 'text',  placeholder: 'Honda Activa 6G' },
                { icon: <Palette size={16} />, label: 'Vehicle Color',     value: regColor, setter: setRegColor, type: 'text',  placeholder: 'Black' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3 border border-gray-100 rounded-2xl px-5 py-4 focus-within:border-purple-400 transition-all">
                  <span className="text-slate-400">{f.icon}</span>
                  <div className="flex-1">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      value={f.value}
                      onChange={e => f.setter(e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full text-slate-900 font-bold text-sm outline-none placeholder:text-gray-300"
                    />
                  </div>
                </div>
              ))}

              {regError && <p className="text-red-500 text-xs font-bold px-2">{regError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setScreen('idle')}
                  className="flex-1 border-2 border-gray-200 text-slate-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regLoading}
                  className="flex-1 bg-purple-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-purple-200"
                >
                  {regLoading ? <Activity size={18} className="animate-spin" /> : <><CheckCircle2 size={18} /> Register & Continue</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── ALL CLEAR ───────────────────────────────────────────────────── */}
        {screen === 'results' && challans.length === 0 && parkingRequests.length === 0 && !loading && (
          <div className="bg-green-50 border-2 border-green-100 p-12 rounded-[3.5rem] text-center">
            <CheckCircle size={56} className="text-green-500 mx-auto mb-6" />
            <h3 className="text-2xl font-black text-green-800 uppercase italic">All Clear!</h3>
            <p className="text-green-600 font-bold text-sm mt-2">
              No pending records for <span className="underline">{plate}</span>. Safe driving!
            </p>
          </div>
        )}

        {/* ── PARKING REQUESTS ─────────────────────────────────────────────── */}
        {screen === 'results' && parkingRequests.map((req) => (
          <div key={req.id} className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 hover:shadow-2xl transition-all group">
            <div className="flex items-center gap-6">
              <div className="p-6 rounded-[2.2rem] bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                <Car size={32} />
              </div>
              <div>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">
                  PARKING PERMIT
                </p>
                <h3 className="text-xl font-black text-slate-900">{req.parking_lots?.name}</h3>
                <div className="flex items-center gap-2 text-gray-400 mt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider italic">
                    Reason: {req.reason}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 w-full md:w-auto">
              {req.status === 'approved' ? (
                <div className="flex flex-col items-end gap-2">
                  <div className="bg-green-100 text-green-600 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle size={18} /> Approved
                  </div>
                  <button
                    onClick={() => window.open(`${API_BASE}/parking/receipt/${req.id}/pdf`, '_blank')}
                    className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:text-black flex items-center gap-2 transition-colors mr-2"
                  >
                    <Download size={14} /> Download Digital Pass
                  </button>
                </div>
              ) : req.status === 'rejected' ? (
                <div className="bg-red-100 text-red-600 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
                  <X size={18} /> Rejected
                </div>
              ) : (
                <div className="bg-amber-100 text-amber-600 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
                  <Activity size={18} className="animate-pulse" /> Pending Approval
                </div>
              )}
              <div className="flex flex-col items-end opacity-40 mr-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">
                  REQ_ID: {req.id.split('-')[0]}
                </span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">
                  {new Date(req.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* ── CHALLAN CARDS ────────────────────────────────────────────────── */}
        {screen === 'results' && challans.map((challan) => (
          <div key={challan.id} className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 hover:shadow-2xl transition-all group">
            <div className="flex items-center gap-6">
              <div className="p-6 rounded-[2.2rem] bg-gray-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                <FileText size={32} />
              </div>
              <div>
                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-1">
                  {challan.violations?.violation_type || 'TRAFFIC FINE'}
                </p>
                <h3 className="text-3xl font-black text-slate-900">₹{challan.amount}</h3>
                <div className="flex items-center gap-2 text-gray-400 mt-2">
                  <MapPin size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-wider italic">
                    {challan.location || 'Bhopal Smart City Surveillance'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-3 w-full md:w-auto">
              {challan.status === 'paid' ? (
                <div className="flex flex-col items-end gap-2">
                  <div className="bg-green-100 text-green-600 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2">
                    <CheckCircle size={18} /> Fully Paid
                  </div>
                  {/* ── PDF Receipt Button ── */}
                  <button
                    onClick={() => handleDownloadPDF(challan.id)}
                    className="text-[10px] font-black text-purple-600 uppercase tracking-widest hover:text-black flex items-center gap-2 transition-colors mr-2"
                  >
                    <Download size={14} /> Download PDF Receipt
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handlePayment(challan.id)}
                  disabled={loading}
                  className="w-full md:w-auto bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-purple-600 transition-all flex items-center justify-center gap-3 group/btn"
                >
                  <CreditCard size={18} className="group-hover/btn:rotate-12 transition-transform" />
                  Pay Now
                </button>
              )}
              <div className="flex flex-col items-end opacity-40 mr-2">
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">
                  REF_ID: {challan.id.split('-')[0]}
                </span>
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest italic">
                  {new Date(challan.issued_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      </>
      )}

      {/* Compliance Notice */}
      <div className="w-full max-w-2xl mt-24 p-8 bg-amber-50 rounded-[2.5rem] border border-amber-100 flex gap-6 items-center">
        <div className="text-amber-500"><AlertTriangle size={32} /></div>
        <div>
          <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider">Compliance Notice</h4>
          <p className="text-[10px] font-bold text-amber-700 mt-1 leading-relaxed">
            As per the Motor Vehicles Act, all e-challans must be settled within 60 days of issuance.
          </p>
        </div>
      </div>

      <div className="mt-20 flex items-center gap-4 opacity-20">
        <div className="h-[2px] w-12 bg-slate-400 rounded-full" />
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Bhopal PTU Secure Gateway</p>
        <div className="h-[2px] w-12 bg-slate-400 rounded-full" />
      </div>
    </div>
  );
};

export default CitizenPortal;