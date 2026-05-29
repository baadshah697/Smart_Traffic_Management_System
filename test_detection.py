"""
Test script: Run both models on a single frame and show exactly what's happening.
Usage: python test_detection.py <image_path>
"""
import cv2
import sys
import os
from ultralytics import YOLO

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "app", "models")

m1 = YOLO(os.path.join(MODELS_DIR, "yolov8n.pt"))
m2 = YOLO(os.path.join(MODELS_DIR, "best.pt"))

# Grab live frame if no image provided
if len(sys.argv) > 1:
    frame = cv2.imread(sys.argv[1])
    if frame is None:
        print(f"Cannot read: {sys.argv[1]}")
        sys.exit(1)
else:
    # Try to grab from MJPEG stream
    import requests, numpy as np
    try:
        r = requests.get('http://127.0.0.1:8000/cameras/live/6e6d7204-290d-4540-bbdd-c89b95067b99', stream=True, timeout=5)
        buf = b''
        for chunk in r.iter_content(chunk_size=4096):
            buf += chunk
            a = buf.find(b'\xff\xd8')
            b = buf.find(b'\xff\xd9')
            if a != -1 and b != -1:
                frame = cv2.imdecode(np.frombuffer(buf[a:b+2], dtype=np.uint8), cv2.IMREAD_COLOR)
                break
    except:
        cap = cv2.VideoCapture(0)
        _, frame = cap.read()
        cap.release()

h, w = frame.shape[:2]
print(f"Frame: {w}x{h}")
print("="*60)

# Model 1
print("\n--- MODEL 1 (yolov8n) conf=0.25 ---")
r1 = m1(frame, verbose=False, conf=0.25, imgsz=640)
m1_motos = []
m1_persons = []
for b in r1[0].boxes:
    cls = int(b.cls[0])
    name = m1.names[cls]
    conf = float(b.conf[0])
    box = list(map(int, b.xyxy[0]))
    print(f"  {name} conf={conf:.2f} box={box}")
    if cls == 3: m1_motos.append(box)
    if cls == 0: m1_persons.append(box)

# Model 2
print("\n--- MODEL 2 (best.pt) conf=0.20 ---")
r2 = m2(frame, verbose=False, conf=0.20, imgsz=640)
m2_persons = []
m2_helmets = []
m2_plates = []
m2_motos = []
for b in r2[0].boxes:
    cls = int(b.cls[0])
    name = m2.names[cls]
    conf = float(b.conf[0])
    box = list(map(int, b.xyxy[0]))
    print(f"  {name} conf={conf:.2f} box={box}")
    if cls == 3: m2_persons.append(box)
    if cls == 0: m2_helmets.append(box)
    if cls == 1: m2_plates.append(box)
    if cls == 2: m2_motos.append(box)

# Fusion analysis
print("\n" + "="*60)
print("FUSION ANALYSIS:")
print(f"  M1 motorcycles: {len(m1_motos)}")
print(f"  M2 motorcycles: {len(m2_motos)}")
print(f"  M1 persons: {len(m1_persons)}")
print(f"  M2 persons: {len(m2_persons)}")
print(f"  M2 helmets: {len(m2_helmets)}")
print(f"  M2 plates: {len(m2_plates)}")

all_bikes = len(m1_motos) + len(m2_motos)
if all_bikes == 0:
    print("\n  ✅ No motorcycles → No enforcement checks needed")
else:
    print(f"\n  🏍️ {all_bikes} motorcycle(s) found → Running violation checks")

# Draw annotated output
vis = frame.copy()
for box in m1_motos:
    cv2.rectangle(vis, (box[0],box[1]), (box[2],box[3]), (0,255,0), 2)
    cv2.putText(vis, "M1:motorcycle", (box[0],box[1]-5), 0, 0.5, (0,255,0), 2)
for box in m1_persons:
    cv2.rectangle(vis, (box[0],box[1]), (box[2],box[3]), (0,200,0), 1)
    cv2.putText(vis, "M1:person", (box[0],box[1]-5), 0, 0.4, (0,200,0), 1)
for box in m2_motos:
    cv2.rectangle(vis, (box[0],box[1]), (box[2],box[3]), (255,120,0), 2)
    cv2.putText(vis, "M2:motorcycle", (box[0],box[1]-5), 0, 0.5, (255,120,0), 2)
for box in m2_persons:
    cv2.rectangle(vis, (box[0],box[1]), (box[2],box[3]), (0,0,255), 2)
    cv2.putText(vis, "M2:person", (box[0],box[1]-5), 0, 0.5, (0,0,255), 2)
for box in m2_helmets:
    cv2.rectangle(vis, (box[0],box[1]), (box[2],box[3]), (0,255,255), 2)
    cv2.putText(vis, "M2:helmet", (box[0],box[1]-5), 0, 0.5, (0,255,255), 2)
for box in m2_plates:
    cv2.rectangle(vis, (box[0],box[1]), (box[2],box[3]), (255,0,255), 2)
    cv2.putText(vis, "M2:plate", (box[0],box[1]-5), 0, 0.5, (255,0,255), 2)

out_path = os.path.join(BASE_DIR, "test_detection_output.jpg")
cv2.imwrite(out_path, vis)
print(f"\n📸 Annotated output saved: {out_path}")
