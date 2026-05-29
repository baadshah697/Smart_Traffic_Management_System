import torch
from stable_baselines3 import PPO
import numpy as np

model_path = "vitals_ppo_model.zip"
print(f"Loading {model_path}...")
model = PPO.load(model_path)

# state = [q_N, q_E, q_S, q_W, e_N, e_E, e_S, e_W, p_N, p_E, p_S, p_W, t_norm]

# Test 1: N is high
state1 = np.array([1.0, 0.0, 0.0, 0.0, 0,0,0,0, 1,0,0,0, 1.0], dtype=np.float32)
pred1, _ = model.predict(state1, deterministic=True)
print("Test 1 (N high):", pred1)

# Test 2: W is high
state2 = np.array([0.0, 0.0, 0.0, 1.0, 0,0,0,0, 1,0,0,0, 1.0], dtype=np.float32)
pred2, _ = model.predict(state2, deterministic=True)
print("Test 2 (W high):", pred2)

# Test 3: S is high
state3 = np.array([0.0, 0.0, 1.0, 0.0, 0,0,0,0, 1,0,0,0, 1.0], dtype=np.float32)
pred3, _ = model.predict(state3, deterministic=True)
print("Test 3 (S high):", pred3)
