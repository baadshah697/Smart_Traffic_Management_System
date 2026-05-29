import base64
import zlib
import urllib.request
import os

def generate_kroki_url(diagram_type, diagram_text, output_format="png"):
    compressed = zlib.compress(diagram_text.encode('utf-8'), 9)
    encoded = base64.urlsafe_b64encode(compressed).decode('ascii')
    return f"https://kroki.io/{diagram_type}/{output_format}/{encoded}"

er_diagram = """
erDiagram
    USERS ||--o{ USER_ROLES : has
    USERS ||--o{ VEHICLES : owns
    USERS ||--o{ E_CHALLANS : receives
    USERS ||--o{ PARKING_REQUESTS : approves

    SURVEILLANCE_CAMERAS ||--o{ VIOLATIONS : detects
    SURVEILLANCE_CAMERAS ||--o| CONGESTED_ROADS : monitors
    SURVEILLANCE_CAMERAS ||--o{ INTERSECTION_STATUS : feeds
    SURVEILLANCE_CAMERAS ||--o{ ACCIDENTS : records

    VEHICLES ||--o{ VIOLATIONS : commits
    VEHICLES ||--o{ PARKING_REQUESTS : requests

    VIOLATIONS ||--o| E_CHALLANS : generates

    E_CHALLANS ||--o{ PAYMENTS : paid_via

    PARKING_LOTS ||--o{ PARKING_REQUESTS : receives

    USERS {
        uuid id PK
        string email
        string password
        string phone
        timestamp created_at
    }

    USER_ROLES {
        uuid id PK
        uuid user_id FK
        string role "e.g., admin, officer"
        timestamp created_at
    }

    VEHICLES {
        uuid id PK
        string plate_number UK
        string owner_name
        uuid owner_id FK "Optional link to Users"
        string phone
        string model
        string vehicle_color
        timestamp created_at
    }

    SURVEILLANCE_CAMERAS {
        uuid id PK
        string location_name
        string ip_address
        boolean is_active
        float latitude
        float longitude
        string direction "N, E, S, W"
        timestamp created_at
    }

    VIOLATIONS {
        uuid id PK
        uuid camera_id FK
        string violation_type "Triple Riding, No Helmet, Red Light Jump"
        string evidence_image_url
        float confidence_score
        string plate_number FK "Matches VEHICLES.plate_number"
        string status "pending, processed"
        timestamp detected_at
    }

    E_CHALLANS {
        uuid id PK
        uuid violation_id FK
        string vehicle_number
        int amount "Fine amount"
        string status "unpaid, paid"
        string owner_name
        uuid owner_id FK
        string phone_number
        timestamp issued_at
        timestamp due_date
        timestamp paid_at
    }

    PAYMENTS {
        uuid id PK
        uuid challan_id FK
        int amount
        string payment_method
        string transaction_id
        string status "success, failed"
        timestamp paid_at
    }

    PARKING_LOTS {
        uuid id PK
        string name
        string location
        int total_slots
        int occupied
        timestamp created_at
    }

    PARKING_REQUESTS {
        uuid id PK
        uuid parking_lot_id FK
        string vehicle_number
        string reason
        int estimated_duration
        string status "pending, approved, rejected"
        uuid approved_by FK "Links to USERS (officer)"
        timestamp created_at
    }

    CONGESTED_ROADS {
        uuid id PK
        uuid camera_id FK
        string road_name
        string area
        int congestion_level "0-100 density"
        int vehicle_count
        string current_state "red, green"
        int recommended_time
        boolean is_emergency
        boolean is_closed
        string danger_level "WSI Analytics"
        float wsi_score
        timestamp last_updated
    }

    INTERSECTION_STATUS {
        uuid id PK
        string intersection_name
        string lane_direction "N, E, S, W"
        uuid camera_id FK
        string signal_state "red, green"
        int green_duration
        int vehicle_count
        boolean is_emergency
        boolean active_corridor
        timestamp last_synced
    }

    ACCIDENTS {
        uuid id PK
        uuid camera_id FK
        int fatalities
        string description
        timestamp recorded_at
    }
"""

use_case_diagram = """
flowchart LR
    %% Actors
    Citizen["👤 Citizen / Driver"]
    Officer["👮 Traffic Officer"]
    Admin["👨‍💻 System Admin"]
    AIEngine["🤖 AI Vision Engine"]
    PPOAgent["🚦 RL Traffic Controller"]

    %% Citizen Subsystem
    subgraph CitizenPortal ["Citizen Portal (System Boundary)"]
        direction TB
        UC1(["Lookup E-Challan"])
        UC2(["Pay Traffic Fine"])
        UC3(["Register Vehicle"])
        UC4(["Apply for Parking Pass"])
        UC5(["Receive WhatsApp Alerts"])
    end

    %% Officer Subsystem
    subgraph OfficerDashboard ["Officer Dashboard (System Boundary)"]
        direction TB
        UC6(["View Live Surveillance"])
        UC7(["Review & Manage Challans"])
        UC8(["Approve/Reject Parking"])
        UC9(["View Live Bhopal Map"])
        UC10(["View Accident Reports"])
    end

    %% Admin Subsystem
    subgraph AdminDashboard ["Admin Command Center (System Boundary)"]
        direction TB
        UC11(["Manage Personnel"])
        UC12(["View System Health (CPU/RAM)"])
        UC13(["View Oracle Analytics"])
        UC14(["Configure Global Settings"])
    end

    %% AI Subsystem
    subgraph AIEngineSystem ["AI & Automation (System Boundary)"]
        direction TB
        UC15(["Detect Traffic Violations"])
        UC16(["Perform Plate OCR"])
        UC17(["Identify Emergency Vehicles"])
        UC18(["Optimize Traffic Signals"])
        UC19(["Update Congestion Levels"])
    end

    %% Citizen Interactions
    Citizen --- UC1
    Citizen --- UC2
    Citizen --- UC3
    Citizen --- UC4
    Citizen --- UC5

    %% Officer Interactions
    Officer --- UC6
    Officer --- UC7
    Officer --- UC8
    Officer --- UC9
    Officer --- UC10

    %% Admin Interactions
    Admin --- UC11
    Admin --- UC12
    Admin --- UC13
    Admin --- UC14
    Admin --- UC9

    %% AI Engine Interactions
    AIEngine --- UC15
    AIEngine --- UC16
    AIEngine --- UC17
    AIEngine --- UC19

    %% PPO Agent Interactions
    PPOAgent --- UC18
    PPOAgent --- UC17

    %% Includes/Extends Connections
    UC15 -. "<<includes>>" .-> UC16
    UC2 -. "<<includes>>" .-> UC5

    %% Styling to make it look like a Use Case Diagram
    classDef actor fill:#f8fafc,stroke:#334155,stroke-width:2px,color:#0f172a,shape:rect
    classDef usecase fill:#e0f2fe,stroke:#0369a1,stroke-width:2px,color:#0c4a6e,shape:pill
    classDef boundary fill:none,stroke:#cbd5e1,stroke-width:2px,stroke-dasharray: 5 5

    class Citizen,Officer,Admin,AIEngine,PPOAgent actor
    class UC1,UC2,UC3,UC4,UC5,UC6,UC7,UC8,UC9,UC10,UC11,UC12,UC13,UC14,UC15,UC16,UC17,UC18,UC19 usecase
    class CitizenPortal,OfficerDashboard,AdminDashboard,AIEngineSystem boundary
"""

flowchart_diagram = """
flowchart TD
    %% Define Nodes
    Start([Camera Captures Frame])
    DualModel[AI: Dual-Model Processing <br/> YOLOv8n + best.pt]
    DetectViolations{Violations <br/> Detected?}
    
    %% No Violation Path
    CalcCongestion[Calculate Vehicle Density]
    CheckEmergency{Is Ambulance?}
    UpdateRL[Feed Data to RL Traffic Controller]
    UpdateDB_Congestion[Update Congestion DB & UI]
    
    %% Violation Path
    ExtractCrop[Extract Evidence Crop]
    RunOCR[EasyOCR: Extract License Plate]
    ValidPlate{Valid Indian <br/> Plate?}
    MarkUnknown[Mark Plate as 'UNKNOWN']
    
    QueryDB[(Query Vehicle DB)]
    CheckOwner{Owner Found?}
    
    GenChallan[Generate E-Challan & Fine]
    SendAlert[Send WhatsApp Alert to Owner]
    StoreViolation[(Save to Violations DB)]
    
    %% Citizen Action
    CitizenAction([Citizen Logs into Portal])
    Lookup[Search via Plate Number]
    PayFine[Pay Fine Online]
    GenReceipt[Generate PDF Receipt]
    ConfirmAlert[WhatsApp Payment Confirmation]
    End([End Workflow])

    %% Map Relationships
    Start --> DualModel
    DualModel --> DetectViolations
    
    %% Branch: No Violations (Congestion/Telemetry)
    DetectViolations -- No --> CalcCongestion
    CalcCongestion --> CheckEmergency
    CheckEmergency --> UpdateRL
    UpdateRL --> UpdateDB_Congestion
    UpdateDB_Congestion --> End
    
    %% Branch: Violations Found
    DetectViolations -- Yes <br/> (Helmet, Triple, Red) --> ExtractCrop
    ExtractCrop --> RunOCR
    RunOCR --> ValidPlate
    
    ValidPlate -- No --> MarkUnknown
    ValidPlate -- Yes --> QueryDB
    MarkUnknown --> StoreViolation
    
    QueryDB --> CheckOwner
    CheckOwner -- No --> StoreViolation
    CheckOwner -- Yes --> StoreViolation
    
    StoreViolation --> GenChallan
    GenChallan --> CheckOwner
    
    CheckOwner -- Yes (Phone Linked) --> SendAlert
    SendAlert --> CitizenAction
    CheckOwner -- No --> CitizenAction
    
    CitizenAction --> Lookup
    Lookup --> PayFine
    PayFine --> GenReceipt
    PayFine --> ConfirmAlert
    GenReceipt --> End
    ConfirmAlert --> End
    
    %% Styling
    classDef ai fill:#6366f1,stroke:#312e81,stroke-width:2px,color:#fff
    classDef db fill:#0f766e,stroke:#134e4a,stroke-width:2px,color:#fff
    classDef decision fill:#d97706,stroke:#78350f,stroke-width:2px,color:#fff
    classDef user fill:#059669,stroke:#064e3b,stroke-width:2px,color:#fff
    
    class DualModel,RunOCR,ExtractCrop,UpdateRL ai;
    class QueryDB,StoreViolation,UpdateDB_Congestion db;
    class DetectViolations,ValidPlate,CheckOwner,CheckEmergency decision;
    class CitizenAction,Lookup,PayFine user;
"""

diagrams = {
    "VITALS_ER_Diagram.png": ("mermaid", er_diagram),
    "VITALS_Use_Case_Diagram.png": ("mermaid", use_case_diagram),
    "VITALS_Flowchart_Diagram.png": ("mermaid", flowchart_diagram)
}

desktop_path = r"c:\Users\OMEN\Desktop"

for filename, (dtype, text) in diagrams.items():
    url = generate_kroki_url(dtype, text.strip())
    filepath = os.path.join(desktop_path, filename)
    try:
        # Provide a User-Agent to avoid 403 Forbidden
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
            out_file.write(response.read())
        print(f"Successfully downloaded {filename} to your Desktop")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")
        print(f"Failed URL: {url}")
