from fastapi import APIRouter, Depends, HTTPException, Header
from app.database import supabase
from app.deps import get_current_user
import uuid
import re 
from datetime import datetime, timedelta
from pydantic import BaseModel

router = APIRouter(prefix="/violations", tags=["Violations"])

# 🏛️ INDIAN PLATE STANDARDS (LL NN LL NNNN)
INDIAN_PLATE_PATTERN = r"^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$"

# 💰 DYNAMIC FINE CONFIGURATION (Bhopal PTU Standards)
FINE_AMOUNTS = {
    "No Helmet": 500,
    "Triple Riding": 1000,
    "Wrong Side": 1500,
    "Speeding": 2000,
    "Signal Jump": 1000
}

class ViolationCreate(BaseModel):
    violation_type: str
    evidence_image_url: str
    confidence_score: float
    plate_number: str
    camera_id: str = None 

# -------------------------
# Create Violation (Officer or Camera)
# -------------------------
@router.post("/")
def create_violation(
    data: ViolationCreate,
    user=Depends(get_current_user),
    camera_api_key: str = Header(default=None)
):
    # 1. Standardize and Clean Plate Number (Remove dashes/spaces)
    clean_plate = re.sub(r'[^A-Z0-9]', '', data.plate_number.upper())

    # 🔥 2. FLEXIBLE REGEX: Allow UNKNOWN/PENDING logs for partial AI detections
    # This prevents the AI Engine from being blocked when OCR is blurry
    if clean_plate not in ["UNKNOWN", "PENDING", "PENDINGRECOGNITION"]:
        if not re.match(INDIAN_PLATE_PATTERN, clean_plate):
             raise HTTPException(
                 status_code=400, 
                 detail=f"Invalid Indian Plate Format: {clean_plate}. Expected LL NN LL NNNN."
             )

    # 3. Source Validation
    if camera_api_key:
        camera = (
            supabase.table("surveillance_cameras")
            .select("*")
            .eq("api_key", camera_api_key)
            .execute()
        )
        if not camera.data:
            raise HTTPException(status_code=403, detail="Invalid camera API key")
        camera_id = camera.data[0]["id"]
    else:
        # Check permissions for manual officer entry
        if user["role"] != "officer":
            raise HTTPException(status_code=403, detail="Only officers can create violations manually")
        camera_id = data.camera_id

    # 4. Insert Violation Record
    violation_data = {
        "id": str(uuid.uuid4()),
        "camera_id": camera_id,
        "violation_type": data.violation_type,
        "evidence_image_url": data.evidence_image_url,
        "confidence_score": data.confidence_score,
        "plate_number": clean_plate,
        "status": "pending",
        "detected_at": datetime.utcnow().isoformat(),
    }

    violation_res = supabase.table("violations").insert(violation_data).execute()
    if not violation_res.data:
        raise HTTPException(status_code=500, detail="Violation could not be created")

    violation = violation_res.data[0]

    # 5. Lookup vehicle owner in 'vehicles' table
    # This only works if the plate is correctly identified
    vehicle = (
        supabase.table("vehicles")
        .select("owner_id, owner_name")
        .eq("plate_number", clean_plate)
        .execute()
    )

    owner_id = vehicle.data[0]["owner_id"] if vehicle.data else None
    owner_name = vehicle.data[0]["owner_name"] if vehicle.data else "Unknown Owner"

    # 6. Create challan with Dynamic Fine Amount
    fine_amount = FINE_AMOUNTS.get(data.violation_type, 500) 
    
    challan_data = {
        "id": str(uuid.uuid4()),
        "violation_id": violation["id"],
        "vehicle_number": clean_plate,
        "amount": fine_amount,
        "status": "unpaid",
        "owner_name": owner_name,
        "owner_id": owner_id,
        "issued_at": datetime.utcnow().isoformat(),
        "due_date": (datetime.utcnow() + timedelta(days=15)).isoformat(),
    }

    challan_res = supabase.table("e_challans").insert(challan_data).execute()

    # 7. Audit log (Personnel Audit System)
    supabase.table("audit_logs").insert({
        "id": str(uuid.uuid4()),
        "changed_by": user["sub"] if not camera_api_key else None,
        "action_type": "create_violation",
        "table_name": "violations",
        "record_id": violation["id"],
        "payload": violation,
        "created_at": datetime.utcnow().isoformat()
    }).execute()

    return {
        "status": "Success",
        "message": "Enforcement archived",
        "violation": violation,
        "challan": challan_res.data[0] if challan_res.data else None
    }

# -------------------------
# List violations (all or by plate)
# -------------------------
@router.get("/")
def list_violations(plate_number: str = None, user=Depends(get_current_user)):
    """Fetches violations, newest first, with optional plate filter"""
    query = supabase.table("violations").select("*").order("detected_at", desc=True)

    if plate_number:
        # Flexible case-insensitive searching for the Dashboard
        query = query.ilike("plate_number", f"%{plate_number}%")

    response = query.execute()
    return response.data