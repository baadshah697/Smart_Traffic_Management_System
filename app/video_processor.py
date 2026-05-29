"""
═══════════════════════════════════════════════════════════════
  🎬 VIDEO PROCESSOR — Offline Violation Engine
  Processes uploaded .mp4 files for violation detection ONLY.
  
  Strategy:
  - Skips congestion counting & ambulance detection entirely
  - Focuses 100% GPU on Violation Detection (Triple Riding, No Helmet)
  - Uses Instant Snap ROI logic from the live pipeline
  - Tags all violations with source="uploaded_video"
  - Runs in a separate thread to not block live inference
═══════════════════════════════════════════════════════════════
"""

import cv2
import os
import threading
import time
from datetime import datetime

# Re-use the existing AI models and helpers from utils
from app.utils import (
    custom_model, ai_lock, 
    CUSTOM_CLS_HELMET, CUSTOM_CLS_PLATE, CUSTOM_CLS_MOTO, CUSTOM_CLS_PERSON,
    box_center, box_contains, compute_iou,
    try_ocr_on_plates, _fire_violation
)

# Track active video jobs
_active_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()


def get_job_status(job_id: str) -> dict | None:
    """Returns the current status of a video processing job."""
    with _jobs_lock:
        return _active_jobs.get(job_id)


def process_uploaded_video(video_path: str, job_id: str):
    """
    Main entry point for offline video processing.
    Runs the custom model (best.pt) ONLY — no det_model, no congestion, no ambulance.
    All violations tagged with source="uploaded_video".
    """
    print(f"\n🎬 [VIDEO] Job {job_id[:8]} STARTED — {video_path}", flush=True)
    
    with _jobs_lock:
        _active_jobs[job_id] = {
            "status": "processing",
            "progress": 0,
            "violations_found": 0,
            "started_at": datetime.utcnow().isoformat()
        }
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"❌ [VIDEO] Cannot open: {video_path}", flush=True)
        with _jobs_lock:
            _active_jobs[job_id]["status"] = "failed"
            _active_jobs[job_id]["error"] = "Cannot open video file"
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_skip = max(1, int(fps / 6))  # Process ~6 frames per second of video
    
    print(f"📊 [VIDEO] Total frames: {total_frames} | FPS: {fps:.0f} | Processing every {frame_skip}th frame", flush=True)

    frame_idx = 0
    violations_found = 0
    fake_camera_id = f"upload_{job_id[:8]}"

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            
            # Skip frames for efficiency
            if frame_idx % frame_skip != 0:
                continue

            # ═══════════════════════════════════════════════
            # RUN ONLY CUSTOM MODEL (best.pt) — VIOLATION DETECTION
            # No det_model, no congestion, no ambulance
            # ═══════════════════════════════════════════════
            with ai_lock:
                m2_res = custom_model(frame, verbose=False, conf=0.20, imgsz=640)

            m2_persons = []
            m2_helmets = []
            m2_plates = []
            m2_motos = []

            for b in m2_res[0].boxes:
                cls2 = int(b.cls[0])
                box = list(map(int, b.xyxy[0]))
                
                if cls2 == CUSTOM_CLS_PERSON:
                    m2_persons.append(box)
                elif cls2 == CUSTOM_CLS_HELMET:
                    m2_helmets.append(box)
                elif cls2 == CUSTOM_CLS_PLATE:
                    m2_plates.append(box)
                elif cls2 == CUSTOM_CLS_MOTO:
                    m2_motos.append(box)

            # ═══════════════════════════════════════════════
            # VIOLATION REASONING (same Instant Snap ROI logic)
            # ═══════════════════════════════════════════════
            for moto_box in m2_motos:
                bx1, by1, bx2, by2 = moto_box
                bike_h = by2 - by1
                expanded_box = [bx1, max(0, by1 - int(bike_h * 0.6)), bx2, by2]
                
                # Find persons on this bike
                bike_persons = []
                for p_box in m2_persons:
                    pcx, pcy = box_center(p_box)
                    if box_contains(expanded_box, (pcx, pcy)):
                        bike_persons.append(p_box)
                
                # Find plates for this bike
                bike_plates = []
                for pl_box in m2_plates:
                    pcx, pcy = box_center(pl_box)
                    plate_zone = [bx1-30, by1 + int(bike_h*0.3), bx2+30, by2+30]
                    if box_contains(plate_zone, (pcx, pcy)):
                        bike_plates.append(pl_box)
                
                plate_txt = try_ocr_on_plates(bike_plates, frame) if bike_plates else "UNKNOWN"
                
                # Pseudo track-id from frame position
                pseudo_tid = hash(f"vid_{frame_idx}_{bx1}_{by1}") % 100000

                # ─── VIOLATION 1: TRIPLE RIDING ───
                if len(bike_persons) >= 3:
                    evidence = frame[expanded_box[1]:expanded_box[3], expanded_box[0]:expanded_box[2]]
                    _fire_violation("Triple Riding", plate_txt, fake_camera_id, 0.95, evidence, pseudo_tid, source="uploaded_video")
                    violations_found += 1

                # ─── VIOLATION 2: NO HELMET ───
                for rider in bike_persons:
                    rh = rider[3] - rider[1]
                    head_zone = [rider[0], rider[1], rider[2], rider[1] + int(rh * 0.35)]
                    has_helmet = any(compute_iou(head_zone, h) > 0.10 for h in m2_helmets)
                    
                    if not has_helmet:
                        evidence = frame[expanded_box[1]:expanded_box[3], expanded_box[0]:expanded_box[2]]
                        _fire_violation("No Helmet", plate_txt, fake_camera_id, 0.85, evidence, pseudo_tid, source="uploaded_video")
                        violations_found += 1
                        break  # One no-helmet per bike per frame

            # Update progress
            progress = int((frame_idx / max(total_frames, 1)) * 100)
            with _jobs_lock:
                _active_jobs[job_id]["progress"] = min(progress, 100)
                _active_jobs[job_id]["violations_found"] = violations_found

    except Exception as e:
        print(f"❌ [VIDEO] Processing error: {e}", flush=True)
        with _jobs_lock:
            _active_jobs[job_id]["status"] = "failed"
            _active_jobs[job_id]["error"] = str(e)
        return
    finally:
        cap.release()

    # Cleanup temp file
    try:
        os.remove(video_path)
        print(f"🗑️ [VIDEO] Temp file cleaned: {video_path}", flush=True)
    except:
        pass

    with _jobs_lock:
        _active_jobs[job_id]["status"] = "completed"
        _active_jobs[job_id]["progress"] = 100
        _active_jobs[job_id]["completed_at"] = datetime.utcnow().isoformat()

    print(f"✅ [VIDEO] Job {job_id[:8]} COMPLETE — {violations_found} violations found", flush=True)
