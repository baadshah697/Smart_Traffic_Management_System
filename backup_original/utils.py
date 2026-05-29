import cv2
import uuid
import time
import os
import re
import numpy as np
import threading
from datetime import datetime, timedelta
from ultralytics import YOLO
import easyocr
import torch
from app.database import supabase

# ─────────────────────────────────────────────────────────────
# 1. INITIALIZATION & HARDWARE SETUP
# ─────────────────────────────────────────────────────────────
ai_lock = threading.Lock() 
# Strict pattern from your citizen.py to ensure database integrity
INDIAN_PLATE_PATTERN = r"^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
EVIDENCE_PATH = os.path.join(BASE_DIR, "static", "evidence")
os.makedirs(EVIDENCE_PATH, exist_ok=True)

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"🚀 ENGINE BOOT: V.I.TA.L.S. [Device: {device}]", flush=True)

# Loading the Dual-Model Pipeline
det_model = YOLO(os.path.join(MODELS_DIR, "yolov8n.pt")).to(device)
custom_model = YOLO(os.path.join(MODELS_DIR, "best.pt")).to(device)
plate_reader = easyocr.Reader(['en'], gpu=True if device == "cuda" else False)

recent_violations = {}

# ─────────────────────────────────────────────────────────────
# 2. VISION GEOMETRY HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────
def letterbox_frame(frame, target=640):
    r"""Pads frame to 640x640 to maintain aspect ratio for small object detection."""
    h, w = frame.shape[:2]
    scale = target / max(h, w)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = cv2.resize(frame, (new_w, new_h))
    pt, pl = (target - new_h) // 2, (target - new_w) // 2
    padded = cv2.copyMakeBorder(resized, pt, target-new_h-pt, pl, target-new_w-pl, 
                                cv2.BORDER_CONSTANT, value=(114, 114, 114))
    return padded, scale, pt, pl

def unpad_box(box, scale, pt, pl):
    """Maps 640x640 inference coordinates back to the original HD frame."""
    return (int((box[0]-pl)/scale), int((box[1]-pt)/scale), 
            int((box[2]-pl)/scale), int((box[3]-pt)/scale))

def compute_iou(boxA, boxB):
    """Calculates intersection over union for spatial association."""
    xA, yA = max(boxA[0], boxB[0]), max(boxA[1], boxB[1])
    xB, yB = min(boxA[2], boxB[2]), min(boxA[3], boxB[3])
    inter = max(0, xB - xA) * max(0, yB - yA)
    if inter == 0: return 0.0
    areaA = (boxA[2]-boxA[0])*(boxA[3]-boxA[1])
    areaB = (boxB[2]-boxB[0])*(boxB[3]-boxB[1])
    return inter / float(areaA + areaB - inter)

def helmet_covers_head_zone(helmet_box, rider_box):
    """Mathematical Negative Logic: Is the helmet inside the top 35% of the rider?"""
    hx1, hy1, hx2, hy2 = helmet_box
    rx1, ry1, rx2, ry2 = rider_box
    h_cx, h_cy = (hx1 + hx2) / 2, (hy1 + hy2) / 2
    head_zone_limit = ry1 + (ry2 - ry1) * 0.35 
    return (rx1 - 25 < h_cx < rx2 + 25) and (ry1 - 20 < h_cy < head_zone_limit)

def is_ambulance_heuristic(crop):
    """HSV Color isolation for emergency red."""
    if crop.size == 0: return False
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    mask = cv2.bitwise_or(cv2.inRange(hsv, np.array([0, 120, 70]), np.array([10, 255, 255])),
                          cv2.inRange(hsv, np.array([170, 120, 70]), np.array([180, 255, 255])))
    return (np.sum(mask > 0) / (crop.shape[0] * crop.shape[1])) * 100 > 3.0

# ─────────────────────────────────────────────────────────────
# 3. OPTIMIZED OCR
# ─────────────────────────────────────────────────────────────
def execute_ocr(plate_boxes, bike_box, frame):
    """Standardized OCR: Cleans formatting to match citizen.py search logic."""
    bx1, by1, bx2, by2 = bike_box
    for p_box in plate_boxes:
        px1, py1, px2, py2 = p_box
        if px1 > bx1-60 and px2 < bx2+60 and py1 > by1-60:
            crop = frame[max(0, py1):py2, max(0, px1):px2]
            if crop.size == 0: continue
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            res = plate_reader.readtext(gray, detail=0)
            if res:
                # Remove spaces and dashes so the result is a clean string
                raw_txt = "".join(res).upper().replace(" ", "").replace("-", "")
                if re.match(INDIAN_PLATE_PATTERN, raw_txt):
                    print(f"🔤 [OCR] Plate Extracted: {raw_txt}", flush=True)
                    return raw_txt
    return "UNKNOWN"

# ─────────────────────────────────────────────────────────────
# 4. THE MAIN INTELLIGENCE LOOP
# ─────────────────────────────────────────────────────────────
# --- 4. THE HIGH-SPEED INTELLIGENCE LOOP ---
active_enforcement_zones = {} 

def process_frame(frame, camera_id):
    vehicle_count, is_emergency = 0, False
    
    # 1. PRIMARY TRACKER (Model 1)
    with ai_lock:
        gen_res = det_model.track(frame, persist=True, verbose=False, conf=0.3, imgsz=640)

    # Pre-cache persons for faster spatial lookup
    model1_persons = [p for p in gen_res[0].boxes if int(p.cls[0]) == 0]

    for b in gen_res[0].boxes:
        if b.id is None: continue
        track_id = int(b.id[0])
        x1, y1, x2, y2 = map(int, b.xyxy[0])
        cls = int(b.cls[0])
        
        # Traffic Telemetry
        if cls in [2, 3, 5, 7]: 
            vehicle_count += 1
            if cls in [5, 7] and is_ambulance_heuristic(frame[y1:y2, x1:x2]):
                is_emergency = True
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # 2. 🔥 INSTANT DYNAMIC STRETCH
        if cls == 3: # Motorcycle
            r_boxes, h_boxes, p_boxes = [], [], []
            
            # Persistent memory for this vehicle
            if track_id not in active_enforcement_zones:
                active_enforcement_zones[track_id] = y1 
            
            # Expanded Search Strip (Reaches higher to catch fast-moving heads)
            search_y1 = max(0, y1 - int((y2-y1) * 1.5)) 
            search_strip = frame[search_y1:y2, x1:x2]

            if search_strip.size > 0:
                with ai_lock:
                    cust_res = custom_model(search_strip, verbose=False, conf=0.15, imgsz=320)
                
                c_boxes = cust_res[0].boxes
                r_boxes = [list(map(int, r.xyxy[0])) for r in c_boxes if int(r.cls[0]) == 3]
                h_boxes = [list(map(int, h.xyxy[0])) for h in c_boxes if int(h.cls[0]) == 0]
                p_boxes = [list(map(int, p.xyxy[0])) for p in c_boxes if int(p.cls[0]) == 1]

                # 🔥 INSTANT LOCK LOGIC
                if r_boxes:
                    # Find the absolute highest head coordinate in the ROI
                    absolute_highest = min([r[1] + search_y1 for r in r_boxes])
                    
                    # Instead of moving by a percentage, we SNAP to the head instantly
                    # We add a 20px "Safety Buffer" above the head for the helmet
                    active_enforcement_zones[track_id] = max(0, absolute_highest - 20)

            # Define the 'Full Frame Evidence' box using the Instant Snap y-coordinate
            stretched_y1 = active_enforcement_zones[track_id]
            full_cluster_crop = frame[stretched_y1:y2, x1:x2]
            
            # Visual Feedback (Orange Box)
            cv2.rectangle(frame, (x1, stretched_y1), (x2, y2), (255, 120, 0), 2)

            # OCR Lookup (Simplified for speed)
            plate_txt = execute_ocr(p_boxes, [x1, y1, x2, y2], frame)

            # --- DUAL-MODEL TRIPLE RIDING CHECK ---
            m1_count = sum(1 for p in model1_persons if compute_iou(list(map(int, p.xyxy[0])), [x1, stretched_y1, x2, y2]) > 0.1)
            final_count = max(len(r_boxes), m1_count)

            if final_count >= 3:
                cv2.putText(frame, f"TRIPLE RIDING: {final_count}", (x1, stretched_y1-10), 0, 0.7, (0,0,255), 2)
                post_violation_direct("Triple Riding", plate_txt, camera_id, 0.95, full_cluster_crop)

            # --- NO HELMET CHECK ---
            for r in r_boxes:
                gr = [r[0] + x1, r[1] + search_y1, r[2] + x1, r[3] + search_y1]
                head_zone = (gr[0], gr[1], gr[2], gr[1] + int((gr[3]-gr[1])*0.35))
                
                has_helmet = False
                for h in h_boxes:
                    gh = [h[0] + x1, h[1] + search_y1, h[2] + x1, h[3] + search_y1]
                    if compute_iou(head_zone, gh) > 0.15:
                        has_helmet = True
                        break
                
                if not has_helmet:
                    cv2.putText(frame, "NO HELMET", (gr[0], gr[1]-10), 0, 0.5, (0,0,255), 2)
                    post_violation_direct("No Helmet", plate_txt, camera_id, 0.85, full_cluster_crop)

    # Cache Cleanup
    if len(active_enforcement_zones) > 30: active_enforcement_zones.clear()
    
    sync_telemetry(camera_id, vehicle_count, is_emergency)
# ─────────────────────────────────────────────────────────────
# 5. DATA SYNC (Aligned with Backend Schema)
# ─────────────────────────────────────────────────────────────
def post_violation_direct(v_type, plate_number, cam_id, conf, crop):
    # Standardize plate: Ensure it matches your SQL 'vehicle_number' format
    clean_plate = re.sub(r'[^A-Z0-9]', '', plate_number.upper())
    
    # 15-Second Spatiotemporal Cooldown
    cache_key = f"{cam_id}_{v_type}_{clean_plate}"
    if cache_key in recent_violations and time.time() - recent_violations[cache_key] < 15: return
    recent_violations[cache_key] = time.time()

    if crop is None or crop.size == 0: return
    v_id = str(uuid.uuid4())
    img_name = f"ev_{uuid.uuid4().hex[:8]}.jpg"
    cv2.imwrite(os.path.join(EVIDENCE_PATH, img_name), crop)

    # 1. ALWAYS LOG VIOLATION
    payload = {
        "id": v_id,
        "camera_id": str(cam_id), 
        "violation_type": v_type,
        "evidence_image_url": f"http://localhost:8000/static/evidence/{img_name}",
        "confidence_score": float(conf), 
        "plate_number": clean_plate if clean_plate not in ["UNKNOWN", "PENDING"] else "UNKNOWN",
        "status": "pending",
        "detected_at": datetime.utcnow().isoformat()
    }
    
    try:
        supabase.table("violations").insert(payload).execute()
        
        # 2. 🔥 FORCE CHALLAN (Regardless of vehicle registration)
        # Attempt to find owner, but don't stop if not found
        v_res = supabase.table("vehicles").select("owner_id, owner_name").eq("plate_number", clean_plate).execute()
        
        owner_id = v_res.data[0].get('owner_id') if v_res.data else None
        owner_name = v_res.data[0].get('owner_name', "Unregistered Vehicle") if v_res.data else "Unregistered Vehicle"

        fine = 1000 if v_type == "Triple Riding" else 500
        
        challan_payload = {
            "id": str(uuid.uuid4()),
            "violation_id": v_id,
            "vehicle_number": payload["plate_number"],
            "amount": fine,
            "status": "unpaid",
            "owner_name": owner_name,
            "owner_id": owner_id, # Will be NULL in DB if vehicle not in table
            "issued_at": datetime.utcnow().isoformat(),
            "due_date": (datetime.utcnow() + timedelta(days=15)).isoformat()
        }

        supabase.table("e_challans").insert(challan_payload).execute()
        print(f"✅ [SUCCESS] Challan Forced for {payload['plate_number']} (Registry: {'Linked' if owner_id else 'Unregistered'})", flush=True)

    except Exception as e:
        print(f"❌ [DATABASE SYNC ERROR] {e}", flush=True)

def sync_telemetry(cam_id, count, emergency):
    try:
        density = min(100, int((count / 20) * 100))
        supabase.table("congested_roads").update({
            "vehicle_count": count, "congestion_level": density,
            "is_emergency": emergency, "last_updated": datetime.utcnow().isoformat()
        }).eq("camera_id", str(cam_id)).execute()
    except: pass