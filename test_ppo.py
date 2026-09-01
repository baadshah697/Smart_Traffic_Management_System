"""Test the retrained PPO model with VecNormalize observation normalization."""
import numpy as np
import pickle
import os
from stable_baselines3 import PPO

model_path = "vitals_ppo_model.zip"
norm_path = "vitals_ppo_vecnorm.pkl"

print(f"Loading {model_path}...")
model = PPO.load(model_path, device="cpu")

# Load VecNormalize stats
obs_mean = None
obs_var = None
if os.path.exists(norm_path):
    with open(norm_path, "rb") as f:
        norm_data = pickle.load(f)
    if hasattr(norm_data, 'obs_rms'):
        obs_mean = norm_data.obs_rms.mean.astype(np.float32)
        obs_var = norm_data.obs_rms.var.astype(np.float32)
        print(f"Loaded VecNormalize stats (mean={obs_mean[:4].round(2)}, var={obs_var[:4].round(2)})")
    else:
        print("WARNING: No obs_rms in VecNormalize pickle")
else:
    print("WARNING: No VecNormalize stats file found")

def predict_with_norm(obs_raw):
    if obs_mean is not None and obs_var is not None:
        obs = np.clip((obs_raw - obs_mean) / np.sqrt(obs_var + 1e-8), -10.0, 10.0)
    else:
        obs = obs_raw
    action, _ = model.predict(obs, deterministic=True)
    return int(action)

DIR_NAMES = ["N", "E", "S", "W"]
print("\n--- Testing PPO Predictions ---")

# Test 1: N has highest queue, currently on N
state1 = np.array([1.0, 0.0, 0.0, 0.0,  0,0,0,0,  1,0,0,0,  1.0], dtype=np.float32)
pred1 = predict_with_norm(state1)
status1 = "PASS" if pred1 == 0 else "FAIL"
print(f"Test 1 (N=50, others=0, phase=N): action={pred1} ({DIR_NAMES[pred1]}) Expected=0(N) [{status1}]")

# Test 2: W has highest queue, currently on N
state2 = np.array([0.0, 0.0, 0.0, 1.0,  0,0,0,0,  1,0,0,0,  1.0], dtype=np.float32)
pred2 = predict_with_norm(state2)
status2 = "PASS" if pred2 == 3 else "FAIL"
print(f"Test 2 (W=50, others=0, phase=N): action={pred2} ({DIR_NAMES[pred2]}) Expected=3(W) [{status2}]")

# Test 3: S has highest queue, currently on N
state3 = np.array([0.0, 0.0, 1.0, 0.0,  0,0,0,0,  1,0,0,0,  1.0], dtype=np.float32)
pred3 = predict_with_norm(state3)
status3 = "PASS" if pred3 == 2 else "FAIL"
print(f"Test 3 (S=50, others=0, phase=N): action={pred3} ({DIR_NAMES[pred3]}) Expected=2(S) [{status3}]")

# Test 4: Mixed queues
state4 = np.array([0.1, 0.8, 0.2, 0.6,  0,0,0,0,  0,0,1,0,  0.5], dtype=np.float32)
pred4 = predict_with_norm(state4)
status4 = "PASS" if pred4 == 1 else "FAIL"
print(f"Test 4 (E=40 highest, phase=S): action={pred4} ({DIR_NAMES[pred4]}) Expected=1(E) [{status4}]")

# Test 5: All equal
state5 = np.array([0.5, 0.5, 0.5, 0.5,  0,0,0,0,  0,1,0,0,  0.8], dtype=np.float32)
pred5 = predict_with_norm(state5)
print(f"Test 5 (All equal=25, phase=E): action={pred5} ({DIR_NAMES[pred5]}) [INFO - any is ok]")

passed = sum(1 for s in [status1, status2, status3, status4] if s == "PASS")
print(f"\n--- Results: {passed}/4 core tests passed ---")
