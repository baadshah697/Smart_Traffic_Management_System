from fastapi import APIRouter, Depends, HTTPException, status
from app.database import supabase
from datetime import datetime
from app.deps import require_role, get_current_user

router = APIRouter(prefix="/challans", tags=["Challans"])

# ---------------------------
# Officer: Create New Challan (ENFORCED PRICING & LOCATION SYNC)
# ---------------------------
@router.post("/issue")
def issue_new_challan(
    challan_data: dict, 
    user=Depends(require_role("officer"))
):
    # 1. Fetch the Officer's Badge Number (Linked to your user account)
    role_info = (
        supabase.table("user_roles")
        .select("badge_number")
        .eq("user_id", user["sub"])
        .single()
        .execute()
    )

    if not role_info.data or not role_info.data.get("badge_number"):
        raise HTTPException(
            status_code=400, 
            detail="Officer badge not found in system. Contact Admin."
        )

    badge = role_info.data["badge_number"]

    # --- 🔥 DYNAMIC PRICE ENFORCEMENT ---
    # We standardize the key to lowercase to match the 'system_configs' table
    violation_key = challan_data.get("violation_type", "no helmet").lower() 
    
    config_res = (
        supabase.table("system_configs")
        .select("value")
        .eq("key", "fine_multipliers")
        .single()
        .execute()
    )
    
    # Extract the live rate from the Architect's settings or default to 500
    live_rates = config_res.data['value'] if config_res.data else {}
    enforced_amount = live_rates.get(violation_key, 500) 
    # -----------------------------------------

    # 2. Prepare the data including the CRITICAL 'location' field
    # This location triggers the 'Oracle Aligned' star in the Personnel Audit
    new_challan = {
        "violation_id": challan_data.get("violation_id"),
        "vehicle_number": challan_data.get("vehicle_number"),
        "amount": enforced_amount, 
        "owner_name": challan_data.get("owner_name", "Unknown"),
        "owner_id": challan_data.get("owner_id"),
        "status": "unpaid",
        "issued_by": badge, 
        "location": challan_data.get("location", "Unknown"), # 👈 REQUIRED for Warden Reward Test
        "issued_at": datetime.utcnow().isoformat()
    }

    # 3. Insert into Supabase e_challans table
    response = supabase.table("e_challans").insert(new_challan).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to issue challan. Check database connection.")

    return {
        "status": "Success", 
        "message": "Challan Issued", 
        "amount_charged": enforced_amount, 
        "location_logged": new_challan["location"],
        "data": response.data[0]
    }


# ---------------------------
# Citizen: Get own challans (Unchanged)
# ---------------------------
@router.get("/my")
def get_my_challans(user=Depends(require_role("citizen"))):
    response = (
        supabase.table("e_challans")
        .select("*")
        .eq("owner_id", user["sub"])
        .execute()
    )
    return response.data


# ---------------------------
# Officer/Admin: Get by plate (Unchanged)
# ---------------------------
@router.get("/by-plate/{plate_number}")
def get_challans_by_plate(
    plate_number: str,
    user=Depends(get_current_user)
):
    if user["role"] not in ["officer", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden"
        )

    response = (
        supabase.table("e_challans")
        .select("*")
        .eq("vehicle_number", plate_number)
        .execute()
    )
    return response.data


# ---------------------------
# Citizen: Pay own challan (Unchanged)
# ---------------------------
@router.put("/pay/{challan_id}")
def pay_challan(
    challan_id: str,
    user=Depends(require_role("citizen"))
):
    challan = (
        supabase.table("e_challans")
        .select("*")
        .eq("id", challan_id)
        .execute()
    )

    if not challan.data:
        raise HTTPException(status_code=404, detail="Challan not found")

    challan_data = challan.data[0]

    if challan_data["owner_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Not your challan")

    if challan_data["status"] == "paid":
        raise HTTPException(status_code=400, detail="Already paid")

    updated = (
        supabase.table("e_challans")
        .update({
            "status": "paid",
            "paid_at": datetime.utcnow().isoformat()
        })
        .eq("id", challan_id)
        .execute()
    )

    return {"message": "Success", "challan": updated.data[0]}