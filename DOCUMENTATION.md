# V.I.T.A.L.S. - Vision-Integrated Traffic & Autonomous Logistics System
**Bhopal Smart City AI Traffic Management System**

V.I.T.A.L.S. is an end-to-end, fully autonomous ecosystem designed to modernize city traffic infrastructure. It replaces static, timer-based traffic lights with a dynamic, AI-driven engine that processes real-time camera feeds, manages signal phases based on actual vehicle density, autonomously detects traffic violations, and flags emergency vehicles.

---

## 🏗️ System Architecture & Tech Stack

### Backend
- **FastAPI (Python)**: High-performance async API server serving as the backbone.
- **Supabase (PostgreSQL)**: Cloud database for real-time state synchronization, user authentication, and data logging.
- **Stable Baselines 3 (PPO)**: Reinforcement Learning model powering the adaptive traffic light decisions.

### AI & Computer Vision (`app/utils.py`)
- **YOLOv8 (`yolov8n.pt`)**: Real-time multi-class object tracking (Cars, Buses, Trucks, Motorcycles, Persons).
- **Custom Enforcement Model (`best.pt`)**: Specialized YOLO model trained to detect License Plates, Helmets, and Motorcycles.
- **EasyOCR**: Optical Character Recognition engine for reading ALPR (Automatic License Plate Recognition) crops.

### Frontends
- **Admin Dashboard (React + Vite, `frontend-v2`)**: Secure portal for Traffic Officers featuring live Surveillance screens, E-Challan logs, GIS Maps, and statistical reporting.
- **Citizen App (React Native/Expo, `AI_traffic_app`)**: Mobile application for citizens.

---

## 🧠 Core Modules Breakdown

### 1. Adaptive Intersection Controller (`app/intersection_controller.py`)
Instead of fixed 60-second timers, the AI acts as a digital traffic cop orchestrating a 4-way intersection.
- **Algorithmic Demand Routing**: It continuously calculates the queue lengths for North, South, East, and West lanes.
- **Smart Phase Switching**: Allocates the green light to the lane with the heaviest traffic and drains it dynamically. It holds a green light for a minimum of 10 seconds to prevent signaling flicker.
- **Hard Emergency Override**: If an Ambulance is detected, the AI completely bypasses standard queues and immediately forces a Green light for the emergency lane.

### 2. Dual-Model Computer Vision Engine (`app/utils.py`)
The surveillance core uses two synchronous AI models on every video frame:
1. **Tracking Pass (YOLOv8)**: Assigns a tracking ID to every moving vehicle, continuously counting the density and triggering the Intersection Controller.
2. **Enforcement Pass (Custom YOLO + OCR)**: 
   - Scans expanding bounding boxes around motorcycles to detect **Triple Riding** or **No Helmet** violations.
   - Monitors the "Red Light Enforcement Zone" (a tripwire in the camera view). If an intersection is Red and a vehicle crosses the wire, it is flagged as a **Red Light Jump**.

### 3. E-Challan & ALPR Pipeline
When a violation (e.g., Triple Riding, No Helmet, Red Light Jump) occurs:
- The system zooms in and extracts the bounding box over the License Plate (`best.pt`).
- **EasyOCR** attempts to read the plate format (e.g., `MP04 AB 1234`).
- **Autonomous Logging**: If successful, it looks up the owner in the Supabase `vehicles` table and inserts a live ticket into the `violations` and `e_challans` tables.
- **Manual Fallback**: If the car is moving too fast and the plate is blurry, the system saves the image and logs the plate as `UNKNOWN`. In the Officer Dashboard (`ChallanLogs.tsx`), this creates an editable field where a human officer can visually read the attached evidence image and manually type the plate to issue the challan.

### 4. 4-Way Simulator (`app/intersection_simulator.py`)
To emulate a massive intersection from a single machine, the backend runs a background simulator.
- It maps the user's local USB/Webcam to the **North (N)** lane and actively generates random, weighted traffic queues for **South, East, and West**.
- Periodically injects huge congestion spikes and virtual ambulances to stress-test the RL decision-making engine.

---

## 🗄️ Database Schema Overview (Supabase)

The core relational structure includes:
- **`congested_roads`**: The live source of truth for the React map. Stores current `vehicle_count`, `congestion_level` (0-100%), and the active signal phase (`green`/`red`) for every camera node.
- **`violations`**: Logs every AI-detected infraction. Stores `violation_type`, `confidence_score`, `plate_number`, and a URL to the `evidence_image`.
- **`e_challans`**: Links `violations` to financial tickets. Stores the calculated `amount`, `due_date`, and payment `status`.
- **`vehicles`**: The citizen registry mapping `plate_number` to `owner_name` and `phone_number`.
- **`accidents`**: A spatial table for crash detection logging `latitude`, `longitude`, `injuries`, and timestamps.

---

## 💻 How to Run the System Locally

### Step 1: Start the Backend (FastAPI + AI Engine)
Open a terminal in `Module_2_Backend` and activate your environment:
```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```
*Note: This will output GPU initialization logs and automatically boot the intersection simulation threads.*

### Step 2: Start the Officer Web Dashboard (React)
Open a new terminal in `Module_2_Backend/frontend-v2`:
```bash
npm install
npm run dev
```
Navigate to the provided localhost URL. The dashboard polls the backend every second to show live AI decisions on the **Surveillance** page.

### Step 3: Start the Citizen Mobile App (Expo)
Open a new terminal in `Module_2_Backend/AI_traffic_app`:
```bash
npm install
npx expo start
```
Scan the QR code with the Expo Go app on iOS/Android or press `a` to run an Android emulator.
