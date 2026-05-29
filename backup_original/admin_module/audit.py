from fastapi import APIRouter, Depends
from app.database import supabase
from app.auth import get_current_user
import pandas as pd

router = APIRouter(prefix="/admin/module/audit", tags=["Admin: Personnel Audit"])

@router.get("/performance")
def get_officer_performance(current_user=Depends(get_current_user)):
    # Security: Ensure only BTU Root Admins can access performance metrics
    if current_user.get("role") != "admin":
        return {"error": "Unauthorized Access Detected"}

    # 1. 🔥 DYNAMIC SYNC: Identify current hotspots from the database
    challans_res = supabase.table("e_challans").select("issued_by, amount, status, location").execute()
    
    # Safety Check: Return empty list if no challans exist yet
    if not challans_res.data: 
        return []
    
    df_all = pd.DataFrame(challans_res.data)
    
    # Identify the top 3 locations by volume right now (Live Hotspots)
    active_hotspots = df_all['location'].value_counts().head(3).index.tolist()

    # 2. Fetch all registered officers
    officers_res = supabase.table("user_roles").select("badge_number").eq("role", "officer").execute()
    
    performance_data = []
    
    for officer in officers_res.data:
        badge = officer['badge_number']
        # Filter all challans issued by this specific officer
        officer_challans = df_all[df_all['issued_by'] == badge]
        
        total_issued = len(officer_challans)
        
        # Check if this officer is patrolling active hotspots identified by the Oracle
        is_aligned = any(loc in active_hotspots for loc in officer_challans['location'].tolist())
        
        # Revenue calculations based on payment status
        paid_rev = officer_challans[officer_challans['status'] == 'paid']['amount'].sum()
        unpaid_rev = officer_challans[officer_challans['status'] == 'unpaid']['amount'].sum()
        
        # Calculate Base Efficiency
        base_eff = (paid_rev / (paid_rev + unpaid_rev) * 100) if (paid_rev + unpaid_rev) > 0 else 0
        
        # 🔥 STRATEGIC MULTIPLIER: Reward officers following AI guidance
        final_efficiency = min(round(base_eff * (1.5 if is_aligned else 1.0), 1), 100.0)
        
        performance_data.append({
            "badge": badge,
            "total_issued": total_issued,
            "revenue_generated": int(paid_rev),
            "efficiency": final_efficiency,
            "is_strategic": is_aligned # Triggers the 'Oracle Aligned' star in UI
        })

    # Rank officers by Efficiency (Intelligence over raw volume)
    performance_data.sort(key=lambda x: x['efficiency'], reverse=True)
    return performance_data