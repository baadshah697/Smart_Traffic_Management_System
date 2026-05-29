from fastapi import APIRouter, Depends, HTTPException, status
from app.database import supabase
from app.deps import get_current_user, require_role
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/parking", tags=["Parking"])

# -------------------------
# Schema
# -------------------------
class ParkingCreate(BaseModel):
    name: str
    location: str
    total_slots: int
    occupied: int = 0  # 🔥 Changed to match your DB column name

# -------------------------
# View parking (all users)
# -------------------------
@router.get("/")
def get_parking(user=Depends(get_current_user)):
    # Fetches: id, name, location, total_slots, occupied
    response = supabase.table("parking_lots").select("*").execute()
    return response.data

# -------------------------
# Create parking (Officer access)
# -------------------------
@router.post("/")
def create_parking(
    data: ParkingCreate,
    user=Depends(require_role("officer"))
):
    parking_data = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "location": data.location,
        "total_slots": data.total_slots,
        "occupied": data.occupied  # 🔥 Matches 'occupied' in Supabase
    }

    response = supabase.table("parking_lots").insert(parking_data).execute()

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Parking creation failed in Supabase"
        )

    return response.data[0]



class ParkingApply(BaseModel):
    parking_lot_id: str
    vehicle_number: str
    reason: str
    estimated_duration: int = 60

@router.get("/public-lots")
def get_public_lots():
    response = supabase.table("parking_lots").select("*").execute()
    return response.data

@router.post("/apply")
def apply_parking(data: ParkingApply):
    request_data = {
        "id": str(uuid.uuid4()),
        "parking_lot_id": data.parking_lot_id,
        "vehicle_number": data.vehicle_number.replace('-', '').replace(' ', '').upper(),
        "reason": data.reason,
        "estimated_duration": data.estimated_duration,
        "status": "pending"
    }
    res = supabase.table("parking_requests").insert(request_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to submit request")
    return {"message": "Request submitted successfully", "request_id": request_data["id"]}

@router.get("/requests")
def get_parking_requests(user=Depends(require_role("officer"))):
    res = supabase.table("parking_requests").select("*, parking_lots(name)").eq("status", "pending").execute()
    return res.data

@router.post("/requests/{req_id}/approve")
def approve_parking_request(req_id: str, user=Depends(require_role("officer"))):
    req_res = supabase.table("parking_requests").select("*").eq("id", req_id).execute()
    if not req_res.data:
        raise HTTPException(status_code=404, detail="Request not found")
    
    req_data = req_res.data[0]
    if req_data['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Already processed")
        
    lot_id = req_data['parking_lot_id']
    lot_res = supabase.table("parking_lots").select("occupied, total_slots").eq("id", lot_id).execute()
    if not lot_res.data:
        raise HTTPException(status_code=404, detail="Parking lot not found")
        
    lot = lot_res.data[0]
    if lot['occupied'] >= lot['total_slots']:
        raise HTTPException(status_code=400, detail="Lot is fully occupied")
        
    supabase.table("parking_lots").update({"occupied": lot['occupied'] + 1}).eq("id", lot_id).execute()
    supabase.table("parking_requests").update({"status": "approved", "approved_by": user['sub']}).eq("id", req_id).execute()
    
    return {"message": "Approved"}

@router.post("/requests/{req_id}/reject")
def reject_parking_request(req_id: str, user=Depends(require_role("officer"))):
    res = supabase.table("parking_requests").update({"status": "rejected", "approved_by": user['sub']}).eq("id", req_id).execute()
    if not res.data:
         raise HTTPException(status_code=404, detail="Request not found")
    return {"message": "Rejected"}

import tempfile
from fastapi.responses import FileResponse

@router.get("/receipt/{req_id}/pdf")
def generate_parking_receipt(req_id: str):
    try:
        import qrcode
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle, Image
        from reportlab.lib.styles import getSampleStyleSheet

        res = supabase.table("parking_requests").select("*, parking_lots(name)").eq("id", req_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Request not found")
            
        data = res.data[0]
        if data['status'] != 'approved':
            raise HTTPException(status_code=400, detail="Request is not approved")
            
        lot_name = data.get('parking_lots', {}).get('name', 'Unknown')
        
        # Generator QR Code
        qr_data = f"ALLOWED\nVehicle: {data['vehicle_number']}\nPass ID: {data['id'][:15].upper()}\nLot: {lot_name}"
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(qr_data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        qr_tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        img.save(qr_tmp.name)
        qr_tmp.close()

        tmp = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
        tmp.close()
        
        doc = SimpleDocTemplate(tmp.name, pagesize=A4, rightMargin=50, leftMargin=50, topMargin=50, bottomMargin=50)
        styles = getSampleStyleSheet()
        
        story = []
        story.append(Paragraph('<font color="#1E40AF" size="20"><b>BHOPAL DIGITAL PARKING PASS</b></font>', styles['Title']))
        story.append(Spacer(1, 20))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor('#1E40AF')))
        story.append(Spacer(1, 20))
        
        table_data = [
            ['Pass ID', data['id'][:15].upper()],
            ['Vehicle Number', data['vehicle_number']],
            ['Assigned Lot', lot_name],
            ['Date & Time', str(data['created_at'])[:16]],
            ['Duration', f"{data['estimated_duration']} mins"],
            ['Status', 'VALID & APPROVED']
        ]
        
        t = Table(table_data, colWidths=[150, 250])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F3F4F6')),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
            ('PADDING', (0,0), (-1,-1), 10)
        ]))
        
        story.append(t)
        story.append(Spacer(1, 30))
        
        # Add QR Image
        qr_image = Image(qr_tmp.name, width=150, height=150)
        story.append(qr_image)
        
        story.append(Spacer(1, 20))
        story.append(Paragraph('<font size="10" color="gray">Scan at entry boom barrier. Drive safe.</font>', styles['Normal']))
        
        doc.build(story)
        
        return FileResponse(
            tmp.name,
            media_type='application/pdf',
            filename=f"BTU_Parking_{req_id[:8]}.pdf",
            headers={"Content-Disposition": f"attachment; filename=BTU_Parking_{req_id[:8]}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-requests/{plate}")
def get_my_requests(plate: str):
    res = supabase.table("parking_requests").select("*, parking_lots(name)").eq("vehicle_number", plate).execute()
    return res.data

# -------------------------
# Delete parking (Officer access)
# -------------------------
@router.delete("/{parking_id}")
def delete_parking(
    parking_id: str,
    user=Depends(require_role("officer"))
):
    response = (
        supabase.table("parking_lots")
        .delete()
        .eq("id", parking_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Parking node not found")

    return {"message": "Infrastructure decommissioned"}

# -------------------------
# Update parking
# -------------------------
@router.put("/{parking_id}")
def update_parking(
    parking_id: str,
    data: ParkingCreate,
    user=Depends(require_role("officer"))
):
    response = (
        supabase.table("parking_lots")
        .update({
            "name": data.name,
            "location": data.location,
            "total_slots": data.total_slots,
            "occupied": data.occupied
        })
        .eq("id", parking_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Parking not found")

    return response.data[0]