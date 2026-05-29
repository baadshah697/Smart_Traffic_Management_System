from fastapi import APIRouter, HTTPException
from app.database import supabase
from fastapi.responses import PlainTextResponse
import httpx
import uuid
import re # 🔥 Added for pattern matching
from datetime import datetime

router = APIRouter(prefix="/citizen", tags=["Citizen Portal"])

# 🏛️ INDIAN PLATE STANDARDS (LL NN LL NNNN)
INDIAN_PLATE_PATTERN = r"^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$"

# ==========================================
# 📲 SMS GATEWAY (Fast2SMS)
# ==========================================
async def send_fast2sms(phone: str, message: str):
    """Sends SMS alerts via Fast2SMS Gateway"""
    url = "https://www.fast2sms.com/dev/bulkV2"
    headers = {
        "authorization": "17kdc2DsYNTExSBqpOzRy0j6FCW4V3X98lvoUZuHgawJArIPnQ9zIOm13YxkQqd4jvuhCWSlLbywXEZ0",
        "Content-Type": "application/json"
    }
    
    clean_phone = str(phone)[-10:]
    payload = {
        "message": message,
        "language": "english",
        "route": "v3", 
        "numbers": clean_phone
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            result = response.json()
            print(f"--- SMS GATEWAY: {result.get('message')} to {clean_phone} ---")
            return result
        except Exception as e:
            print(f"CRITICAL: SMS Gateway Error: {e}")
            return None

# ==========================================
# 🔍 PUBLIC SEARCH
# ==========================================
@router.get("/my-challans/{plate_number}")
def get_citizen_challans(plate_number: str):
    """
    Public route: Search challans by plate without login.
    Now enforces Indian Plate Format validation.
    """
    try:
        # 1. Clean and Standardize input
        clean_plate = plate_number.replace("-", "").replace(" ", "").upper()
        
        # 🔥 2. REGEX VALIDATION: Prevent searching for invalid formats
        if not re.match(INDIAN_PLATE_PATTERN, clean_plate):
             raise HTTPException(
                 status_code=400, 
                 detail=f"Invalid Indian Plate Format: {clean_plate}. Expected LL NN LL NNNN."
             )

        # 3. Query Database
        response = supabase.table("e_challans") \
            .select("*, violations(*)") \
            .ilike("vehicle_number", f"%{clean_plate}%") \
            .execute()
            
        return {"data": response.data}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Search Fetch Error: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

# ==========================================
# 💳 PUBLIC PAYMENT SIMULATION
# ==========================================
@router.post("/pay/{challan_id}")
async def simulate_payment(challan_id: str):
    """Public route: Accounts for DB triggers and ownership"""
    try:
        challan_check = supabase.table("e_challans").select("*").eq("id", challan_id).execute()
        if not challan_check.data:
            raise HTTPException(status_code=404, detail="Challan not found")
        
        challan_data = challan_check.data[0]

        payment_record = {
            "id": str(uuid.uuid4()),
            "challan_id": challan_id,
            "amount": challan_data['amount'],
            "payment_method": "UPI-Simulated",
            "transaction_id": f"TSL-{uuid.uuid4().hex[:10].upper()}",
            "status": "success",
            "paid_at": datetime.utcnow().isoformat()
        }
        
        pay_res = supabase.table("payments").insert(payment_record).execute()
        if not pay_res.data:
            raise HTTPException(status_code=500, detail="Payment record creation failed")

        res = supabase.table("e_challans") \
            .update({"status": "paid", "paid_at": datetime.utcnow().isoformat()}) \
            .eq("id", challan_id) \
            .execute()
        
        if not res.data:
            raise HTTPException(status_code=500, detail="Challan status update failed")
            
        challan = res.data[0]

        if challan.get('owner_id'):
            user_res = supabase.table("users") \
                .select("phone") \
                .eq("id", challan['owner_id']) \
                .execute()

            if user_res.data and user_res.data[0].get('phone'):
                phone_number = user_res.data[0]['phone']
                msg = f"Bhopal Traffic: Payment of Rs.{challan['amount']} received. Receipt ID: {payment_record['transaction_id']}"
                await send_fast2sms(phone_number, msg)

        return {"message": "Fine paid successfully", "data": challan}
    except Exception as e:
        print(f"❌ Payment Logic Crash: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 📄 PUBLIC RECEIPT GENERATION
# ==========================================
@router.get("/receipt/{challan_id}")
def generate_receipt(challan_id: str):
    """Public route: Generate text-based receipt"""
    try:
        res = supabase.table("e_challans") \
            .select("*, violations(*)") \
            .eq("id", challan_id) \
            .execute()
        
        if not res.data:
            raise HTTPException(status_code=404, detail="Challan not found")
        
        data = res.data[0]
        v = data.get('violations')
        v_type = v.get('violation_type', 'Traffic Violation') if v else 'Traffic Violation'

        receipt_content = f"""
        -------------------------------------------
        BHOPAL POLICE - TRAFFIC VIOLATION RECEIPT
        -------------------------------------------
        CHALLAN ID: {data['id']}
        STATUS:     {data['status'].upper()}
        VEHICLE:    {data['vehicle_number']}
        OWNER:      {data['owner_name']}
        -------------------------------------------
        VIOLATION:  {v_type}
        DATE:       {data['issued_at']}
        TOTAL PAID: ₹{data['amount']}
        -------------------------------------------
        Drive safe, Bhopal.
        """
        return PlainTextResponse(content=receipt_content, media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error generating receipt")

# ==========================================
# 🚨 AI ENGINE HELPERS
# ==========================================
async def get_phone_from_plate(plate_number: str):
    """Look up phone number via users table"""
    try:
        v_res = supabase.table("vehicles").select("owner_id").eq("plate_number", plate_number).execute()
        if v_res.data and v_res.data[0].get('owner_id'):
            owner_id = v_res.data[0]['owner_id']
            u_res = supabase.table("users").select("phone").eq("id", owner_id).execute()
            if u_res.data:
                return u_res.data[0].get('phone')
        return None
    except Exception as e:
        return None

@router.post("/report-violation")
async def report_violation(plate: str, v_type: str, location: str = "Bhopal"):
    """Triggered by AI Engine to alert violators"""
    try:
        phone = await get_phone_from_plate(plate)
        if phone:
            msg = f"ALERT: Traffic violation ({v_type}) detected for {plate} at {location}. Check portal."
            await send_fast2sms(phone, msg)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to process alert")