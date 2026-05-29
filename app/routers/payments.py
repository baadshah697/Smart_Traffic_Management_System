from fastapi import APIRouter, Depends, HTTPException, status
from app.database import supabase
from app.deps import require_role, get_current_user
from pydantic import BaseModel
import uuid
from datetime import datetime

router = APIRouter(prefix="/payments", tags=["Payments"])


# -------------------------
# Request Schema
# -------------------------
class PaymentCreate(BaseModel):
    challan_id: str
    amount: float
    payment_method: str


# -------------------------
# Citizen: Make Payment
# -------------------------
@router.post("/")
def make_payment(
    data: PaymentCreate,
    user=Depends(require_role("citizen"))
):
    # Step 1: Check challan exists
    challan = (
        supabase.table("e_challans")
        .select("*")
        .eq("id", data.challan_id)
        .execute()
    )

    if not challan.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challan not found"
        )

    challan_data = challan.data[0]

    # Step 2: Ownership check
    if challan_data["owner_id"] != user["sub"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your challan"
        )

    # Step 3: Prevent double payment
    if challan_data["status"] == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challan already paid"
        )

    # Step 4: Amount validation
    if data.amount != challan_data["amount"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect payment amount"
        )

    # Step 5: Insert payment
    payment_data = {
        "id": str(uuid.uuid4()),
        "challan_id": data.challan_id,
        "user_id": user["sub"],
        "amount": data.amount,
        "payment_method": data.payment_method,
        "paid_at": datetime.utcnow().isoformat(),
    }

    payment_res = supabase.table("payments").insert(payment_data).execute()

    if not payment_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment failed"
        )

    # Step 6: Update challan status
    supabase.table("e_challans").update({
        "status": "paid"
    }).eq("id", data.challan_id).execute()

    return {
        "message": "Payment successful",
        "payment": payment_res.data[0]
    }


# -------------------------
# Citizen: View own payments
# -------------------------
@router.get("/my")
def get_my_payments(user=Depends(require_role("citizen"))):
    response = (
        supabase.table("payments")
        .select("*")
        .eq("user_id", user["sub"])
        .execute()
    )

    return response.data


# -------------------------
# Admin: View all payments
# -------------------------
@router.get("/all")
def get_all_payments(user=Depends(require_role("admin"))):
    response = supabase.table("payments").select("*").execute()
    return response.data
