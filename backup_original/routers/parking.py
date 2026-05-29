from fastapi import APIRouter, Depends, HTTPException, status
from app.database import supabase
from app.deps import get_current_user, require_role
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/parking", tags=["Parking"])

# -------------------------
# Schema
# -------------------------
class ParkingCreate(BaseModel):
    name: str
    location: str
    total_slots: int
    occupied: int = 0  # 🔥 Changed to match your DB column name

# -------------------------
# View parking (all users)
# -------------------------
@router.get("/")
def get_parking(user=Depends(get_current_user)):
    # Fetches: id, name, location, total_slots, occupied
    response = supabase.table("parking_lots").select("*").execute()
    return response.data

# -------------------------
# Create parking (Officer access)
# -------------------------
@router.post("/")
def create_parking(
    data: ParkingCreate,
    user=Depends(require_role("officer"))
):
    parking_data = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "location": data.location,
        "total_slots": data.total_slots,
        "occupied": data.occupied  # 🔥 Matches 'occupied' in Supabase
    }

    response = supabase.table("parking_lots").insert(parking_data).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Parking creation failed in Supabase"
        )

    return response.data[0]

# -------------------------
# Delete parking (Officer access)
# -------------------------
@router.delete("/{parking_id}")
def delete_parking(
    parking_id: str,
    user=Depends(require_role("officer"))
):
    response = (
        supabase.table("parking_lots")
        .delete()
        .eq("id", parking_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Parking node not found")

    return {"message": "Infrastructure decommissioned"}

# -------------------------
# Update parking
# -------------------------
@router.put("/{parking_id}")
def update_parking(
    parking_id: str,
    data: ParkingCreate,
    user=Depends(require_role("officer"))
):
    response = (
        supabase.table("parking_lots")
        .update({
            "name": data.name,
            "location": data.location,
            "total_slots": data.total_slots,
            "occupied": data.occupied
        })
        .eq("id", parking_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Parking not found")

    return response.data[0]