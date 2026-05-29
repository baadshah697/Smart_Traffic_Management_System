from dotenv import load_dotenv
load_dotenv()
from app.database import create_supabase_client

db = create_supabase_client()

cams = db.table("surveillance_cameras").select("id, location_name, direction, is_active").execute()
print("--- CAMERAS ---")
for c in cams.data:
    print("  " + str(c.get("direction","?")) + " | " + str(c.get("location_name")) + " | active=" + str(c.get("is_active")))

roads = db.table("congested_roads").select("camera_id, road_name, current_state, vehicle_count").execute()
print("--- CONGESTED ROADS ---")
for r in roads.data:
    cid = str(r.get("camera_id","None"))[:20]
    print("  cam=" + cid + " | " + str(r.get("road_name")) + " | state=" + str(r.get("current_state")) + " | veh=" + str(r.get("vehicle_count")))
