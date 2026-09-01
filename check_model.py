"""Quick verification of the custom model (best.pt) class labels and capabilities."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ultralytics import YOLO

model_path = os.path.join("app", "models", "best.pt")
model = YOLO(model_path)
print("Model loaded:", model_path)
print("Class names:", model.names)
print("Number of classes:", len(model.names))
print("Task:", model.task)
