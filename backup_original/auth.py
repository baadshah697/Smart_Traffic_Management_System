import os
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from app.database import supabase
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

router = APIRouter(prefix="/auth", tags=["Auth"])

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "temporary-dev-key-123")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Schema for the special Admin setup
class AdminSetupRequest(BaseModel):
    email: str
    password: str
    admin_secret: str  # To prevent unauthorized admin creation

class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# 🔥 NEW: Specialized Admin Registration
@router.post("/register-admin-secure")
def register_admin_secure(data: AdminSetupRequest):
    # Check if the secret key matches your .env value or a hardcoded one
    if data.admin_secret != "BHOPAL_PTU_SETUP_2026": 
        raise HTTPException(status_code=403, detail="Invalid Admin Secret")

    hashed = hash_password(data.password)
    
    # 1. Insert into 'users'
    user_res = supabase.table("users").insert({
        "email": data.email, 
        "password": hashed
    }).execute()

    if not user_res.data:
        raise HTTPException(status_code=500, detail="Admin creation failed")

    # 2. Assign 'admin' role in 'user_roles'
    user_id = user_res.data[0]["id"]
    supabase.table("user_roles").insert({
        "user_id": user_id, 
        "role": "admin"
    }).execute()

    return {"message": "Admin account initialized successfully"}

@router.post("/register")
def register(data: RegisterRequest):
    if data.role.lower() == "admin":
        raise HTTPException(status_code=403, detail="Standard admin registration blocked")

    existing = supabase.table("users").select("id").eq("email", data.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="User already exists")

    hashed = hash_password(data.password)
    user_res = supabase.table("users").insert({"email": data.email, "password": hashed}).execute()

    if not user_res.data:
        raise HTTPException(status_code=500, detail="User creation failed")

    user_id = user_res.data[0]["id"]
    supabase.table("user_roles").insert({"user_id": user_id, "role": data.role.lower()}).execute()
    return {"message": "User created successfully"}

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    email = form_data.username
    password = form_data.password

    user_res = supabase.table("users").select("*").eq("email", email).execute()
    if not user_res.data:
        raise HTTPException(status_code=400, detail="User not found")

    user = user_res.data[0]
    if not verify_password(password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid password")

    role_res = supabase.table("user_roles").select("role").eq("user_id", user["id"]).execute()
    if not role_res.data:
        raise HTTPException(status_code=400, detail="Role not assigned")

    role = role_res.data[0]["role"]
    token = create_access_token({"sub": user["id"], "role": role})

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": role 
    }
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if user_id is None:
            raise credentials_exception
        return {"id": user_id, "role": role}
    except JWTError:
        raise credentials_exception