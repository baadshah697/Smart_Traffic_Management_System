from fastapi import APIRouter, Depends, HTTPException, status
from app.database import supabase
from app.deps import get_current_user, require_role
from pydantic import BaseModel
import uuid
from datetime import datetime
from collections import defaultdict

router = APIRouter(prefix="/traffic", tags=["Traffic"])

# -------------------------
# Schemas
# -------------------------
class AccidentCreate(BaseModel):
    description: str
    severity: str = "Minor"
    injuries: int = 0
    fatalities: int = 0
    latitude: float  # 👈 Added for Phase 2 Heatmap
    longitude: float # 👈 Added for Phase 2 Heatmap

class SignalAdjust(BaseModel):
    camera_id: str
    car_count: int = 0
    truck_count: int = 0
    bus_count: int = 0      # 👈 Added to match updated utils.py
    motorcycle_count: int = 0 # 👈 Added to match updated utils.py
    ambulance_count: int = 0  # 👈 Populated by Red-Pixel Heuristic
    is_emergency: bool = False

# -------------------------
# 🧠 UNIFIED: AI Density & Signal Controller
# -------------------------
@router.post("/auto-adjust")
def auto_adjust_signal(data: SignalAdjust):
    """
    🧠 Decision Engine: Calculates 'Green Wave' and dynamic timers.
    """
    # Weighted Density: Ambulance has 5x the weight of a car to force green early.
    W_car, W_motorcycle, W_truck, W_bus, W_amb = 1.0, 0.5, 2.0, 2.5, 5.0
    K = 20.0 # Lane saturation constant

    weighted_sum = (
        (data.car_count * W_car) + 
        (data.motorcycle_count * W_motorcycle) +
        (data.truck_count * W_truck) + 
        (data.bus_count * W_bus) +
        (data.ambulance_count * W_amb)
    )
    
    density_pct = min(int((weighted_sum / K) * 100), 100)
    total_entities = (data.car_count + data.truck_count + data.bus_count + 
                      data.motorcycle_count + data.ambulance_count)

    # Logic: Priority 1 is ALWAYS Emergency
    is_emergency = data.is_emergency or data.ambulance_count > 0
    
    if is_emergency:
        new_state, suggested_timer = "green", 90 # Emergency Green Wave
    elif density_pct >= 80:
        new_state, suggested_timer = "green", 60 # Heavy Traffic Logic
    elif density_pct <= 15:
        new_state, suggested_timer = "red", 5    # Energy Saving / Low Demand
    else:
        new_state, suggested_timer = "green", 30 # Standard Flow

    try:
        # Syncing the AI decision to the 'congested_roads' telemetry table
        response = supabase.table("congested_roads").update({
            "current_state": new_state,
            "vehicle_count": total_entities,     # Updates Surveillance Tab counter
            "congestion_level": density_pct,      # Updates Traffic Tab bar
            "recommended_time": suggested_timer,
            "is_emergency": is_emergency,        # Triggers UI Alert & Sound
            "last_updated": datetime.utcnow().isoformat()
        }).eq("camera_id", data.camera_id).execute()

        return {
            "status": "SUCCESS",
            "density_pct": density_pct,
            "vehicle_count": total_entities,
            "signal_override": is_emergency
        }
    except Exception as e:
        print(f"❌ Master Sync Failed: {e}")
        raise HTTPException(status_code=500, detail="Database Sync Failed")

# -------------------------
# View Master Grid
# -------------------------
@router.get("/congestion")
def get_congestion(): 
    response = supabase.table("congested_roads").select("*").execute()
    return response.data

# -------------------------
# Accident Logic
# -------------------------
@router.post("/accident")
def report_accident(data: AccidentCreate, user=Depends(require_role("officer"))):
    """
    Manual Entry: Saves an officer-reported accident to the 'accidents' table.
    """
    try:
        accident_data = {
            "id": str(uuid.uuid4()),
            "description": data.description,
            "severity": data.severity,
            "injuries": data.injuries,     # Strict Schema Mapping
            "fatalities": data.fatalities, # Strict Schema Mapping
            "latitude": data.latitude,   # 👈 Now maps to the Heatmap points
            "longitude": data.longitude, # 👈 Now maps to the Heatmap points
            "reported_by": user["sub"],    # Officer UUID
            "reported_at": datetime.utcnow().isoformat(),
        }
        
        response = supabase.table("accidents").insert(accident_data).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/analytics")
def get_accident_analytics(user=Depends(get_current_user)):
    """
    Fetches monthly stats for the Officer Dashboard BarChart.
    """
    response = supabase.table("accidents").select("reported_at, injuries, fatalities").execute()
    monthly_data = defaultdict(lambda: {"injuries": 0, "fatalities": 0})
    
    if not response.data: return []
    
    for record in response.data:
        try:
            dt = datetime.fromisoformat(record['reported_at'].replace('Z', '+00:00'))
            month_name = dt.strftime('%b')
            monthly_data[month_name]["injuries"] += (record.get("injuries") or 0)
            monthly_data[month_name]["fatalities"] += (record.get("fatalities") or 0)
        except: continue
        
    return [{"name": month, **values} for month, values in monthly_data.items()]


@router.get("/live-accidents")
def get_live_accidents():
    """
    GIS Map Endpoint: Fetches exact accident coordinates for the Heatmap.
    """
    try:
        # Selects all columns (including lat/long) for the map
        response = supabase.table("accidents").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))