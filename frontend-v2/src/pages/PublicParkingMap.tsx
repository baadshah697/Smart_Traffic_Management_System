import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { Activity, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const API_BASE = 'http://127.0.0.1:8000';

const createParkingIcon = (occupancyRate: number) => {
  const color = occupancyRate >= 100 ? '#ef4444' : (occupancyRate > 80 ? '#f59e0b' : '#22c55e');
  return L.divIcon({
    className: 'custom-parking-icon',
    html: `<div style="background-color: ${color}; padding: 6px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
              <path d="M9 16V8h4a2 2 0 0 1 0 4H9"></path>
            </svg>
           </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
};

interface PublicParkingMapProps {
  onRequestClick: (lotId: string, lotName: string) => void;
}

const PublicParkingMap: React.FC<PublicParkingMapProps> = ({ onRequestClick }) => {
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLots = async () => {
    try {
      const res = await axios.get(`${API_BASE}/parking/public-lots`);
      setLots(res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
    const interval = setInterval(fetchLots, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-[600px] bg-slate-900 border border-white/10 rounded-[2rem] flex flex-col items-center justify-center">
        <Activity className="animate-spin text-purple-500 mb-4" size={48} />
        <p className="text-white font-black italic tracking-widest text-sm">INITIALIZING SATELLITE LINK...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative z-10 transition-all">
      <MapContainer 
        center={[23.2599, 77.4126]} 
        zoom={12} 
        scrollWheelZoom={true} 
        style={{ width: '100%', height: '100%', zIndex: 1 }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        
        {lots.map((lot) => {
          if (!lot.latitude || !lot.longitude) return null;
          const occupancyRate = (lot.occupied / lot.total_slots) * 100;
          const available = lot.total_slots - lot.occupied;
          
          return (
            <Marker 
              key={lot.id} 
              position={[lot.latitude, lot.longitude]} 
              icon={createParkingIcon(occupancyRate)}
            >
              <Popup className="custom-popup">
                <div className="p-2 min-w-[200px]">
                  <h3 className="font-black text-gray-900 text-sm uppercase italic">{lot.name}</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-1">
                    <Navigation size={10} /> {lot.location}
                  </p>
                  
                  <div className="flex justify-between items-center bg-gray-100 p-3 rounded-xl mb-4">
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400 font-black uppercase">Capacity</p>
                      <p className="font-black text-black">{lot.total_slots}</p>
                    </div>
                    <div className="text-center border-l border-r border-gray-300 px-3">
                      <p className="text-[9px] text-gray-400 font-black uppercase">Occupied</p>
                      <p className="font-black text-red-600">{lot.occupied}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400 font-black uppercase">Available</p>
                      <p className="font-black text-green-600">{available}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); onRequestClick(lot.id, lot.name); }}
                    disabled={available <= 0}
                    className="w-full bg-purple-600 text-white p-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {available <= 0 ? 'LOT FULL' : 'REQUEST SPOT'}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default PublicParkingMap;
