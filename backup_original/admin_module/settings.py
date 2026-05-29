# app/admin_module/settings.py
from fastapi import APIRouter, Depends, HTTPException
from app.database import supabase
from app.auth import get_current_user

router = APIRouter(prefix="/admin/module/settings", tags=["Admin: Architect Settings"])

@router.get("/config")
def get_system_config(current_user=Depends(get_current_user)):
    # Fetch real data from Supabase
    res = supabase.table("system_configs").select("value").eq("key", "fine_multipliers").single().execute()
    
    return {
        "fine_multipliers": res.data['value'] if res.data else {},
        "system_status": "Active",
        "last_backup": "2026-04-05 22:00:00"
    }

@router.post("/update-fines")
def update_fines(payload: dict, current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized")

    new_fines = payload.get("new_fines")
    
    # Save to Supabase (Upsert ensures it updates the existing row)
    res = supabase.table("system_configs").upsert({
        "key": "fine_multipliers",
        "value": new_fines
    }).execute()

    if not res.data:
        raise HTTPException(status_code=500, detail="Database Sync Failed")

    return {"status": "Success", "message": "Global Fine Scaling Updated"}