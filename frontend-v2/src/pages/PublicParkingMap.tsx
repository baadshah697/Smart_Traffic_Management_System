import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import { Activity, Navigation, Satellite, Map } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const API_BASE = 'http://127.0.0.1:8000';

// ── Tile layer configs ────────────────────────────────────────────────────────
const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  // Labels overlay for satellite mode (roads/place names on top of imagery)
  satelliteLabels: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
    attribution: '',
    maxZoom: 19,
    maxNativeZoom: 19,
  },
};

// ── Parking marker icon ───────────────────────────────────────────────────────
const createParkingIcon = (occupancyRate: number) => {
  const color =
    occupancyRate >= 100 ? '#ef4444' : occupancyRate > 80 ? '#f59e0b' : '#22c55e';
  return L.divIcon({
    className: '',
    html: `<div style="
              background-color: ${color};
              width: 40px; height: 40px;
              border-radius: 50%;
              border: 3px solid white;
              box-shadow: 0 4px 18px rgba(0,0,0,0.5);
              display: flex; align-items: center; justify-content: center;
              box-sizing: border-box;">
              <svg width="20" height="20" viewBox="0 0 24 24"
                   fill="none" stroke="white" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
                <path d="M9 16V8h4a2 2 0 0 1 0 4H9"/>
              </svg>
            </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
};

// ── AutoFitBounds — only re-fits when a NEW lot ID appears ───────────────────
// This prevents the 10-second poll from zooming the user back out.
const AutoFitBounds: React.FC<{ lots: any[] }> = ({ lots }) => {
  const map = useMap();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const hasInitialFit = useRef(false);

  useEffect(() => {
    const validLots = lots.filter((l) => l.latitude && l.longitude);
    if (validLots.length === 0) return;

    // Detect genuinely new lot IDs
    const newLots = validLots.filter((l) => !seenIdsRef.current.has(l.id));
    newLots.forEach((l) => seenIdsRef.current.add(l.id));

    // Only call fitBounds on first load OR when a new node is deployed
    if (!hasInitialFit.current || newLots.length > 0) {
      const bounds = L.latLngBounds(
        validLots.map((l) => [l.latitude, l.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
      hasInitialFit.current = true;
    }
  }, [lots, map]);

  return null;
};

// ── Layer toggle button (rendered inside MapContainer via portal-like div) ────
const LayerToggle: React.FC<{
  mode: 'street' | 'satellite';
  onToggle: () => void;
}> = ({ mode, onToggle }) => (
  <div
    style={{
      position: 'absolute',
      top: 16,
      right: 16,
      zIndex: 1000,
    }}
  >
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: mode === 'satellite' ? 'rgba(2,6,23,0.9)' : 'rgba(255,255,255,0.95)',
        color: mode === 'satellite' ? 'white' : '#111827',
        border: mode === 'satellite' ? '1px solid rgba(255,255,255,0.2)' : '1px solid #d1d5db',
        borderRadius: 12,
        padding: '8px 14px',
        fontWeight: 900,
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        transition: 'all 0.2s',
      }}
    >
      {mode === 'satellite' ? (
        <>
          <Map size={14} />
          Street View
        </>
      ) : (
        <>
          <Satellite size={14} />
          Satellite
        </>
      )}
    </button>
  </div>
);

// ── Legend ────────────────────────────────────────────────────────────────────
const MapLegend: React.FC<{ mode: 'street' | 'satellite' }> = ({ mode }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 24,
      left: 16,
      zIndex: 1000,
      background:
        mode === 'satellite'
          ? 'rgba(2,6,23,0.88)'
          : 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(12px)',
      border:
        mode === 'satellite'
          ? '1px solid rgba(255,255,255,0.1)'
          : '1px solid rgba(0,0,0,0.08)',
      borderRadius: 16,
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
      pointerEvents: 'none',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}
  >
    {[
      { color: '#22c55e', label: 'Available (≤80%)' },
      { color: '#f59e0b', label: 'Filling Up (>80%)' },
      { color: '#ef4444', label: 'Full (100%)' },
    ].map(({ color, label }) => (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 13,
            height: 13,
            borderRadius: '50%',
            background: color,
            border: '2px solid white',
            flexShrink: 0,
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        />
        <span
          style={{
            color: mode === 'satellite' ? 'white' : '#374151',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
      </div>
    ))}
  </div>
);

// ── Props ─────────────────────────────────────────────────────────────────────
interface PublicParkingMapProps {
  onRequestClick: (lotId: string, lotName: string) => void;
}

// ── Main component ────────────────────────────────────────────────────────────
const PublicParkingMap: React.FC<PublicParkingMapProps> = ({ onRequestClick }) => {
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapMode, setMapMode] = useState<'street' | 'satellite'>('street');

  const fetchLots = async () => {
    try {
      const res = await axios.get(`${API_BASE}/parking/public-lots`);
      setLots(res.data || []);
    } catch (e) {
      console.error('Failed to fetch parking lots:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLots();
    const interval = setInterval(fetchLots, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="w-full h-[640px] bg-slate-900 border border-white/10 rounded-[2rem] flex flex-col items-center justify-center">
        <Activity className="animate-spin text-purple-500 mb-4" size={48} />
        <p className="text-white font-black italic tracking-widest text-sm">
          INITIALIZING SATELLITE LINK...
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full h-[640px] bg-slate-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl"
      style={{ position: 'relative', zIndex: 10 }}
    >
      <MapContainer
        center={[23.2599, 77.4126]}
        zoom={12}
        minZoom={10}
        maxZoom={19}
        scrollWheelZoom
        zoomControl
        // Disable animation that can cause snap-back on zoom
        zoomAnimation={true}
        markerZoomAnimation={true}
        style={{ width: '100%', height: '100%', zIndex: 1 }}
      >
        {/* ── Base tile layer ─────────────────────────────────────────── */}
        <TileLayer
          key={mapMode} // forces re-mount when switching layers
          url={TILE_LAYERS[mapMode].url}
          attribution={TILE_LAYERS[mapMode].attribution}
          maxZoom={TILE_LAYERS[mapMode].maxZoom}
          maxNativeZoom={TILE_LAYERS[mapMode].maxNativeZoom}
          tileSize={256}
          detectRetina={true}
          crossOrigin="anonymous"
          keepBuffer={4}
          updateWhenIdle={false}
          updateWhenZooming={false}
        />

        {/* ── Labels overlay in satellite mode (shows road/area names) ── */}
        {mapMode === 'satellite' && (
          <TileLayer
            url={TILE_LAYERS.satelliteLabels.url}
            attribution=""
            maxZoom={19}
            maxNativeZoom={19}
            tileSize={256}
            detectRetina={true}
            crossOrigin="anonymous"
            opacity={0.85}
          />
        )}

        {/* ── Fit to bounds on first load & new node deployments only ── */}
        <AutoFitBounds lots={lots} />

        {/* ── Markers ─────────────────────────────────────────────────── */}
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
              <Popup maxWidth={240} autoPan={false}>
                <div style={{ padding: '6px 2px', minWidth: 210 }}>
                  <h3
                    style={{
                      fontWeight: 900, fontSize: 13,
                      textTransform: 'uppercase', fontStyle: 'italic',
                      color: '#111827', marginBottom: 2,
                    }}
                  >
                    {lot.name}
                  </h3>
                  <p
                    style={{
                      fontSize: 10, color: '#6b7280', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                      display: 'flex', alignItems: 'center', gap: 4,
                      marginBottom: 6,
                    }}
                  >
                    <Navigation size={10} /> {lot.location}
                  </p>

                  {/* Coordinates badge */}
                  <p
                    style={{
                      fontSize: 9, color: '#9ca3af', fontWeight: 700,
                      letterSpacing: '0.06em', marginBottom: 10,
                      background: '#f9fafb', borderRadius: 8,
                      padding: '4px 8px', display: 'inline-block',
                    }}
                  >
                    📍 {Number(lot.latitude).toFixed(5)}, {Number(lot.longitude).toFixed(5)}
                  </p>

                  {/* Stats */}
                  <div
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      background: '#f3f4f6', borderRadius: 12,
                      padding: 10, marginBottom: 10,
                    }}
                  >
                    {[
                      { label: 'Capacity',  value: lot.total_slots, color: '#111827' },
                      { label: 'Occupied',  value: lot.occupied,    color: '#dc2626' },
                      { label: 'Available', value: available,       color: '#16a34a' },
                    ].map(({ label, value, color }, i, arr) => (
                      <div
                        key={label}
                        style={{
                          textAlign: 'center',
                          ...(i > 0 && i < arr.length
                            ? { borderLeft: '1px solid #d1d5db', paddingLeft: 10 }
                            : {}),
                          ...(i < arr.length - 1
                            ? { paddingRight: 10 }
                            : {}),
                        }}
                      >
                        <p style={{ fontSize: 9, color: '#9ca3af', fontWeight: 900, textTransform: 'uppercase' }}>
                          {label}
                        </p>
                        <p style={{ fontWeight: 900, color, fontSize: 16 }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Occupancy bar */}
                  <div
                    style={{
                      height: 6, background: '#e5e7eb', borderRadius: 9999,
                      marginBottom: 12, overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(occupancyRate, 100)}%`,
                        background:
                          occupancyRate >= 100 ? '#ef4444'
                          : occupancyRate > 80  ? '#f59e0b'
                                                : '#22c55e',
                        borderRadius: 9999,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestClick(lot.id, lot.name);
                    }}
                    disabled={available <= 0}
                    style={{
                      width: '100%',
                      background: available <= 0 ? '#9ca3af' : '#7c3aed',
                      color: 'white',
                      padding: '10px 0',
                      borderRadius: 12,
                      fontWeight: 900,
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      border: 'none',
                      cursor: available <= 0 ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (available > 0)
                        (e.currentTarget as HTMLButtonElement).style.background = '#111827';
                    }}
                    onMouseLeave={(e) => {
                      if (available > 0)
                        (e.currentTarget as HTMLButtonElement).style.background = '#7c3aed';
                    }}
                  >
                    {available <= 0 ? '🔴 LOT FULL' : '🟢 REQUEST SPOT'}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ── Overlays (outside Leaflet DOM so no z-index conflicts) ─── */}
      <LayerToggle mode={mapMode} onToggle={() => setMapMode(m => m === 'street' ? 'satellite' : 'street')} />
      <MapLegend mode={mapMode} />
    </div>
  );
};

export default PublicParkingMap;
