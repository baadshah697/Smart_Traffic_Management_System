from fastapi import APIRouter, Depends, HTTPException, status
from app.database import supabase
from app.deps import get_current_user, require_role
from app.intersection_controller import intersection_controller, VALID_DIRECTIONS
from pydantic import BaseModel
import uuid
from datetime import datetime
from collections import defaultdict

router = APIRouter(prefix="/traffic", tags=["Traffic"])

# ─────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────
class AccidentCreate(BaseModel):
    description: str
    severity: str = "Minor"
    injuries: int = 0
    fatalities: int = 0
    latitude: float
    longitude: float

class SignalAdjust(BaseModel):
    camera_id: str
    car_count: int = 0
    truck_count: int = 0
    bus_count: int = 0
    motorcycle_count: int = 0
    ambulance_count: int = 0
    is_emergency: bool = False


# ─────────────────────────────────────────────────────────────
# Auto-Adjust: Receives YOLO data → feeds the RL Agent
# ─────────────────────────────────────────────────────────────
@router.post("/auto-adjust")
def auto_adjust_signal(data: SignalAdjust):
    """
    Entry point for camera YOLO outputs.
    Auto-registers the camera, feeds the PPO Agent, and updates
    the congested_roads table for UI vehicle count display.
    """
    # Weighted vehicle sum for density calculation
    weighted_sum = (
        data.car_count +
        (data.motorcycle_count * 0.5) +
        (data.truck_count * 2.0) +
        (data.bus_count * 2.5) +
        (data.ambulance_count * 5.0)
    )
    K = 20.0
    density_pct = min(int((weighted_sum / K) * 100), 100)
    total_vehicles = (data.car_count + data.truck_count + data.bus_count +
                      data.motorcycle_count + data.ambulance_count)
    is_emergency = data.is_emergency or data.ambulance_count > 0

    # 1. Auto-register camera if not already in RL controller
    status = intersection_controller.get_status()
    is_registered = any(
        state.get("camera_id") == data.camera_id
        for state in status.values()
    )

    if not is_registered:
        used_dirs = {state.get("direction") for state in status.values() if state.get("camera_id")}
        for d in VALID_DIRECTIONS:
            if d not in used_dirs:
                intersection_controller.register_lane(data.camera_id, d)
                break

    # 2. Feed values to the PPO agent
    intersection_controller.update_lane(data.camera_id, total_vehicles, is_emergency)

    # 3. Update vehicle count + density in congested_roads (signal state written by RL push)
    try:
        supabase.table("congested_roads").update({
            "vehicle_count":   total_vehicles,
            "congestion_level": density_pct,
            "is_emergency":    is_emergency,
            "last_updated":    datetime.utcnow().isoformat()
        }).eq("camera_id", data.camera_id).execute()
    except Exception:
        pass

    return {
        "status": "SUCCESS",
        "vehicle_count": total_vehicles,
        "density_pct": density_pct,
        "signal_override": is_emergency
    }


# ─────────────────────────────────────────────────────────────
# Congestion View: Merges RL signal state into congested_roads
# This is what Surveillance.tsx polls every second.
# ─────────────────────────────────────────────────────────────
@router.get("/congestion")
def get_congestion():
    """
    Returns the live signal state for every camera node.
    Merges real-time RL decisions (current_state, recommended_time)
    on top of the raw congested_roads rows.
    """
    # Get latest RL decision snapshot
    rl_status = intersection_controller.get_status()

    # Build a quick lookup: camera_id -> rl state
    cam_to_rl = {}
    for direction, state in rl_status.items():
        cam_id = state.get("camera_id")
        if cam_id:
            cam_to_rl[cam_id] = state

    # Fetch all road rows
    try:
        rows = supabase.table("congested_roads").select("*").execute().data or []
    except Exception:
        rows = []

    merged = []
    for row in rows:
        cam_id = row.get("camera_id")
        rl = cam_to_rl.get(cam_id)
        if rl:
            # Overwrite with live RL values
            row["current_state"]    = rl["signal"]
            row["recommended_time"] = rl["green_duration"]
            row["is_emergency"]     = rl["is_emergency"]
        else:
            # No RL data yet — default to red
            row.setdefault("current_state", "red")
            row.setdefault("recommended_time", 0)
        merged.append(row)

    return merged


# ─────────────────────────────────────────────────────────────
# Accident Reporting
# ─────────────────────────────────────────────────────────────
@router.post("/accident")
def report_accident(data: AccidentCreate, user=Depends(require_role("officer"))):
    """Officer manually reports a road accident."""
    try:
        accident_data = {
            "id":          str(uuid.uuid4()),
            "description": data.description,
            "severity":    data.severity,
            "injuries":    data.injuries,
            "fatalities":  data.fatalities,
            "latitude":    data.latitude,
            "longitude":   data.longitude,
            "reported_by": user["sub"],
            "reported_at": datetime.utcnow().isoformat(),
        }
        response = supabase.table("accidents").insert(accident_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/analytics")
def get_accident_analytics(user=Depends(get_current_user)):
    """Monthly accident stats for the Officer Dashboard BarChart."""
    response = supabase.table("accidents").select("reported_at, injuries, fatalities").execute()
    monthly_data = defaultdict(lambda: {"injuries": 0, "fatalities": 0})

    for record in (response.data or []):
        try:
            dt = datetime.fromisoformat(record["reported_at"].replace("Z", "+00:00"))
            month = dt.strftime("%b")
            monthly_data[month]["injuries"]  += record.get("injuries", 0) or 0
            monthly_data[month]["fatalities"] += record.get("fatalities", 0) or 0
        except Exception:
            continue

    return [{"name": month, **vals} for month, vals in monthly_data.items()]


@router.get("/live-accidents")
def get_live_accidents():
    """GIS heatmap: returns all accident lat/lng coordinates."""
    try:
        return supabase.table("accidents").select("*").execute().data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))