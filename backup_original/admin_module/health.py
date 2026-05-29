import psutil
import time
from fastapi import APIRouter, Depends
from app.database import supabase
from app.auth import get_current_user

router = APIRouter(prefix="/admin/module/health", tags=["Admin: System Health"])

@router.get("/live-vitals")
def get_live_vitals(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        return {"error": "Unauthorized"}

    # 🖥️ Real-time Hardware Metrics
    cpu_usage = psutil.cpu_percent(interval=None) # Non-blocking
    ram = psutil.virtual_memory()
    
    # 💾 Storage for Evidence (Static directory check)
    disk = psutil.disk_usage('/')
    
    # ⚡ Database Latency Check
    start_time = time.time()
    try:
        supabase.table("users").select("id").limit(1).execute()
        db_latency = round((time.time() - start_time) * 1000, 2) # in ms
        db_status = "Operational"
    except:
        db_latency = 0
        db_status = "Disconnected"

    return {
        "cpu": cpu_usage,
        "ram": ram.percent,
        "storage_used": disk.percent,
        "storage_free_gb": round(disk.free / (1024**3), 2),
        "db_latency": db_latency,
        "db_status": db_status,
        "timestamp": time.time()
    }