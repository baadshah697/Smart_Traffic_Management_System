import cv2
import requests
import numpy as np

# -------------------------
# Config
# -------------------------
STREAM_URL = "http://127.0.0.1:8000/cameras/live?camera_id=0"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjMjU2NDg4Yy02OTJkLTQxYzktYmY2My02NzI0MTI5OTc1YTEiLCJyb2xlIjoib2ZmaWNlciIsImV4cCI6MTc3MTUxOTMwOH0.vccEG3DeSXxlcsUo9og3Sfv9iXSM6ZfPMYCUCV-d8Ew"

# -------------------------
# Connect to MJPEG stream
# -------------------------
response = requests.get(STREAM_URL, headers={"Authorization": f"Bearer {TOKEN}"}, stream=True)

if response.status_code != 200:
    print("Failed to connect:", response.status_code, response.text)
    exit()

bytes_data = b""

print("Streaming... Press 'q' to quit")

for chunk in response.iter_content(chunk_size=1024):
    bytes_data += chunk
    a = bytes_data.find(b'\xff\xd8')  # JPEG start
    b = bytes_data.find(b'\xff\xd9')  # JPEG end
    if a != -1 and b != -1:
        jpg = bytes_data[a:b+2]
        bytes_data = bytes_data[b+2:]
        img = cv2.imdecode(np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR)
        if img is not None:
            cv2.imshow("Laptop Camera Feed", img)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

cv2.destroyAllWindows()
