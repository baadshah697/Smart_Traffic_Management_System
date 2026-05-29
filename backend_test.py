from app.utils import post_violation_direct

# 🔥 REPLACE 'your-camera-uuid-here' with the actual ID from your SQL result
VALID_CAMERA_ID = "3e1c7eeb-bc3a-44d0-9b3a-840790b7413b" 

print("🚀 Starting Simulation...")

post_violation_direct(
    v_type="No Helmet", 
    plate_number="MH40BN1339", 
    camera_id=VALID_CAMERA_ID, 
    confidence=0.98
)