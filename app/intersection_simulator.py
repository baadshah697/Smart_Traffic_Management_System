"""
═══════════════════════════════════════════════════════════════
  🧪 INTERSECTION SIMULATOR
  Creates 3 simulated camera nodes (South, East, West) in the DB
  and feeds them randomised vehicle counts every 5 seconds so the
  PPO RL agent can demonstrate demand-ratio phase selection.

  The real Laptop Camera acts as the North directional lane.
═══════════════════════════════════════════════════════════════
"""

import threading
import time
import random
from datetime import datetime
from app.database import create_supabase_client
from app.intersection_controller import intersection_controller

# ── Real laptop camera ID (direction N) ─────────────────────
REAL_CAMERA_ID = "6e6d7204-290d-4540-bbdd-c89b95067b99"

# ── Simulated cameras — proper UUID format ───────────────────
SIM_CAMERAS = {
    "S": "00000000-0001-0001-0001-000000000001",
    "E": "00000000-0002-0002-0002-000000000002",
    "W": "00000000-0003-0003-0003-000000000003",
}

# Location metadata for each simulated lane
SIM_METADATA = {
    "S": {"name": "Simulated S Camera", "road": "Hamidia Road (S)",    "lat": 23.2323, "lon": 77.4333},
    "E": {"name": "Simulated E Camera", "road": "Raisen Road (E)",     "lat": 23.2333, "lon": 77.4343},
    "W": {"name": "Simulated W Camera", "road": "Link Road No.1 (W)",  "lat": 23.2333, "lon": 77.4323},
}


def _ensure_db_rows(db):
    """
    Idempotent: Creates the camera row + congested_roads row for each
    simulated node if they don't already exist. Safe to call on every restart.
    """
    # ── Ensure real camera has direction N ───────────────────
    try:
        db.table("surveillance_cameras").update(
            {"direction": "N"}
        ).eq("id", REAL_CAMERA_ID).execute()
        print("[SIMULATOR] Laptop Camera confirmed as North (N)", flush=True)
    except Exception as e:
        print(f"[SIMULATOR] Warning — could not set N direction: {e}", flush=True)

    # ── Ensure the real camera has a congested_roads row ─────
    try:
        existing = db.table("congested_roads").select("camera_id").eq("camera_id", REAL_CAMERA_ID).execute()
        if not existing.data:
            db.table("congested_roads").insert({
                "camera_id":       REAL_CAMERA_ID,
                "road_name":       "Board Office Square (N)",
                "area":            "Intersection N",
                "congestion_level": 0,
                "vehicle_count":   0,
                "current_state":   "red",
                "is_emergency":    False,
                "is_closed":       False,
            }).execute()
            print("[SIMULATOR] Created congested_roads row for Laptop Camera", flush=True)
    except Exception as e:
        print(f"[SIMULATOR] Warning — real camera road row: {e}", flush=True)

    # ── Create/verify each simulated camera ──────────────────
    for direction, cam_id in SIM_CAMERAS.items():
        meta = SIM_METADATA[direction]
        try:
            # Camera row
            existing = db.table("surveillance_cameras").select("id").eq("id", cam_id).execute()
            if not existing.data:
                db.table("surveillance_cameras").insert({
                    "id":            cam_id,
                    "location_name": meta["name"],
                    "ip_address":    "simulated",
                    "is_active":     True,
                    "latitude":      meta["lat"],
                    "longitude":     meta["lon"],
                    "direction":     direction,
                }).execute()
                print(f"[SIMULATOR] Created camera: {meta['name']}", flush=True)
            else:
                # Make sure direction is set on re-run
                db.table("surveillance_cameras").update(
                    {"direction": direction, "is_active": True}
                ).eq("id", cam_id).execute()
                print(f"[SIMULATOR] Camera {direction} already exists — updated direction", flush=True)
        except Exception as e:
            print(f"[SIMULATOR] Camera row error ({direction}): {e}", flush=True)

        try:
            # congested_roads row
            existing_rd = db.table("congested_roads").select("camera_id").eq("camera_id", cam_id).execute()
            if not existing_rd.data:
                db.table("congested_roads").insert({
                    "camera_id":       cam_id,
                    "road_name":       meta["road"],
                    "area":            f"Intersection {direction}",
                    "congestion_level": 0,
                    "vehicle_count":   0,
                    "current_state":   "red",
                    "is_emergency":    False,
                    "is_closed":       False,
                }).execute()
                print(f"[SIMULATOR] Created congested_roads row for {direction}", flush=True)
        except Exception as e:
            print(f"[SIMULATOR] Road row error ({direction}): {e}", flush=True)


def _simulate_traffic(db):
    """
    Feeds simulated vehicle counts into the RL agent every 1.5 seconds.
    Maintains a STATEFUL queue for each lane to demonstrate real-time green light draining.
    """
    # Start with some base traffic
    queues = {"S": 10, "E": 4, "W": 20}
    
    # Arrival rates (vehicles per cycle while red)
    arrival_rates = {"S": 1.0, "E": 0.5, "W": 2.0}
    # Drain rates (vehicles per cycle while green)
    drain_rate = 5.0 

    cycle = 0
    while True:
        cycle += 1
        now_iso = datetime.utcnow().isoformat()

        # Get current green light status to know which queue to drain
        status = intersection_controller.get_status()
        active_green = [d for d, s in status.items() if s["signal"] == "green"]

        # Periodic emergency simulation
        emergency_dir = None
        if cycle % 60 == 0:  # ~90 seconds
            emergency_dir = random.choice(["S", "E", "W"])
            print(f"[SIMULATOR TEST] 🚨 EMERGENCY ambulance spotted on lane {emergency_dir}! Testing hard-override...", flush=True)
            
        # Extremely high congestion spike simulation
        if cycle % 100 == 50: # ~75 seconds
            spike_dir = random.choice(["S", "E", "W"])
            queues[spike_dir] += 30
            print(f"[SIMULATOR TEST] 🚗💨 High congestion spike generated on lane {spike_dir}! Queue jumped by 30.", flush=True)

        # Update each lane's queue
        for direction, cam_id in SIM_CAMERAS.items():
            # If green, drain. If red, accumulate.
            if direction in active_green:
                queues[direction] = max(0, queues[direction] - drain_rate)
            else:
                # Add some randomness to arrivals
                queues[direction] = min(50, queues[direction] + arrival_rates[direction] * random.uniform(0.5, 1.5))
            
            count = int(queues[direction])
            is_emg = (direction == emergency_dir)
            density = min(100, int((count / 20) * 100))

            # Feed to PPO
            intersection_controller.update_lane(cam_id, count, is_emg)

            # Push to DB
            try:
                db.table("congested_roads").update({
                    "vehicle_count":    count,
                    "congestion_level": density,
                    "is_emergency":     is_emg,
                    "last_updated":     now_iso,
                }).eq("camera_id", cam_id).execute()
            except Exception:
                pass

        # Print status
        if cycle % 2 == 0:  # print every ~3 seconds
            green_lanes = [d for d, s in status.items() if s["signal"] == "green"]
            n_val = status.get("N", {}).get("vehicle_count", 0)
            s_val = status.get("S", {}).get("vehicle_count", 0)
            e_val = status.get("E", {}).get("vehicle_count", 0)
            w_val = status.get("W", {}).get("vehicle_count", 0)
            print(
                f"[RL ENGINE] N:{n_val:02d} S:{s_val:02d} E:{e_val:02d} W:{w_val:02d} | "
                f"GREEN → {green_lanes} (Locked: {status.get(green_lanes[0],{}).get('green_duration', 0)}s)",
                flush=True
            )

        time.sleep(1.5)


def _setup_and_simulate():
    """Full lifecycle: wait → setup DB → register lanes → start feed loop."""
    print("[SIMULATOR] Will initialize in 12 seconds...", flush=True)
    time.sleep(12)   # Let Uvicorn + RL controller fully initialize first

    print("\n" + "=" * 60, flush=True)
    print("[SIMULATOR] Setting up 4-Way Intersection Test...", flush=True)

    db = create_supabase_client()

    # 1. Ensure DB rows exist
    _ensure_db_rows(db)

    # 2. Register all 4 lanes with the RL controller
    intersection_controller.register_lane(REAL_CAMERA_ID, "N")
    for direction, cam_id in SIM_CAMERAS.items():
        intersection_controller.register_lane(cam_id, direction)

    print("[SIMULATOR] All 4 lanes registered. Feeding live data...", flush=True)
    print("=" * 60 + "\n", flush=True)

    # 3. Start feed loop
    _simulate_traffic(db)


# ─── Auto-start on import ─────────────────────────────────────
_sim_thread = threading.Thread(
    target=_setup_and_simulate,
    daemon=True,
    name="Intersection-Simulator"
)
_sim_thread.start()
print("[SIMULATOR] Background thread started.", flush=True)
