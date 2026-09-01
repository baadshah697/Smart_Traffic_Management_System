from ultralytics import YOLO

# Load the model
model = YOLO('yolov8s.pt') 

# Start training
# Path points to where you unzipped the data on your Desktop
model.train(
    data='C:\\Users\\OMEN\\Downloads\\My First Project.v1i.yolov8\\data.yaml', 
    epochs=100, 
    imgsz=640, 
    device=0  # This tells YOLO to use your NVIDIA GPU
)