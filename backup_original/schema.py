from pydantic import BaseModel


class ViolationCreate(BaseModel):
    camera_id: int
    vehicle_plate: str
    violation_type: str
    evidence_url: str
    confidence_score: float


class ChallanCreate(BaseModel):
    violation_id: int
    vehicle_plate: str
    owner_id: str
    amount: float
    due_date: str


class PaymentCreate(BaseModel):
    challan_id: int
    amount: float
    payment_method: str
    transaction_id: str


class TrafficCreate(BaseModel):
    road_name: str
    area: str
    congestion_level: str
    is_closed: bool


class ParkingCreate(BaseModel):
    name: str
    area: str
    total_capacity: int
    occupied: int
