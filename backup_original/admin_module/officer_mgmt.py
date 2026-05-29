from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from app.database import supabase
from app.auth import pwd_context, get_current_user

router = APIRouter(prefix="/admin/module", tags=["Admin: Management"])

class OfficerCreate(BaseModel):
    badge: str # The unique Badge ID (e.g., BPL102)

@router.post("/recruit-officer")
def recruit_officer(data: OfficerCreate, current_user=Depends(get_current_user)):
    # 1. Verify Admin Clearance
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin Clearance Required")

    # 2. Standardized Credential Generation
    # Email: off_bpl102@bhopaltraffic.in
    clean_badge = data.badge.strip().upper()
    generated_email = f"off_{clean_badge.lower()}@bhopaltraffic.in"
    
    # Professional Initial Password: BTU@BPL102
    initial_password = f"BTU@{clean_badge}"
    hashed_password = pwd_context.hash(initial_password)

    try:
        # 3. Create Official User Account
        user_res = supabase.table("users").insert({
            "email": generated_email,
            "password": hashed_password
        }).execute()

        if not user_res.data:
            raise HTTPException(status_code=400, detail="User creation failed")

        user_id = user_res.data[0]["id"]

        # 4. Assign Official Role
        supabase.table("user_roles").insert({
            "user_id": user_id,
            "role": "officer"
        }).execute()

        return {
            "status": "Success",
            "officer_details": {
                "badge": clean_badge,
                "email": generated_email,
                "initial_password": initial_password # Returned for the Admin to share
            }
        }
    except Exception as e:
        # Catch if the badge is already registered
        raise HTTPException(status_code=400, detail="Badge ID already registered in system.")