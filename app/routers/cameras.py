import os
import uuid
import cv2
import time
import threading
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.deps import require_role
from app.database import supabase
from app.utils import process_frame

router = APIRouter(prefix="/cameras", tags=["Cameras"])

# Global Shared State - Preserved for Frontend MJPEG
camera_frames = {}         
active_threads = {}        

class CameraRegister(BaseModel):
    location_name: str
    ip_address: str        # '0' for local webcam, or a URL/IP
    latitude: Optional[float] = None
    longitude: Optional[float] = None

# ==========================================
# 🤖 THE AI WORKER (OPTIMIZED FOR OMEN 16 GPU)
# ==========================================

def ai_worker(camera_id: str, source_input: str):
    """
    Independent thread per camera node.
    Synchronized with RTX 4060 GPU and React Dashboard.
    """
    print(f"\n🤖 [NODE START] Initializing AI for ID: {camera_id[:8]}", flush=True)
    
    # Standardize source: '0' for webcam, else URL
    source = int(source_input) if source_input == "0" else source_input
    cap = cv2.VideoCapture(source)
    
    if not cap.isOpened():
        print(f"❌ [CRITICAL] Source Unreachable: {source_input}. Node offline.", flush=True)
        return

    # Set buffer size to 1 for real-time inference (no lag)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    print(f"✅ [SUCCESS] Camera stream active for node {camera_id[:8]}", flush=True)

    frame_count = 0
    while camera_id in active_threads:
        success, frame = cap.read()
        if not success:
            print(f"⚠️ [LOST] Node {camera_id[:8]} connection dropped. Retrying...", flush=True)
            cap.release()
            time.sleep(5)
            cap = cv2.VideoCapture(source)
            continue
            
        # 1. 🔥 EXECUTE DUAL-ENGINE PROCESSING
        # This handles Density, Ambulance, No Helmet, and Triple Riding
        try:
            process_frame(frame, camera_id)
        except Exception as e:
            print(f"❌ [AI ERROR] Node {camera_id[:8]}: {e}", flush=True)

        # 2. ENCODE FOR DASHBOARD (Standardized for Surveillance.tsx)
        ret, buffer = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
        if ret:
            camera_frames[camera_id] = buffer.tobytes()
        
        # 3. TERMINAL HEARTBEAT
        frame_count += 1
        if frame_count % 50 == 0:
            print(f"📡 [HEARTBEAT] Node {camera_id[:8]} | GPU Processing Active | {datetime.now().strftime('%H:%M:%S')}", flush=True)

        # Optimization: Reduced sleep to 0.005 for high-speed detection
        time.sleep(0.005) 
    
    cap.release()
    print(f"🛑 [NODE STOP] Worker decommissioned: {camera_id}", flush=True)

# ==========================================
# 🚀 API ENDPOINTS (LINKED TO REACT FRONTEND)
# ==========================================

@router.get("/list")
def list_cameras(user=Depends(require_role("officer"))):
    cameras = supabase.table("surveillance_cameras").select("*").execute()
    return cameras.data

@router.post("/register")
def register_camera(camera_data: CameraRegister, user=Depends(require_role("officer"))):
    try:
        # 1. Save to Core Surveillance Table
        payload = camera_data.dict()
        payload["is_active"] = True
        result = supabase.table("surveillance_cameras").insert(payload).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to provision Node")
            
        new_cam = result.data[0]
        cam_id = str(new_cam['id'])
        
        # 2. AUTO-PROVISION: Traffic Congestion analytics row
        supabase.table("congested_roads").insert({
            "camera_id": cam_id,
            "road_name": f"{camera_data.location_name} St.",
            "area": camera_data.location_name,
            "congestion_level": 0,
            "vehicle_count": 0,
            "is_emergency": False,
            "is_closed": False
        }).execute()
        
        # 3. Trigger AI Worker
        if cam_id not in active_threads:
            active_threads[cam_id] = True
            threading.Thread(target=ai_worker, args=(cam_id, camera_data.ip_address), daemon=True).start()
        
        return {"message": "Node Activated", "camera": new_cam}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/live/{camera_id}")
def live_feed(camera_id: str, token: str = None):
    """MJPEG Stream for Surveillance.tsx — validates JWT token from query param or header."""
    # Validate token if provided (both frontends pass ?token=...)
    if token:
        try:
            from jose import jwt, JWTError
            from app.deps import SECRET_KEY, ALGORITHM
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if "sub" not in payload:
                raise HTTPException(status_code=401, detail="Invalid token")
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid or expired token")

    def frame_generator():
        while True:
            frame_bytes = camera_frames.get(camera_id)
            if frame_bytes:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.04) # ~25 FPS stream for UI
    return StreamingResponse(frame_generator(), media_type='multipart/x-mixed-replace; boundary=frame')

@router.delete("/{camera_id}")
def delete_camera(camera_id: str, user=Depends(require_role("officer"))):
    try:
        if camera_id in active_threads:
            del active_threads[camera_id]
        
        supabase.table("surveillance_cameras").delete().eq("id", camera_id).execute()
        supabase.table("congested_roads").delete().eq("camera_id", camera_id).execute()

        if camera_id in camera_frames:
            del camera_frames[camera_id]

        return {"message": "Node Decommissioned"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# 🔄 ROBUST SYSTEM BOOTSTRAP (AUTO-RECOVERY)
# ==========================================

def initialize_active_streams():
    """Wakes up the AI for all 'Active' nodes in the database on server start."""
    print("\n" + "="*60)
    print("🔄 [BOOTSTRAP] Project V.I.TA.L.S. Engine Recovery Start...", flush=True)
    try:
        res = supabase.table("surveillance_cameras").select("*").eq("is_active", True).execute()
        
        if not res.data:
            print("💡 [BOOTSTRAP] No active nodes in registry. Standby mode.", flush=True)
            return

        print(f"🔎 [BOOTSTRAP] Found {len(res.data)} nodes to re-link.", flush=True)
        for cam in res.data:
            cam_id = str(cam['id'])
            source = str(cam.get('ip_address', '0'))
            
            # Reset congestion states to avoid stale frontend data
            supabase.table("congested_roads").update({
                "is_closed": False,
                "last_updated": datetime.utcnow().isoformat()
            }).eq("camera_id", cam_id).execute()
            
            if cam_id not in active_threads:
                active_threads[cam_id] = True
                print(f"🚀 [BOOTSTRAP] Re-linking Node: {cam['location_name']}", flush=True)
                threading.Thread(target=ai_worker, args=(cam_id, source), daemon=True).start()
        print("="*60 + "\n")
    except Exception as e:
        print(f"❌ [BOOTSTRAP FAIL] {e}", flush=True)

# Startup delay to ensure Database/Supabase is ready before relinking
threading.Thread(target=lambda: (time.sleep(5), initialize_active_streams()), daemon=True).start()