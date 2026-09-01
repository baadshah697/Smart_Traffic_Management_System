# 🚦 V.I.T.A.L.S. - Vision-Integrated Traffic & Autonomous Logistics System

**Bhopal Smart City AI Traffic Management System**

V.I.T.A.L.S. is an end-to-end, fully autonomous ecosystem designed to modernize city traffic infrastructure. It replaces static, timer-based traffic lights with a dynamic, AI-driven engine that processes real-time camera feeds, manages signal phases based on actual vehicle density, autonomously detects traffic violations, and flags emergency vehicles.

---

## ✨ Key Features
- **Algorithmic Demand Routing**: Uses Reinforcement Learning to dynamically allocate green lights based on real-time traffic density across a 4-way intersection.
- **Emergency Override**: Detects ambulances and forces immediate green lights for emergency lanes.
- **Dual-Model Computer Vision**: Simultaneous YOLOv8 object tracking and a custom YOLO enforcement model for violation detection.
- **Autonomous E-Challan System**: Detects Red Light Jumps, Triple Riding, and No Helmet violations. Uses EasyOCR for Automatic License Plate Recognition (ALPR) and logs fines directly to the cloud database.
- **Officer Dashboard**: A React-based command center for traffic officers to monitor live surveillance, manage E-Challans, and view system analytics.

---

## 🏗️ System Architecture & Tech Stack

### Backend
- **FastAPI (Python)**: High-performance async API server serving as the backbone.
- **Supabase (PostgreSQL)**: Cloud database for real-time state synchronization, user authentication, and data logging.
- **Stable Baselines 3 (PPO)**: Reinforcement Learning model powering the adaptive traffic light decisions.

### AI & Computer Vision (`app/utils.py`)
- **YOLOv8**: Real-time multi-class object tracking (Cars, Buses, Trucks, Motorcycles, Persons).
- **Custom Enforcement Model**: Specialized YOLO model trained to detect License Plates, Helmets, and Motorcycles.
- **EasyOCR**: Optical Character Recognition engine for reading ALPR crops.

### Frontends
- **Admin Dashboard (`frontend-v2`)**: React + Vite secure portal for Traffic Officers.

---

## 🚀 Getting Started

Follow these instructions to clone, set up, and run the complete system locally.

### 1. Prerequisites
- **Python 3.9+** (For the FastAPI Backend and AI Models)
- **Node.js v18+ & npm** (For the React Dashboard)
- **Git**

### 2. Clone the Repository
```bash
git clone https://github.com/baadshah697/Smart_Traffic_Management_System.git
cd Smart_Traffic_Management_System
```


### 3. Environment Variables
The system uses Supabase. You need to provide your API keys to connect to the database.
1. Duplicate the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### 4. AI Model Weights (Critical)
Because AI models are large binaries, they are excluded from this repository. Before starting the backend, you **must** obtain the following model weights and place them in the **root** directory:
- `best.pt` (Custom enforcement YOLO model)
- `yolov8n.pt` (Standard YOLO tracking model)
- `vitals_ppo_model.zip` (Trained Reinforcement Learning agent)
- `vitals_ppo_vecnorm.pkl` (RL environment vector normalizer)

*(Contact the repository owner or refer to release artifacts to download these weights).*

---

## 💻 Running the System

### Step 1: Start the Backend (FastAPI + AI Engine)
Open a terminal in the root directory:
```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```
*Note: This will output GPU initialization logs and automatically boot the intersection simulation threads.*

### Step 2: Start the Officer Web Dashboard (React)
Open a new terminal and navigate to the frontend folder:
```bash
cd frontend-v2
npm install
npm run dev
```
Navigate to the provided localhost URL (usually `http://localhost:5173`). The dashboard polls the backend every second to show live AI decisions on the **Surveillance** page.


---

## 🗄️ Database Schema Overview

The core relational structure in Supabase includes:
- **`congested_roads`**: The live source of truth for the React map. Stores current `vehicle_count`, `congestion_level`, and the active signal phase for every camera node.
- **`violations`**: Logs every AI-detected infraction. Stores `violation_type`, `confidence_score`, `plate_number`, and a URL to the `evidence_image`.
- **`e_challans`**: Links `violations` to financial tickets. Stores the calculated `amount`, `due_date`, and payment `status`.
- **`vehicles`**: The citizen registry mapping `plate_number` to `owner_name`.
- **`accidents`**: A spatial table for crash detection logging locations and timestamps.

---
*Developed for the Bhopal Smart City AI Traffic Management Initiative.*
