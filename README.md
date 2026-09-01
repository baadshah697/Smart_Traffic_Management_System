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

Follow these step-by-step instructions to clone, configure, and boot the entire system on your local machine.

### 1. Prerequisites (What you need installed)
Before doing anything, ensure your computer has the following software installed:
- **[Python 3.9+](https://www.python.org/downloads/)**: Required to run the FastAPI backend and AI Models. *(Make sure to check "Add Python to PATH" during installation).*
- **[Node.js v18+](https://nodejs.org/)**: Required to run the React Web Dashboard. This will also install `npm`.
- **[Git](https://git-scm.com/downloads)**: Required to download this repository to your computer.
- **[Supabase Account](https://supabase.com/)**: A free account is required to host the Postgres database.
- **NVIDIA GPU with CUDA Support** *(Optional but Highly Recommended)*. The AI models run optimally on a dedicated GPU. If you don't have one, the system will automatically fall back to CPU mode, which runs successfully but at a much slower video framerate.

### 2. Download the Project
Open your terminal (or Command Prompt) and download the code to your local machine:
```bash
git clone https://github.com/baadshah697/Smart_Traffic_Management_System.git
cd Smart_Traffic_Management_System
```

### 3. Connect to Supabase
The AI backend and the React frontend both need to talk to a centralized database to log traffic violations and read intersection states. 
1. Create a new project in your [Supabase Dashboard](https://supabase.com/dashboard/projects).
2. Go to **Project Settings -> API** to find your `Project URL` and `service_role` secret key.
3. In your project folder, create a copy of the hidden environment file:
   ```bash
   cp .env.example .env
   ```
4. Open the `.env` file in a text editor and paste your Supabase URL and Key inside.

### 4. Initialize the Database Tables
Your new Supabase project is completely empty. We need to create the tables (like `violations`, `e_challans`, etc.) so the AI has a place to save data.
1. In your Supabase Dashboard, click on **SQL Editor** on the left menu.
2. On your computer, open the `database/` folder in this repository.
3. Copy the text from inside these files and run them in the Supabase SQL Editor **in this exact order**:
   - `00_master_schema.sql` *(Creates all tables and Enums)*
   - `schema.sql` *(Creates functions for the AI triggers)*
   - `rls_policies.sql` *(Secures the database)*
   - `intersection_status.sql` *(Sets up the Reinforcement Learning tables)*
   - `triggers.sql` *(Automates payments and E-Challan logic)*

### 5. Download the AI Model Weights (Critical)
Because AI model files are massive, they are not stored on GitHub. You **must** download them manually. If you skip this, the backend will crash immediately because it has no "brain" to use.

👉 **[Download all 4 required AI Models from Google Drive here](https://drive.google.com/drive/folders/1WHVeHnA-8CUa1F0rWcdnSnSyWjpA_pYj?usp=sharing)**

Once downloaded, place the files exactly as follows:
- Put **`best.pt`** and **`yolov8n.pt`** inside the `app/models/` folder.
- Put **`vitals_ppo_model.zip`** and **`vitals_ppo_vecnorm.pkl`** in the main root folder of the project.

---

## 💻 Running the System

Now that the database and AI models are ready, it's time to boot the system! You will need **two separate terminals** open: one for the Backend, and one for the Frontend.

### Step 1: Start the Backend (FastAPI + AI Engine)
The backend is the engine of the project. It runs the YOLOv8 object detection, calculates traffic congestion, makes Reinforcement Learning decisions, and sends data to Supabase.

**1. Create an Isolated Python Environment**
It is highly recommended to create a "Virtual Environment". This acts as a sandbox, ensuring the AI packages we are about to install don't interfere with other Python projects on your PC.
```bash
# If you are on Windows:
python -m venv venv
venv\Scripts\activate

# If you are on Mac/Linux:
python3 -m venv venv
source venv/bin/activate
```
*(You should now see `(venv)` at the start of your terminal line).*

**2. Install the Required Python Packages**
We need to install libraries like OpenCV, EasyOCR, FastAPI, and PyTorch. 

* **Option A: 🟢 I have an NVIDIA GPU (Recommended)**
  First, go to the [PyTorch Get Started Guide](https://pytorch.org/get-started/locally/) and install the specific CUDA version of `torch` and `torchvision` for your computer. Then, run the command below.
* **Option B: 🔵 I am on a Mac or CPU-Only PC**
  Simply run the command below. PyTorch will automatically install the CPU-only version.

```bash
pip install -r requirements.txt
```

**3. Boot the Server**
Once everything is installed, start the FastAPI server using `uvicorn`:
```bash
python -m uvicorn app.main:app --reload
```
*What happens now?* You will see logs in your terminal indicating that the AI models are loading into memory (it will tell you if it's using CUDA or CPU). The backend will then automatically start processing the camera feeds and updating your Supabase database in real-time.

### Step 2: Start the Officer Web Dashboard (React)
While the backend is running in your first terminal, open a **new** terminal window to start the user interface.

The frontend is built with React and Vite. It provides a beautiful dashboard for traffic officers to view live AI camera feeds, manage E-Challans, and see intersection stats.

**1. Navigate to the Frontend Folder**
```bash
cd frontend-v2
```

**2. Install Node Packages**
This downloads all the React dependencies (like TailwindCSS, Recharts, and Mapbox) into a `node_modules` folder.
```bash
npm install
```

**3. Boot the React App**
```bash
npm run dev
```
*What happens now?* Vite will start a local web server. Open your internet browser and go to the link provided in the terminal (usually **`http://localhost:5173`**). 

Congratulations! The entire V.I.T.A.L.S. ecosystem is now running on your machine.


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
