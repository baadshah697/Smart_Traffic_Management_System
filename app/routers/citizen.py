from fastapi import APIRouter, HTTPException
from app.database import supabase
from fastapi.responses import PlainTextResponse, FileResponse
from pydantic import BaseModel
import uuid
import re
from datetime import datetime
import threading
import os
import tempfile

router = APIRouter(prefix="/citizen", tags=["Citizen Portal"])

# 🏛️ INDIAN PLATE STANDARDS (LL NN LL NNNN)
INDIAN_PLATE_PATTERN = r"^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$"

# ==========================================
# 📲 WHATSAPP GATEWAY (Free via pywhatkit)
# ==========================================
def _send_whatsapp_bg(phone: str, message: str):
    """Background thread: sends WhatsApp message via pywhatkit.
    Requires WhatsApp Web to be logged in on default browser."""
    try:
        import pywhatkit
        # Format: +91XXXXXXXXXX for Indian numbers
        clean_phone = str(phone).strip()
        if not clean_phone.startswith("+"):
            clean_phone = "+91" + clean_phone[-10:]

        # sendwhatmsg_instantly sends without scheduling
        pywhatkit.sendwhatmsg_instantly(
            clean_phone,
            message,
            wait_time=15,       # seconds to wait for WhatsApp Web to load
            tab_close=True,     # auto-close the browser tab after sending
            close_time=3        # seconds to wait before closing tab
        )
        print(f"✅ WHATSAPP SENT to {clean_phone}")
    except Exception as e:
        print(f"⚠️ WhatsApp Gateway Error: {e}")
        print(f"📋 FALLBACK LOG → To: {phone} | Message: {message}")

async def send_whatsapp(phone: str, message: str):
    """Non-blocking WhatsApp sender. Dispatches to background thread
    so the API response is not delayed."""
    thread = threading.Thread(target=_send_whatsapp_bg, args=(phone, message), daemon=True)
    thread.start()
    print(f"📨 WhatsApp queued for {phone}")
    return {"status": "queued"}

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
# 🔍 VEHICLE LOOKUP (Step 3 Gate)
# ==========================================
@router.get("/lookup-vehicle/{plate_number}")
def lookup_vehicle(plate_number: str):
    """Check if a vehicle exists in our DB. Used by Citizen Portal to show registration gate."""
    try:
        clean = plate_number.replace('-', '').replace(' ', '').upper()
        res = supabase.table("vehicles").select("plate_number, owner_name").eq("plate_number", clean).execute()
        if res.data:
            return {"found": True, "plate": clean, "owner": res.data[0].get("owner_name", "Unknown")}
        return {"found": False, "plate": clean}
    except Exception as e:
        return {"found": False, "plate": plate_number, "error": str(e)}

# ==========================================
# 📋 VEHICLE REGISTRATION (Step 3 Growth)
# ==========================================
class VehicleRegister(BaseModel):
    plate_number: str
    owner_name: str
    phone: str
    vehicle_model: str = ""
    vehicle_color: str = ""

@router.post("/register-vehicle")
def register_vehicle(data: VehicleRegister):
    """Citizen self-registration: grows the vehicles database."""
    try:
        clean = data.plate_number.replace('-', '').replace(' ', '').upper()
        # Check not already registered
        existing = supabase.table("vehicles").select("id").eq("plate_number", clean).execute()
        if existing.data:
            return {"status": "already_exists", "plate": clean}

        vehicle_id = str(uuid.uuid4())
        supabase.table("vehicles").insert({
            "id": vehicle_id,
            "plate_number": clean,
            "owner_name": data.owner_name,
            "phone": data.phone,
            "model": data.vehicle_model,
            "vehicle_color": data.vehicle_color,
            "created_at": datetime.utcnow().isoformat(),
        }).execute()
        return {"status": "registered", "plate": clean, "vehicle_id": vehicle_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {e}")

# ==========================================
# 💳 PUBLIC PAYMENT SIMULATION
# ==========================================
@router.post("/pay/{challan_id}")
async def simulate_payment(challan_id: str):
    """Public route: Marks challan paid + sends WhatsApp confirmation."""
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
        txn_id = payment_record['transaction_id']
        amount = challan.get('amount', 0)
        plate = challan.get('vehicle_number', 'UNKNOWN')

        # 🔥 Send WhatsApp: try stored phone_number on challan first, then owner lookup
        phone_to_notify = challan.get('phone_number')
        if not phone_to_notify and challan.get('owner_id'):
            user_res = supabase.table("users").select("phone").eq("id", challan['owner_id']).execute()
            if user_res.data:
                phone_to_notify = user_res.data[0].get('phone')

        if phone_to_notify:
            msg = (
                f"[BTU PAYMENT CONFIRMED] ₹{amount} paid for vehicle {plate}. "
                f"Receipt ID: {txn_id}. Thank you for your compliance. Drive safe, Bhopal!"
            )
            threading.Thread(target=_send_whatsapp_bg, args=(phone_to_notify, msg), daemon=True).start()
            print(f"📨 Payment WhatsApp queued for {phone_to_notify}")

        return {"message": "Fine paid successfully", "data": challan, "transaction_id": txn_id}
    except Exception as e:
        print(f"❌ Payment Logic Crash: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 📄 TEXT RECEIPT (existing, kept intact)
# ==========================================
@router.get("/receipt/{challan_id}")
def generate_receipt(challan_id: str):
    """Public route: Generate text-based receipt"""
    try:
        res = supabase.table("e_challans").select("*, violations(*)").eq("id", challan_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Challan not found")
        data = res.data[0]
        v = data.get('violations')
        v_type = v.get('violation_type', 'Traffic Violation') if v else 'Traffic Violation'
        
        owner_name = data.get('owner_name', 'Unknown')
        if not owner_name or owner_name == 'Unknown':
            v_res = supabase.table('vehicles').select('owner_name').eq('plate_number', data.get('vehicle_number', '')).execute()
            if v_res.data:
                owner_name = v_res.data[0].get('owner_name', 'Unknown')

        receipt_content = f"""
        -------------------------------------------
        BHOPAL POLICE - TRAFFIC VIOLATION RECEIPT
        -------------------------------------------
        CHALLAN ID: {data['id']}
        STATUS:     {data['status'].upper()}
        VEHICLE:    {data['vehicle_number']}
        OWNER:      {owner_name}
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
# 📄 PDF RECEIPT (Step 4)
# ==========================================
@router.get("/receipt/{challan_id}/pdf")
def generate_pdf_receipt(challan_id: str):
    """Returns a branded PDF receipt for a paid challan."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm

        res = supabase.table("e_challans").select("*, violations(*)").eq("id", challan_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Challan not found")
        data = res.data[0]
        v = data.get('violations')
        v_type = v.get('violation_type', 'Traffic Violation') if v else 'Traffic Violation'

        owner_name = data.get('owner_name', 'Unknown')
        if not owner_name or owner_name == 'Unknown':
            v_res = supabase.table('vehicles').select('owner_name').eq('plate_number', data.get('vehicle_number', '')).execute()
            if v_res.data:
                owner_name = v_res.data[0].get('owner_name', 'Unknown')

        tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        tmp.close()

        doc = SimpleDocTemplate(tmp.name, pagesize=A4,
                                rightMargin=25*mm, leftMargin=25*mm,
                                topMargin=20*mm, bottomMargin=20*mm)
        styles = getSampleStyleSheet()
        RED = colors.HexColor('#C0392B')
        DARK = colors.HexColor('#1E293B')
        GRAY = colors.HexColor('#64748B')

        story = []

        # Header
        story.append(Paragraph('<font color="#C0392B" size="20"><b>BHOPAL POLICE</b></font>', styles['Title']))
        story.append(Paragraph('<font color="#64748B" size="9">Traffic Enforcement Unit — E-Challan Receipt</font>', styles['Normal']))
        story.append(Spacer(1, 8*mm))
        story.append(HRFlowable(width="100%", thickness=2, color=RED))
        story.append(Spacer(1, 6*mm))

        # Table data
        table_data = [
            ['Challan ID',   data.get('id', '')[:18] + '...'],
            ['Vehicle',      data.get('vehicle_number', 'N/A')],
            ['Owner',        owner_name],
            ['Violation',    v_type],
            ['Date Issued',  str(data.get('issued_at', ''))[:10]],
            ['Status',       data.get('status', '').upper()],
            ['Amount',       f"Rs. {data.get('amount', 0)}"],
        ]
        t = Table(table_data, colWidths=[60*mm, 100*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F8FAFC')),
            ('TEXTCOLOR',  (0, 0), (0, -1), DARK),
            ('FONTNAME',   (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE',   (0, 0), (-1, -1), 10),
            ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
            ('GRID',       (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING',    (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        story.append(t)
        story.append(Spacer(1, 10*mm))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E2E8F0')))
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph('<font color="#C0392B" size="8">Drive safe, Bhopal. This is a computer-generated receipt.</font>', styles['Normal']))

        doc.build(story)

        return FileResponse(
            tmp.name,
            media_type='application/pdf',
            filename=f"BTU_Receipt_{challan_id[:8]}.pdf",
            headers={"Content-Disposition": f"attachment; filename=BTU_Receipt_{challan_id[:8]}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")

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
            await send_whatsapp(phone, msg)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to process alert")