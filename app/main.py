import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# Core Routers
from .auth import router as auth_router 
from .routers import (
    violations, challans, payments, 
    traffic, parking, cameras, citizen
)

# Admin Module Routers
from app.admin_module import (
    officer_mgmt, dashboard, health, 
    audit, oracle, settings
)

# ─── 4-Way Intersection Simulator (auto-starts on import) ───────
# Creates simulated South/East/West camera nodes + feeds live data
# to the PPO RL agent so the Surveillance page shows all 4 lanes.
from app import intersection_simulator  # noqa: F401

app = FastAPI(
    title="Bhopal PTU Traffic Backend",
    description="V.I.TA.L.S. - AI-Powered Traffic Enforcement HQ",
    version="1.2.0"
)

# --- 📁 STATIC ASSETS CONFIGURATION ---
# This ensures Evidence Captures from your OMEN 16 are accessible by the React UI
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(CURRENT_DIR, "static")

# Safety Check: Create evidence folder if it doesn't exist
EV_FOLDER = os.path.join(STATIC_DIR, "evidence")
if not os.path.exists(EV_FOLDER):
    os.makedirs(EV_FOLDER, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# --- 🛡️ SECURITY & CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"], 
)

@app.get("/")
def root():
    return {
        "status": "Online",
        "system": "Bhopal HQ Traffic Command",
        "engine": "Dual-YOLOv8 CUDA Accelerated",
        "version": "1.2.0"
    }

# --- 🚀 ROUTER REGISTRATION ---

# Security & Public Access
app.include_router(auth_router, tags=["Security"])
app.include_router(citizen.router, tags=["Citizen Portal"])

# AI & Traffic Operations
app.include_router(cameras.router, tags=["Surveillance & AI Engine"])
app.include_router(violations.router, tags=["AI Detection Logs"])
app.include_router(traffic.router, tags=["Congestion & Signal Logic"])

# Database & Infrastructure
app.include_router(challans.router, tags=["E-Challan DBMS"])
app.include_router(payments.router, tags=["Financial Audit"])
app.include_router(parking.router, tags=["Parking Infrastructure"])

# BTU Admin Command Center
app.include_router(officer_mgmt.router, tags=["Admin: Personnel"])
app.include_router(dashboard.router, tags=["Admin: Statistics"])
app.include_router(health.router, tags=["Admin: System Health"])
app.include_router(audit.router, tags=["Admin: Personnel Audit"])
app.include_router(oracle.router, tags=["Admin: Oracle AI Analytics"])
app.include_router(settings.router, tags=["Admin: System Architect"])