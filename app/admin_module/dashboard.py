from fastapi import APIRouter, Depends
from app.database import supabase
from app.auth import get_current_user

router = APIRouter(prefix="/admin/module/stats", tags=["Admin: Unified Dashboard"])

@router.get("/all")
def get_unified_stats(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        return {"error": "Unauthorized"}

    # 💰 Revenue Data
    rev_res = supabase.table("e_challans").select("amount, status").execute()
    total_revenue = sum(c['amount'] for c in rev_res.data if c['status'] == 'paid')

    # 🚗 Parking Grid Status
    park_res = supabase.table("parking_lots").select("name, occupied, total_slots").execute()
    
    # 🚨 Violation Categories
    vio_res = supabase.table("violations").select("violation_type").execute()
    vio_counts = {}
    for v in vio_res.data:
        vio_counts[v['violation_type']] = vio_counts.get(v['violation_type'], 0) + 1

    return {
        "revenue": total_revenue,
        "parking": park_res.data,
        "violations": [{"type": k, "count": v} for k, v in vio_counts.items()],
        "officer_count": len(supabase.table("user_roles").select("id").eq("role", "officer").execute().data)
    }