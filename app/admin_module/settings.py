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

    # 🔥 UPDATE ALL UNPAID CHALLANS DYNAMICALLY
    unpaid = supabase.table("e_challans").select("id, violations!inner(violation_type)").eq("status", "unpaid").execute()
    if unpaid.data:
        for ch in unpaid.data:
            v_obj = ch.get("violations")
            if v_obj and isinstance(v_obj, dict):
                v_type = str(v_obj.get("violation_type", "")).lower().replace("_", " ")
                new_amt = None
                
                # Match new fine amounts via fuzzy matching (e.g. "no helmet" matches "helmet")
                for k, val in new_fines.items():
                    k_clean = k.lower().replace("_", " ")
                    if k_clean in v_type or v_type in k_clean:
                        new_amt = val
                        break
                
                if new_amt is not None:
                    supabase.table("e_challans").update({"amount": new_amt}).eq("id", ch["id"]).execute()

    return {"status": "Success", "message": "Global Fine Scaling Updated and Unpaid Challans Adjusted"}