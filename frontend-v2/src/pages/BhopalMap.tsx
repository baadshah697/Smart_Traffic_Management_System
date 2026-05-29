import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { apiService } from '../api/apiService';
import { Activity, Clock } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const RESEARCH_BLACKSPOTS = [
  { name: 'Govindpura Turning', latitude: 23.2500, longitude: 77.4500, wsi: 88 },
  { name: 'Balampur Ghati', latitude: 23.3100, longitude: 77.4900, wsi: 82 },
  { name: 'PCR Triangle', latitude: 23.2550, longitude: 77.4200, wsi: 72 },
  { name: 'Lalghati Square', latitude: 23.2800, longitude: 77.3700, wsi: 68 },
  { name: 'Karond Square', latitude: 23.3000, longitude: 77.4100, wsi: 64 }
];

// 🎨 Custom Icon for Nodes
const createPoleIcon = (isActive: boolean, isEmergency: boolean) => {
  const color = isEmergency ? '#ef4444' : (isActive ? '#9333ea' : '#475569');
  return L.divIcon({
    className: 'custom-pole-icon',
    html: `<div style="background-color: ${color}; padding: 8px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
           </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

// 🔥 BULLETPROOF HEATLAYER: Uses setLatLngs to bypass React rendering bugs
const HeatLayer = ({ data, hour, mode, isVisible }: { data: any[], hour: number, mode: 'hourly' | 'daily', isVisible: boolean }) => {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  // 1. Calculate the points based on time and mode
  const researchPoints = useMemo(() => {
    return RESEARCH_BLACKSPOTS.map(spot => [
      spot.latitude,
      spot.longitude,
      Math.min(Math.max(spot.wsi / 100, 0), 1)
    ]);
  }, []);

  const heatPoints = useMemo(() => {
    const liveAccidentPoints = data
      .filter(acc => {
        if (!acc.reported_at) return false;
        if (mode === 'daily') return true;
        return new Date(acc.reported_at).getHours() === hour;
      })
      .map(acc => [
        acc.latitude || 23.2599,
        acc.longitude || 77.4126,
        acc.severity === 'Major' ? 1.0 : acc.severity === 'Moderate' ? 0.75 : 0.35
      ]);

    return [...researchPoints, ...liveAccidentPoints];
  }, [data, hour, mode, researchPoints]);

  // 2. Initialize the Canvas EXACTLY ONCE
  useEffect(() => {
    if (!map || !(L as any).heatLayer) return;

    const heatLayer = (L as any).heatLayer([], {
      radius: 70,
      blur: 50,
      maxZoom: 17,
      gradient: { 0.0: '#22c55e', 0.35: '#f59e0b', 0.65: '#ef4444', 1.0: '#991b1b' }
    });

    heatLayerRef.current = heatLayer;

    const attachLayer = () => {
      if (heatLayerRef.current && map && !map.hasLayer(heatLayerRef.current)) {
        heatLayerRef.current.addTo(map);
      }
    };

    if ((map as any)._loaded) {
      attachLayer();
    } else {
      map.whenReady(attachLayer);
    }

    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map]);

  // 3. Update the data flawlessly without destroying the canvas
  useEffect(() => {
    if (!heatLayerRef.current || !map) return;
    if (!(map as any)._loaded) return;
    if (!heatLayerRef.current._map) {
      if (!map.hasLayer(heatLayerRef.current)) {
        heatLayerRef.current.addTo(map);
      }
      if (!heatLayerRef.current._map) return;
    }

    heatLayerRef.current.setOptions({
      radius: 60,
      blur: 40
    });

    if (isVisible && heatPoints.length > 0) {
      heatLayerRef.current.setLatLngs(heatPoints);
    } else {
      // CLEAR the canvas instantly when toggled OFF or if no data exists
      heatLayerRef.current.setLatLngs([]);
    }
  }, [heatPoints, isVisible, mode, map]);

  return null;
};

const BhopalMap = () => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [congestion, setCongestion] = useState<any>({});
  const [accidents, setAccidents] = useState<any[]>([]);

  // 🎛️ Control Panel States
  const [selectedHour, setSelectedHour] = useState<number>(new Date().getHours());
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showTrafficFlow, setShowTrafficFlow] = useState<boolean>(true);
  const [timeframeMode, setTimeframeMode] = useState<'hourly' | 'daily'>('hourly');

  const API_BASE_URL = 'http://127.0.0.1:8000';
  const token = localStorage.getItem('access_token');

  // --- BhopalMap.tsx ---
  const fetchMapData = async () => {
    try {
      const [camRes, conRes, accRes] = await Promise.all([
        apiService.getCameras(),
        apiService.getCongestion(),
        apiService.getLiveAccidents() // 👈 Use the GIS endpoint, not analytics
      ]);
      setNodes(camRes.data || []);
      setCongestion((conRes.data || []).reduce((acc: any, curr: any) => ({ ...acc, [curr.camera_id]: curr }), {}));

      // Ensure data is mapped correctly for the useMemo hook in HeatLayer
      setAccidents(accRes.data || []);
    } catch (err) {
      console.error("GIS Grid Sync Failed");
    }
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 5000);
    return () => clearInterval(interval);
  }, []);

  const getRoadColor = (level: number) => {
    if (level >= 71) return '#ef4444';
    if (level >= 31) return '#f59e0b';
    return '#22c55e';
  };

  const getAccidentSeverityScore = (acc: any) => {
    const severityBase = acc.severity === 'Major' ? 80 : acc.severity === 'Moderate' ? 50 : 25;
    return severityBase + (acc.injuries || 0) * 15 + (acc.fatalities || 0) * 30;
  };

  const getAccidentZoneColor = (acc: any) => {
    const score = getAccidentSeverityScore(acc);
    if (score >= 70) return '#ef4444';
    if (score >= 40) return '#f59e0b';
    return '#22c55e';
  };

  const getAccidentZoneRadius = (acc: any) => {
    const score = getAccidentSeverityScore(acc);
    // Increased base radius to match the bold GIS style of congestion zones
    return Math.min(450, 200 + score * 2.5);
  };

  return (
    <div className="h-full w-full rounded-[2rem] overflow-hidden border border-slate-200 shadow-xl relative bg-white flex flex-col">
      <MapContainer center={[23.2599, 77.4126]} zoom={13} style={{ height: '100%', width: '100%', flexGrow: 1 }}>

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Standard View">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite View">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* 🔥 The Heatmap is always mounted, but controls its own visibility data */}
        <HeatLayer data={accidents} hour={selectedHour} mode={timeframeMode} isVisible={showHeatmap} />

        {/* 🚨 Explicit Accident Zones (ALWAYS VISIBLE, Never removed) */}
        {showHeatmap && accidents.map((acc) => {
          if (!acc.latitude || !acc.longitude) return null; // Safe check against DB nulls
          return (
            <Circle
              key={`acc-${acc.id ?? `${acc.latitude}-${acc.longitude}`}`}
              center={[acc.latitude, acc.longitude]}
              radius={getAccidentZoneRadius(acc)}
              pathOptions={{
                fillColor: getAccidentZoneColor(acc),
                color: getAccidentZoneColor(acc),
                fillOpacity: 0.15,
                opacity: 0.9,
                weight: 2,
                dashArray: '6 6'
              }}
            />
          );
        })}

        {nodes.map((node) => {
          const telemetry = congestion[node.id] || {};
          const roadLine: [number, number][] = [
            [node.latitude - 0.0015, node.longitude],
            [node.latitude + 0.0015, node.longitude]
          ];

          return (
            <React.Fragment key={node.id}>
              {showTrafficFlow && (
                <>
                  {/* 🚦 Congestion Zone Circle around the Node */}
                  <Circle
                    center={[node.latitude, node.longitude]}
                    radius={350} // 350m congestion scan zone
                    pathOptions={{
                      fillColor: getRoadColor(telemetry.congestion_level || 0),
                      color: getRoadColor(telemetry.congestion_level || 0),
                      fillOpacity: 0.15,
                      opacity: 0.9,
                      weight: 2,
                      dashArray: '6 6'
                    }}
                  />
                  {/* 🚦 Congestion Line */}
                  <Polyline
                    positions={roadLine}
                    pathOptions={{
                      color: getRoadColor(telemetry.congestion_level || 0),
                      weight: 12,
                      opacity: 0.6
                    }}
                  />
                </>
              )}

              <Marker position={[node.latitude, node.longitude]} icon={createPoleIcon(true, telemetry.is_emergency)}>
                <Popup>
                  <div className="w-64 font-sans overflow-hidden rounded-lg">
                    <img
                      src={`${API_BASE_URL}/cameras/live/${node.id}?token=${token}`}
                      className="w-full aspect-video object-cover bg-black"
                      onError={(e) => { e.currentTarget.src = "https://placehold.co/300x200?text=OFFLINE"; }}
                    />
                    <div className="p-3 bg-white">
                      <h4 className="text-sm font-bold text-slate-800 uppercase leading-none">{node.location_name}</h4>
                      <p className="text-[8px] text-slate-400 font-bold mt-1 uppercase tracking-widest">ID: {node.id.slice(0, 8)}</p>
                      <div className="flex justify-between mt-3 border-t pt-2 items-center">
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                          <Activity size={12} /> {telemetry.vehicle_count || 0} Veh
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${telemetry.is_emergency ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
                          {telemetry.is_emergency ? 'Emergency' : 'Stable'}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-[10px] text-slate-500">
                        <div className="flex justify-between">
                          <span className="font-black uppercase">Danger</span>
                          <span>{telemetry.danger_level || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-black uppercase">WSI</span>
                          <span>{telemetry.wsi_score != null ? telemetry.wsi_score : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* 🎛️ ADVANCED CONTROL PANEL */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-[90%] max-w-3xl bg-white/95 backdrop-blur-xl p-6 rounded-[2rem] shadow-2xl border border-slate-200">

        <div className="flex justify-between items-center mb-4">
          <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-2 tracking-widest">
            <Clock size={14} className="text-purple-600" /> GIS Control Center
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTrafficFlow(!showTrafficFlow)}
              className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all shadow-sm ${showTrafficFlow ? 'bg-green-500/10 text-green-600 border-green-500/30' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'}`}
            >
              🚦 Flow: {showTrafficFlow ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all shadow-sm ${showHeatmap ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'}`}
            >
              ⚠️ Heatmap: {showHeatmap ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setTimeframeMode(m => m === 'hourly' ? 'daily' : 'hourly')}
              className="px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border bg-purple-500/10 text-purple-600 border-purple-500/30 hover:bg-purple-500/20 transition-all shadow-sm"
            >
              {timeframeMode === 'hourly' ? '⏱️ Hourly Analysis' : '📅 Full Day Mode'}
            </button>

            {timeframeMode === 'hourly' && (
              <span className="text-sm font-black text-purple-600 italic ml-2 min-w-[70px]">
                {selectedHour}:00 {selectedHour >= 12 ? 'PM' : 'AM'}
              </span>
            )}
          </div>
        </div>

        {timeframeMode === 'hourly' ? (
          <input
            type="range" min="0" max="23" value={selectedHour}
            onChange={(e) => setSelectedHour(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          />
        ) : (
          <div className="w-full text-center py-2 bg-purple-500/5 rounded-xl border border-purple-500/10">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-600/60">
              Aggregating 24-Hour Accident Data Clusters
            </span>
          </div>
        )}
      </div>

      {/* 🧭 GIS LEGEND */}
      <div className="absolute top-24 left-6 z-[1000] bg-white/90 backdrop-blur-md shadow-lg border border-slate-200 p-4 rounded-3xl flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-purple-600 shadow-[0_0_10px_#9333ea]"></div>
          <span className="text-[9px] font-black text-slate-700 uppercase">AI Smart Pole</span>
        </div>
        <div className="flex items-center gap-3 border-t pt-2 border-slate-100">
          <div className="w-6 h-1.5 rounded-full bg-green-500"></div>
          <span className="text-[9px] font-black text-slate-700 uppercase">Clear Flow</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-red-500"></div>
          <span className="text-[9px] font-black text-slate-700 uppercase">Incident Heat</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-[9px] font-black text-slate-700 uppercase">Low Risk Accident</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span className="text-[9px] font-black text-slate-700 uppercase">Medium Risk Accident</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-[9px] font-black text-slate-700 uppercase">High Risk Accident</span>
        </div>
        <div className="flex items-center gap-3 border-t pt-2 border-slate-100">
          <div className="w-3 h-3 rounded-full border-2 border-dashed border-green-500 bg-green-500/20"></div>
          <span className="text-[9px] font-black text-slate-700 uppercase">Congestion Zone</span>
        </div>
      </div>
    </div>
  );
};

export default BhopalMap;