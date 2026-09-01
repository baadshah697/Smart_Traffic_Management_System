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
from concurrent.futures import ThreadPoolExecutor
from app.database import create_supabase_client

# ─────────────────────────────────────────────────────────────
# 1. INITIALIZATION & HARDWARE SETUP
# ─────────────────────────────────────────────────────────────
ai_lock = threading.Lock() 
# Robust Indian license plate regex pattern
INDIAN_PLATE_PATTERN = r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$"

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

# ─── Custom Model Class Map (verified from best.pt) ───
# {0: 'Helmet', 1: 'Licence Plate', 2: 'Motorcycle', 3: 'Person'}
CUSTOM_CLS_HELMET = 0
CUSTOM_CLS_PLATE  = 1
CUSTOM_CLS_MOTO   = 2
CUSTOM_CLS_PERSON = 3

# ─── Background I/O Thread Pool ───
_bg_pool = ThreadPoolExecutor(max_workers=3, thread_name_prefix="vitals_io")
_thread_local = threading.local()

def _get_bg_supabase():
    """Per-thread Supabase client (no socket sharing between threads)."""
    if not hasattr(_thread_local, 'supabase'):
        _thread_local.supabase = create_supabase_client()
    return _thread_local.supabase

# ─── Cooldown & Tracking State ───
_violation_cooldown = {}
_COOLDOWN_SECONDS = 15
_MAX_COOLDOWN_ENTRIES = 200

# ─────────────────────────────────────────────────────────────
# 2. HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────
def compute_iou(boxA, boxB):
    """Calculates intersection over union for spatial association."""
    xA, yA = max(boxA[0], boxB[0]), max(boxA[1], boxB[1])
    xB, yB = min(boxA[2], boxB[2]), min(boxA[3], boxB[3])
    inter = max(0, xB - xA) * max(0, yB - yA)
    if inter == 0: return 0.0
    areaA = (boxA[2]-boxA[0])*(boxA[3]-boxA[1])
    areaB = (boxB[2]-boxB[0])*(boxB[3]-boxB[1])
    return inter / float(areaA + areaB - inter)

def box_contains(outer, inner_center):
    """Check if a point (cx, cy) is inside a box [x1,y1,x2,y2]."""
    cx, cy = inner_center
    return outer[0] <= cx <= outer[2] and outer[1] <= cy <= outer[3]

def box_center(box):
    """Returns (cx, cy) of a box."""
    return ((box[0]+box[2])//2, (box[1]+box[3])//2)

def is_ambulance_heuristic(crop):
    """HSV Color isolation for emergency red."""
    if crop.size == 0: return False
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    mask = cv2.bitwise_or(cv2.inRange(hsv, np.array([0, 120, 70]), np.array([10, 255, 255])),
                          cv2.inRange(hsv, np.array([170, 120, 70]), np.array([180, 255, 255])))
    return (np.sum(mask > 0) / (crop.shape[0] * crop.shape[1])) * 100 > 3.0

# ─────────────────────────────────────────────────────────────
# 3. OCR FUNCTIONS
# ─────────────────────────────────────────────────────────────

LETTERS_TO_DIGITS = {
    'O': '0', 'I': '1', 'Z': '2', 'S': '5', 'B': '8', 'G': '6', 'T': '7', 'D': '0'
}
DIGITS_TO_LETTERS = {
    '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B'
}

def to_letter(c):
    return DIGITS_TO_LETTERS.get(c, c)

def to_digit(c):
    return LETTERS_TO_DIGITS.get(c, c)

def normalize_indian_plate(text):
    text = re.sub(r'[^A-Z0-9]', '', text.upper())
    if len(text) < 7:
        return None
    
    best_overall_score = -1
    best_overall_plate = None
    
    # Try all substrings of length 7 to 10
    for length in range(7, min(11, len(text) + 1)):
        for start in range(len(text) - length + 1):
            candidate = text[start:start+length]
            
            # State code: first 2 chars must be letters
            state = to_letter(candidate[0]) + to_letter(candidate[1])
            state_score = 0
            for c in candidate[:2]:
                if c.isalpha(): state_score += 2
                elif c in DIGITS_TO_LETTERS: state_score += 1
            
            remaining = candidate[2:]
            L = len(remaining)
            
            for d in [1, 2]:
                for s in [0, 1, 2, 3]:
                    for n in [1, 2, 3, 4]:
                        if d + s + n == L:
                            dist_part = remaining[:d]
                            ser_part = remaining[d:d+s]
                            num_part = remaining[d+s:]
                            
                            score = state_score
                            for char in dist_part:
                                if char.isdigit(): score += 2
                                elif char in LETTERS_TO_DIGITS: score += 1
                            for char in ser_part:
                                if char.isalpha(): score += 2
                                elif char in DIGITS_TO_LETTERS: score += 1
                            for char in num_part:
                                if char.isdigit(): score += 2
                                elif char in LETTERS_TO_DIGITS: score += 1
                                
                            # Preference weight for common plate length distributions
                            if L == 8 and d == 2 and s == 2 and n == 4:
                                score += 0.5
                            elif L == 7 and d == 2 and s == 1 and n == 4:
                                score += 0.5
                            elif L == 7 and d == 1 and s == 2 and n == 4:
                                score += 0.5
                            elif L == 6 and d == 2 and s == 0 and n == 4:
                                score += 0.5
                                
                            if score > best_overall_score:
                                best_overall_score = score
                                normalized_dist = "".join(to_digit(c) for c in dist_part)
                                normalized_ser = "".join(to_letter(c) for c in ser_part)
                                normalized_num = "".join(to_digit(c) for c in num_part)
                                best_overall_plate = state + normalized_dist + normalized_ser + normalized_num
                                
    return best_overall_plate

def preprocess_plate_crop(crop, upscale=True):
    if crop is None or crop.size == 0:
        return None
    h, w = crop.shape[:2]
    # Scale crop to minimum 200px width for better OCR readability
    if upscale and w < 200:
        scale = 200.0 / w
        new_w = 200
        new_h = int(h * scale)
        crop = cv2.resize(crop, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
    
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.bilateralFilter(gray, 9, 75, 75)
    return gray

def run_ocr_pipeline(crop):
    """Runs OCR pipeline with preprocessing and retry logic."""
    gray = preprocess_plate_crop(crop)
    if gray is None:
        return "UNKNOWN"
        
    # Attempt 1: Standard preprocessed gray
    results = plate_reader.readtext(gray, detail=0)
    if results:
        raw_txt = "".join(results).upper().replace(" ", "").replace("-", "")
        print(f"🔎 [OCR RAW ATTEMPT 1] '{raw_txt}'", flush=True)
        normalized = normalize_indian_plate(raw_txt)
        if normalized and re.match(INDIAN_PLATE_PATTERN, normalized):
            print(f"🔤 [OCR PASS 1] Plate: {normalized}", flush=True)
            return normalized
            
    # Attempt 2: Adaptive thresholding
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
    results = plate_reader.readtext(thresh, detail=0)
    if results:
        raw_txt = "".join(results).upper().replace(" ", "").replace("-", "")
        print(f"🔎 [OCR RAW ATTEMPT 2] '{raw_txt}'", flush=True)
        normalized = normalize_indian_plate(raw_txt)
        if normalized and re.match(INDIAN_PLATE_PATTERN, normalized):
            print(f"🔤 [OCR PASS 2] Plate: {normalized}", flush=True)
            return normalized
            
    # Attempt 3: Inverted thresholding
    inverted = cv2.bitwise_not(thresh)
    results = plate_reader.readtext(inverted, detail=0)
    if results:
        raw_txt = "".join(results).upper().replace(" ", "").replace("-", "")
        print(f"🔎 [OCR RAW ATTEMPT 3] '{raw_txt}'", flush=True)
        normalized = normalize_indian_plate(raw_txt)
        if normalized and re.match(INDIAN_PLATE_PATTERN, normalized):
            print(f"🔤 [OCR PASS 3] Plate: {normalized}", flush=True)
            return normalized
            
    return "UNKNOWN"

def execute_ocr_on_crop(evidence_path):
    """Background OCR on saved evidence. Returns plate or 'UNKNOWN'."""
    try:
        img = cv2.imread(evidence_path)
        if img is None: return "UNKNOWN"
        return run_ocr_pipeline(img)
    except Exception as e:
        print(f"⚠️ [OCR ERROR] {e}", flush=True)
    return "UNKNOWN"

def try_ocr_on_plates(plate_boxes, frame):
    """Try OCR on each detected plate box (already in global coords)."""
    for px1, py1, px2, py2 in plate_boxes:
        crop = frame[max(0, py1):py2, max(0, px1):px2]
        if crop.size == 0: continue
        res_plate = run_ocr_pipeline(crop)
        if res_plate != "UNKNOWN":
            return res_plate
    return "UNKNOWN"

# ─────────────────────────────────────────────────────────────
# 4. PARALLEL DUAL-MODEL INTELLIGENCE LOOP
# ─────────────────────────────────────────────────────────────
def process_frame(frame, camera_id):
    vehicle_count, is_emergency = 0, False
    
    # ═══════════════════════════════════════════════════════════
    # PASS 1: Model 1 — Full-Frame Tracking (yolov8n)
    # Detects: person(0), car(2), motorcycle(3), bus(5), truck(7)
    # Provides: tracking IDs, vehicle counting, emergency detection
    # ═══════════════════════════════════════════════════════════
    with ai_lock:
        m1_res = det_model.track(frame, persist=True, verbose=False, conf=0.25, imgsz=640)

    # Collect all Model 1 detections by class
    m1_motorcycles = []  # [{box, track_id}]
    m1_persons = []      # [box]
    m1_vehicles = []     # [{box, cls}]
    
    for b in m1_res[0].boxes:
        cls = int(b.cls[0])
        box = list(map(int, b.xyxy[0]))
        tid = int(b.id[0]) if b.id is not None else None
        
        if cls in [2, 3, 5, 7]:
            vehicle_count += 1
            m1_vehicles.append({"box": box, "cls": cls, "tid": tid})
            
            if cls in [5, 7] and is_ambulance_heuristic(frame[box[1]:box[3], box[0]:box[2]]):
                is_emergency = True
            
            # Green tracking box for all vehicles
            cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), (0, 255, 0), 2)
        
        if cls == 0:  # Person
            m1_persons.append(box)
        
        if cls == 3 and tid is not None:  # Motorcycle with tracking
            m1_motorcycles.append({"box": box, "tid": tid})

    # ═══════════════════════════════════════════════════════════
    # PASS 2: Model 2 — Full-Frame Enforcement (best.pt)
    # Detects: Helmet(0), Plate(1), Motorcycle(2), Person(3)
    # Runs on the ENTIRE frame — no cropping, no coordinate hell
    # ═══════════════════════════════════════════════════════════
    with ai_lock:
        m2_res = custom_model(frame, verbose=False, conf=0.20, imgsz=640)

    # Collect all Model 2 detections (already in global frame coords)
    m2_persons = []   # [box]  — riders on bikes
    m2_helmets = []   # [box]  — helmet detections
    m2_plates = []    # [box]  — license plate detections  
    m2_motos = []     # [box]  — motorcycles M1 might have missed

    for b in m2_res[0].boxes:
        cls2 = int(b.cls[0])
        box = list(map(int, b.xyxy[0]))
        
        if cls2 == CUSTOM_CLS_PERSON:
            m2_persons.append(box)
        elif cls2 == CUSTOM_CLS_HELMET:
            m2_helmets.append(box)
        elif cls2 == CUSTOM_CLS_PLATE:
            conf = float(b.conf[0]) if b.conf is not None else 1.0
            if conf > 0.40:
                m2_plates.append(box)
        elif cls2 == CUSTOM_CLS_MOTO:
            m2_motos.append(box)

    # ═══════════════════════════════════════════════════════════
    # PASS 3: FUSION — Merge both models for violation reasoning
    # ═══════════════════════════════════════════════════════════
    
    # Step 3a: Build unified motorcycle list (M1 tracked + M2 extras)
    all_bikes = list(m1_motorcycles)  # Start with M1 (has tracking IDs)
    
    # Add motorcycles found by M2 that M1 missed
    for m2_box in m2_motos:
        m2_cx, m2_cy = box_center(m2_box)
        already_tracked = False
        for m1_bike in m1_motorcycles:
            if compute_iou(m2_box, m1_bike["box"]) > 0.3:
                already_tracked = True
                break
        if not already_tracked:
            # M2 found a motorcycle M1 missed — assign a pseudo-track-id
            pseudo_tid = hash(f"{m2_box[0]}_{m2_box[1]}_{m2_box[2]}") % 100000
            all_bikes.append({"box": m2_box, "tid": pseudo_tid})
            vehicle_count += 1  # Also count this missed vehicle

    # Step 3b: For each motorcycle, check violations
    for bike in all_bikes:
        bx1, by1, bx2, by2 = bike["box"]
        track_id = bike["tid"]
        
        # Expand the enforcement zone upward to include rider heads
        bike_h = by2 - by1
        expanded_box = [bx1, max(0, by1 - int(bike_h * 0.6)), bx2, by2]
        
        # Draw orange enforcement box
        cv2.rectangle(frame, (expanded_box[0], expanded_box[1]), 
                      (expanded_box[2], expanded_box[3]), (255, 120, 0), 2)

        # ─── Find M2 persons associated with this bike ───
        # A person belongs to this bike if their center falls within the expanded box
        bike_persons_m2 = []
        for p_box in m2_persons:
            pcx, pcy = box_center(p_box)
            if box_contains(expanded_box, (pcx, pcy)):
                bike_persons_m2.append(p_box)
        
        # ─── Find M1 persons associated with this bike ───
        # STRICT: person's center must be INSIDE the expanded box (not just IoU overlap)
        # This prevents nearby pedestrians/passengers in other vehicles from being counted
        bike_persons_m1 = []
        for p in m1_persons:
            pcx, pcy = box_center(p)
            if box_contains(expanded_box, (pcx, pcy)):
                bike_persons_m1.append(p)
        
        # ─── Find plates associated with this bike ───
        bike_plates = []
        for pl_box in m2_plates:
            pcx, pcy = box_center(pl_box)
            plate_zone = [bx1-30, by1 + int(bike_h*0.3), bx2+30, by2+30]
            if box_contains(plate_zone, (pcx, pcy)):
                bike_plates.append(pl_box)

        # OCR on associated plates
        plate_txt = try_ocr_on_plates(bike_plates, frame) if bike_plates else "UNKNOWN"

        # ─── Helmet check helper ───
        def rider_has_helmet(rider_box):
            """Check if the top 35% of the rider has a helmet overlapping."""
            rh = rider_box[3] - rider_box[1]
            head_zone = [rider_box[0], rider_box[1], rider_box[2], rider_box[1] + int(rh * 0.35)]
            for h_box in m2_helmets:
                if compute_iou(head_zone, h_box) > 0.10:
                    return True
            return False
        
        def zone_has_any_helmet(zone_box):
            """Check if ANY helmet exists anywhere in the zone (fallback)."""
            for h_box in m2_helmets:
                if compute_iou(zone_box, h_box) > 0.05:
                    return True
            return False

        # ───────────────────────────────────────────
        # VIOLATION 1: TRIPLE RIDING
        # ───────────────────────────────────────────
        # Use the HIGHER of the two counts, but both must use strict center-containment
        m2_count = len(bike_persons_m2)
        m1_count = len(bike_persons_m1)
        rider_count = max(m2_count, m1_count)
        
        if rider_count >= 3:
            evidence = frame[expanded_box[1]:expanded_box[3], expanded_box[0]:expanded_box[2]]
            cv2.putText(frame, f"TRIPLE RIDING: {rider_count}", (bx1, expanded_box[1]-10), 
                        0, 0.7, (0,0,255), 2)
            _fire_violation("Triple Riding", plate_txt, camera_id, 0.95, evidence, track_id)

        # ───────────────────────────────────────────
        # VIOLATION 2: NO HELMET
        # ───────────────────────────────────────────
        # Strategy: Check ALL rider sources (M2 + M1 fallback)
        helmet_violation_fired = False
        
        # Priority 1: Check M2-detected persons (most precise)
        for rider in bike_persons_m2:
            if not rider_has_helmet(rider):
                evidence = frame[expanded_box[1]:expanded_box[3], expanded_box[0]:expanded_box[2]]
                cv2.putText(frame, "NO HELMET", (rider[0], rider[1]-10), 0, 0.5, (0,0,255), 2)
                _fire_violation("No Helmet", plate_txt, camera_id, 0.85, evidence, track_id)
                helmet_violation_fired = True
                break
        
        # Priority 2: M2 missed the person, but M1 sees someone on the bike
        # If there are M1 persons on this motorcycle and NO helmet detected anywhere
        # in the bike zone, it's very likely a no-helmet violation
        if not helmet_violation_fired and bike_persons_m1 and not bike_persons_m2:
            if not zone_has_any_helmet(expanded_box):
                evidence = frame[expanded_box[1]:expanded_box[3], expanded_box[0]:expanded_box[2]]
                # Use the first M1 person's position for the label
                p = bike_persons_m1[0]
                cv2.putText(frame, "NO HELMET", (p[0], p[1]-10), 0, 0.5, (0,0,255), 2)
                _fire_violation("No Helmet", plate_txt, camera_id, 0.80, evidence, track_id)

        

    # ─── Periodic Cleanup ───
    now = time.time()
    if len(_violation_cooldown) > _MAX_COOLDOWN_ENTRIES:
        expired = [k for k, v in _violation_cooldown.items() if now - v > _COOLDOWN_SECONDS * 3]
        for k in expired:
            del _violation_cooldown[k]
    
    # Background telemetry (throttled to every 1 second for hyper-fast response)
    _throttle_key = f"telem_{camera_id}"
    if _throttle_key not in _violation_cooldown or now - _violation_cooldown[_throttle_key] > 1:
        _violation_cooldown[_throttle_key] = now
        _bg_pool.submit(_sync_telemetry_bg, camera_id, vehicle_count, is_emergency)

# ─────────────────────────────────────────────────────────────
# 5. FIRE-AND-FORGET VIOLATION POSTING
# ─────────────────────────────────────────────────────────────

def _fire_violation(v_type, plate_txt, camera_id, conf, crop, track_id, source=None):
    """Cooldown check (fast, in GPU thread), then dispatch to background."""
    cache_key = f"{camera_id}_{v_type}_{track_id}"
    now = time.time()
    if cache_key in _violation_cooldown and now - _violation_cooldown[cache_key] < _COOLDOWN_SECONDS:
        return
    _violation_cooldown[cache_key] = now

    if crop is None or crop.size == 0: 
        return

    # Save evidence immediately (local I/O only — fast)
    img_name = f"ev_{uuid.uuid4().hex[:8]}.jpg"
    img_path = os.path.join(EVIDENCE_PATH, img_name)
    cv2.imwrite(img_path, crop)

    # Dispatch all DB work to background
    _bg_pool.submit(_post_violation_bg, v_type, plate_txt, camera_id, conf, img_name, img_path)

FINE_AMOUNTS = {
    "No Helmet": 500,
    "Triple Riding": 1000,
    "Wrong Side": 1500,
    "Speeding": 2000,
    "Signal Jump": 1000
}

def _post_violation_bg(v_type, plate_number, cam_id, conf, img_name, img_path):
    """Background thread: Posts violation + challan to Supabase, then runs OCR."""
    try:
        db = _get_bg_supabase()
        clean_plate = re.sub(r'[^A-Z0-9]', '', plate_number.upper())
        
        # Dedup check (same plate+violation within 60s)
        if clean_plate not in ["UNKNOWN", "PENDING", ""]:
            time_threshold = (datetime.utcnow() - timedelta(seconds=60)).isoformat()
            recent = db.table("violations")\
                .select("id")\
                .eq("camera_id", str(cam_id))\
                .eq("violation_type", v_type)\
                .eq("plate_number", clean_plate)\
                .gt("detected_at", time_threshold)\
                .execute()
            if recent.data:
                print(f"⚠️ [DEDUP] Duplicate violation ignored for {clean_plate} ({v_type}) within 60s", flush=True)
                try:
                    if os.path.exists(img_path):
                        os.remove(img_path)
                except Exception:
                    pass
                return
                
        v_id = str(uuid.uuid4())
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
        
        db.table("violations").insert(payload).execute()
        
        # Lookup vehicle owner
        v_res = db.table("vehicles").select("owner_id, owner_name").eq("plate_number", clean_plate).execute()
        owner_id = v_res.data[0].get('owner_id') if v_res.data else None
        owner_name = v_res.data[0].get('owner_name', "Unregistered Vehicle") if v_res.data else "Unregistered Vehicle"

        fine = FINE_AMOUNTS.get(v_type, 500)
        
        challan_payload = {
            "id": str(uuid.uuid4()),
            "violation_id": v_id,
            "vehicle_number": payload["plate_number"],
            "amount": fine,
            "status": "unpaid",
            "owner_name": owner_name,
            "owner_id": owner_id,
            "issued_at": datetime.utcnow().isoformat(),
            "due_date": (datetime.utcnow() + timedelta(days=15)).isoformat()
        }

        db.table("e_challans").insert(challan_payload).execute()
        print(f"✅ [VIOLATION] {v_type} | Plate: {payload['plate_number']} | Owner: {'Linked' if owner_id else 'Unregistered'}", flush=True)

        # Background OCR: update UNKNOWN → actual plate
        if payload["plate_number"] == "UNKNOWN":
            ocr_plate = execute_ocr_on_crop(img_path)
            if ocr_plate != "UNKNOWN":
                # Check for duplicate after OCR
                time_threshold = (datetime.utcnow() - timedelta(seconds=60)).isoformat()
                recent = db.table("violations")\
                    .select("id")\
                    .eq("camera_id", str(cam_id))\
                    .eq("violation_type", v_type)\
                    .eq("plate_number", ocr_plate)\
                    .gt("detected_at", time_threshold)\
                    .execute()
                if recent.data:
                    print(f"⚠️ [DEDUP-OCR] Duplicate violation detected after OCR for {ocr_plate} ({v_type}). Deleting current.", flush=True)
                    db.table("violations").delete().eq("id", v_id).execute()
                    db.table("e_challans").delete().eq("violation_id", v_id).execute()
                    try:
                        if os.path.exists(img_path):
                            os.remove(img_path)
                    except Exception:
                        pass
                    return
                
                # Re-lookup owner
                v_res = db.table("vehicles").select("owner_id, owner_name").eq("plate_number", ocr_plate).execute()
                owner_id = v_res.data[0].get('owner_id') if v_res.data else None
                owner_name = v_res.data[0].get('owner_name', "Unregistered Vehicle") if v_res.data else "Unregistered Vehicle"
                
                db.table("violations").update({"plate_number": ocr_plate}).eq("id", v_id).execute()
                db.table("e_challans").update({
                    "vehicle_number": ocr_plate,
                    "owner_id": owner_id,
                    "owner_name": owner_name
                }).eq("violation_id", v_id).execute()
                print(f"🔤 [OCR UPDATE & LINK] {v_id[:8]} → {ocr_plate} | Owner: {owner_name}", flush=True)

    except Exception as e:
        print(f"❌ [DB SYNC ERROR] {e}", flush=True)

def _sync_telemetry_bg(cam_id, count, emergency):
    """
    Background thread: 
    1. Feeds live YOLO counts into the PPO RL agent.
    2. Updates congested_roads vehicle count + density for the UI.
    """
    try:
        cam_id_str = str(cam_id)

        # Feed into RL Agent (only calls update_lane — registration handled by simulator/API)
        from app.intersection_controller import intersection_controller
        intersection_controller.update_lane(cam_id_str, count, emergency)

        # Update vehicle count and density in congested_roads (signal state is written by RL push)
        db = _get_bg_supabase()
        density = min(100, int((count / 20) * 100))
        db.table("congested_roads").update({
            "vehicle_count":    count,
            "congestion_level": density,
            "is_emergency":     emergency,
            "last_updated":     datetime.utcnow().isoformat()
        }).eq("camera_id", cam_id_str).execute()

    except Exception as e:
        print(f"⚠️ [TELEMETRY ERROR] cam={str(cam_id)[:8]}: {e}", flush=True)

# ─────────────────────────────────────────────────────────────
# 6. RESEARCH-BASED ANALYTICS (MANIT BHOPAL WSI LOGIC)
# ─────────────────────────────────────────────────────────────

def calculate_wsi_score(accident_records):
    """
    Calculates Weighted Severity Index (WSI) for a cluster of accidents.
    WSI = (Na * 6) + (Nb * 4) 
    """
    if not accident_records:
        return 0
        
    na = len(accident_records) # Number of accidents
    nb = sum(acc.get('fatalities', 0) for acc in accident_records) # Number of deaths
    
    wsi = (na * 6) + (nb * 4) # Applied WSI Formula
    return wsi

def get_danger_level(wsi_score):
    """Classifies danger level based on Bhopal research trends."""
    if wsi_score >= 80: return "CRITICAL (Rank 1/2 Zone)" # e.g. Govindpura
    if wsi_score >= 60: return "HIGH RISK (Blackspot)"
    if wsi_score >= 40: return "MODERATE"
    return "STABLE"

# 🔥 UPDATED SYNC TELEMETRY TO INCLUDE DANGER LEVEL
def sync_telemetry(cam_id, count, emergency):
    try:
        db = create_supabase_client() # Ensure DB client is active
        density = min(100, int((count / 20) * 100))
        
        # 1. Fetch historical accidents for this camera location to calculate WSI
        # (Assuming your cameras are linked to specific lat/long regions)
        acc_res = db.table("accidents").select("fatalities").eq("camera_id", cam_id).execute()
        wsi_val = calculate_wsi_score(acc_res.data)
        danger_text = get_danger_level(wsi_val)

        # 2. Update the congested_roads table with the new research metrics
        db.table("congested_roads").update({
            "vehicle_count": count, 
            "congestion_level": density,
            "is_emergency": emergency, 
            "danger_level": danger_text, # New column for your heatmap logic
            "wsi_score": wsi_val,        # New column for severity ranking
            "last_updated": datetime.utcnow().isoformat()
        }).eq("camera_id", str(cam_id)).execute()
        
    except Exception as e:
        print(f"⚠️ [TELEMETRY ERROR] {e}")