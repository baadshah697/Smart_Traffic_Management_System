"""
═══════════════════════════════════════════════════════════════
  🧠 INTERSECTION CONTROLLER — RL PPO Agent Integration
  AI-Driven Traffic Light Phase Selection via Stable Baselines3.
  
  Features:
  - Deep Q-Learning (PPO) Dynamic Predictor
  - Strict 10-Second Transition Penalization/Locking
  - Absolute Hard-Emergency Override Mechanism
  - Fixed: No lock re-entrancy deadlock
  - Fixed: Writes RL state to congested_roads for UI sync
═══════════════════════════════════════════════════════════════
"""

import os
import threading
import time
import uuid
import numpy as np
from datetime import datetime
from app.database import create_supabase_client
import torch

# Suppress AI Framework logging
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import gymnasium as gym
from gymnasium import spaces
try:
    from stable_baselines3 import PPO
    import warnings
    warnings.filterwarnings("ignore", category=UserWarning, module="stable_baselines3")
    HAS_RL = True
except ImportError:
    HAS_RL = False

# ─── Configuration ───
SYNC_INTERVAL = 1          # Tick rate (seconds)
MIN_GREEN = 10             # Minimum phase lock to prevent flickering
STALE_THRESHOLD = 15       # Data decay (seconds)
MAX_CAPACITY = 50.0        # Assumed max cars in a lane for normalization
MODEL_PATH = "vitals_ppo_model.zip"
NORM_PATH  = "vitals_ppo_vecnorm.pkl"

VALID_DIRECTIONS = ["N", "E", "S", "W"]  # 0->N, 1->E, 2->S, 3->W


class TrafficMockEnv(gym.Env):
    """Minimal Gymnasium environment to bootstrap the PPO architecture when weights are missing."""
    def __init__(self):
        super().__init__()
        # 13D state: [q_N, q_E, q_S, q_W, e_N, e_E, e_S, e_W, p_N, p_E, p_S, p_W, time_norm]
        self.observation_space = spaces.Box(low=0, high=1, shape=(13,), dtype=np.float32)
        self.action_space = spaces.Discrete(4)

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        return np.zeros(13, dtype=np.float32), {}

    def step(self, action):
        return np.zeros(13, dtype=np.float32), 0.0, False, False, {}


class IntersectionController:
    def __init__(self):
        # Threading lock — used only for shared state access, never held across I/O
        self._lock = threading.Lock()

        # Map: camera_id -> cardinal direction
        self._camera_to_direction: dict[str, str] = {}

        # Per-direction lane data from cameras
        self._lane_data: dict[str, dict] = {
            d: {"vehicle_count": 0, "is_emergency": False, "last_update": 0.0}
            for d in VALID_DIRECTIONS
        }

        # Per-direction signal state (what the RL decided)
        self._signal_state: dict[str, dict] = {
            d: {"signal": "red", "green_duration": 0, "vehicle_count": 0,
                "is_emergency": False, "active_corridor": False}
            for d in VALID_DIRECTIONS
        }

        self._running = False
        self._thread = None
        self._db = None

        # Phase tracking (lives on main loop thread, no lock needed)
        self.current_green_idx = 0
        self.time_in_phase = 0
        self.is_emergency_override = False

        # PPO Model + VecNormalize stats
        self.rl_agent = None
        self._obs_mean = None
        self._obs_var = None
        self._announcements = []
        self._initialize_rl_model()

        print("[INTERSECTION] PPO Controller Initialized", flush=True)

    # ─────────────────────────────────────────────────────────
    # INITIALIZATION
    # ─────────────────────────────────────────────────────────
    def _initialize_rl_model(self):
        if not HAS_RL:
            print("[INTERSECTION] stable-baselines3 missing. Using heuristic fallback.", flush=True)
            return

        device_opt = "cuda" if torch.cuda.is_available() else "cpu"

        if os.path.exists(MODEL_PATH):
            print(f"[INTERSECTION] Loading pre-trained PPO from {MODEL_PATH} on {device_opt.upper()}", flush=True)
            self.rl_agent = PPO.load(MODEL_PATH, device=device_opt)

            # Load VecNormalize stats for observation normalization at inference
            if os.path.exists(NORM_PATH):
                import pickle
                with open(NORM_PATH, "rb") as f:
                    norm_data = pickle.load(f)
                # VecNormalize saves obs_rms (RunningMeanStd) which has .mean and .var
                if hasattr(norm_data, 'obs_rms'):
                    self._obs_mean = norm_data.obs_rms.mean.astype(np.float32)
                    self._obs_var = norm_data.obs_rms.var.astype(np.float32)
                    print(f"[INTERSECTION] VecNormalize stats loaded from {NORM_PATH}", flush=True)
                else:
                    print(f"[INTERSECTION] VecNormalize pickle missing obs_rms — using raw obs", flush=True)
            else:
                print(f"[INTERSECTION] No VecNormalize stats found — using raw observations", flush=True)
        else:
            print(f"[INTERSECTION] No weights found. Bootstrapping exploratory PPO on {device_opt.upper()}.", flush=True)
            env = TrafficMockEnv()
            self.rl_agent = PPO("MlpPolicy", env, verbose=0, device=device_opt)

    # ─────────────────────────────────────────────────────────
    # PUBLIC API (thread-safe)
    # ─────────────────────────────────────────────────────────
    def register_lane(self, camera_id: str, direction: str):
        direction = direction.upper().strip()
        if direction not in VALID_DIRECTIONS:
            print(f"[INTERSECTION] Invalid direction '{direction}' for camera {camera_id[:8]}", flush=True)
            return
        with self._lock:
            self._camera_to_direction[camera_id] = direction
        print(f"[INTERSECTION] Camera {camera_id[:8]} → Lane {direction}", flush=True)

    def update_lane(self, camera_id: str, vehicle_count: int, is_emergency: bool):
        """Feed YOLO output into the RL state. Safe to call from any thread."""
        with self._lock:
            direction = self._camera_to_direction.get(camera_id)
            if not direction:
                return
            self._lane_data[direction] = {
                "vehicle_count": max(0, int(vehicle_count)),
                "is_emergency": bool(is_emergency),
                "last_update": time.time()
            }

    def get_status(self) -> dict:
        """Returns a snapshot of the current RL signal state for all 4 lanes."""
        with self._lock:
            res = {}
            for d in VALID_DIRECTIONS:
                cam_id = None
                for cid, cdir in self._camera_to_direction.items():
                    if cdir == d:
                        cam_id = cid
                        break
                res[d] = {
                    **self._signal_state[d],
                    "direction": d,
                    "camera_id": cam_id,
                }
            return res

    def get_announcements(self) -> list:
        """Returns the list of recent traffic announcements."""
        with self._lock:
            return list(self._announcements)

    # ─────────────────────────────────────────────────────────
    # BACKGROUND RL CYCLE
    # ─────────────────────────────────────────────────────────
    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="RL-Controller")
        self._thread.start()

    def stop(self):
        self._running = False

    def _get_db(self):
        if self._db is None:
            self._db = create_supabase_client()
        return self._db

    def _run_loop(self):
        # Short delay so Server + Simulator can register cameras first
        time.sleep(5)
        print("[INTERSECTION] PPO Neural Network is now predicting every 1s", flush=True)
        tick_count = 0
        while self._running:
            try:
                self._rl_cycle(tick_count)
            except Exception as e:
                print(f"[INTERSECTION] RL Cycle Error: {e}", flush=True)
            time.sleep(SYNC_INTERVAL)
            tick_count += 1

    def _rl_cycle(self, tick_count: int):
        now = time.time()
        previous_green_idx = self.current_green_idx
        previous_emergency = self.is_emergency_override

        # --- Safely snapshot the current lane state ---
        with self._lock:
            lanes = {d: dict(v) for d, v in self._lane_data.items()}
            camera_to_dir = dict(self._camera_to_direction)

        self.time_in_phase += 1

        # ── STEP 1: Hard Emergency Override ──────────────────
        emergency_idx = None
        for i, d in enumerate(VALID_DIRECTIONS):
            data_age = now - lanes[d]["last_update"]
            if lanes[d]["is_emergency"] and data_age < STALE_THRESHOLD:
                emergency_idx = i
                break

        target_phase = self.current_green_idx

        if emergency_idx is not None:
            if not self.is_emergency_override or self.current_green_idx != emergency_idx:
                print(f"[RL-OVERRIDE] AMBULANCE → Forcing Green on {VALID_DIRECTIONS[emergency_idx]}", flush=True)
                target_phase = emergency_idx
                self.is_emergency_override = True
                self.time_in_phase = 0
            # Lock the timer during emergency so it doesn't auto-switch
        else:
            self.is_emergency_override = False

            # ── STEP 2: Phase Prediction Inference (only after MIN_GREEN ticks) ──
            if self.time_in_phase >= MIN_GREEN:
                active_q = lanes[VALID_DIRECTIONS[self.current_green_idx]]["vehicle_count"]

                # ── STEP 2a: PPO Neural Network Prediction ──
                if self.rl_agent is not None:
                    try:
                        # Build 13D observation: [q_N, q_E, q_S, q_W, e_N..e_W, p_N..p_W, t_norm]
                        queues = np.array([
                            lanes[d]["vehicle_count"] / MAX_CAPACITY
                            for d in VALID_DIRECTIONS
                        ], dtype=np.float32).clip(0, 1)

                        emergencies = np.array([
                            1.0 if (lanes[d]["is_emergency"] and now - lanes[d]["last_update"] < STALE_THRESHOLD) else 0.0
                            for d in VALID_DIRECTIONS
                        ], dtype=np.float32)

                        phase_onehot = np.zeros(4, dtype=np.float32)
                        phase_onehot[self.current_green_idx] = 1.0

                        t_norm = np.clip(self.time_in_phase / 60.0, 0, 1).astype(np.float32)

                        obs = np.concatenate([queues, emergencies, phase_onehot, [t_norm]])

                        # Apply VecNormalize if stats are available
                        if self._obs_mean is not None and self._obs_var is not None:
                            obs = np.clip((obs - self._obs_mean) / np.sqrt(self._obs_var + 1e-8), -10.0, 10.0)

                        action, _ = self.rl_agent.predict(obs, deterministic=True)
                        action = int(action)

                        if action != self.current_green_idx:
                            target_phase = action
                            self.time_in_phase = 0
                            print(f"[PPO DECISION] Routing phase to {VALID_DIRECTIONS[target_phase]} "
                                  f"(Queues: N={int(queues[0]*MAX_CAPACITY)} E={int(queues[1]*MAX_CAPACITY)} "
                                  f"S={int(queues[2]*MAX_CAPACITY)} W={int(queues[3]*MAX_CAPACITY)})", flush=True)
                    except Exception as e:
                        print(f"[RL-FALLBACK] PPO predict error: {e}. Using heuristic.", flush=True)
                        self._heuristic_phase_select(lanes, now, active_q)

                # ── STEP 2b: Heuristic Fallback (no RL agent loaded) ──
                else:
                    target_phase = self._heuristic_phase_select(lanes, now, active_q)

        # ── STEP 3: Apply phase decision ──
        # Check if green phase has switched or emergency override activated
        if (self.is_emergency_override and not previous_emergency) or \
           (self.is_emergency_override and target_phase != previous_green_idx):
            direction = VALID_DIRECTIONS[target_phase]
            dir_name = {"N": "North", "E": "East", "S": "South", "W": "West"}.get(direction, direction)
            dir_name_hi = {"N": "उत्तर", "E": "पूर्व", "S": "दक्षिण", "W": "पश्चिम"}.get(direction, direction)
            with self._lock:
                self._announcements.append({
                    "id": str(uuid.uuid4()),
                    "timestamp": now,
                    "type": "ambulance",
                    "direction": direction,
                    "text_en": f"Ambulance on {dir_name} lane so the lane is greened",
                    "text_hi": f"{dir_name_hi} लेन पर एम्बुलेंस है इसलिए लेन को हरा कर दिया गया है"
                })
                if len(self._announcements) > 10:
                    self._announcements.pop(0)
        elif not self.is_emergency_override and target_phase != previous_green_idx:
            direction = VALID_DIRECTIONS[target_phase]
            dir_name = {"N": "North", "E": "East", "S": "South", "W": "West"}.get(direction, direction)
            dir_name_hi = {"N": "उत्तर", "E": "पूर्व", "S": "दक्षिण", "W": "पश्चिम"}.get(direction, direction)
            with self._lock:
                self._announcements.append({
                    "id": str(uuid.uuid4()),
                    "timestamp": now,
                    "type": "congestion",
                    "direction": direction,
                    "text_en": f"Congestion value more on {dir_name} lane so letting it turn green",
                    "text_hi": f"{dir_name_hi} लेन पर ट्रैफ़िक अधिक है इसलिए इसे हरा होने दिया जा रहा है"
                })
                if len(self._announcements) > 10:
                    self._announcements.pop(0)

        self.current_green_idx = target_phase
        active_dir = VALID_DIRECTIONS[self.current_green_idx]

        new_state = {}
        for d in VALID_DIRECTIONS:
            is_active = (d == active_dir)
            new_state[d] = {
                "signal":          "green" if is_active else "red",
                "green_duration":  self.time_in_phase if is_active else 0,
                "vehicle_count":   lanes[d]["vehicle_count"],
                "is_emergency":    self.is_emergency_override and is_active,
                "active_corridor": self.is_emergency_override,
            }

        # Write new state under lock (no I/O inside lock)
        with self._lock:
            self._signal_state = new_state

        # ── STEP 4: Persist to DB every 3 ticks (~3 seconds) ──
        if tick_count % 3 == 0:
            # Build reverse map without lock (we have a local snapshot)
            dir_to_cam = {v: k for k, v in camera_to_dir.items()}
            self._push_to_db(new_state, dir_to_cam)

    def _heuristic_phase_select(self, lanes: dict, now: float, active_q: int) -> int:
        """Greedy queue-length heuristic fallback when PPO is unavailable."""
        highest_q = 0
        highest_idx = self.current_green_idx

        for i, d in enumerate(VALID_DIRECTIONS):
            data_age = now - lanes[d]["last_update"]
            if data_age < STALE_THRESHOLD:
                count = lanes[d]["vehicle_count"]
                if count > highest_q:
                    highest_q = count
                    highest_idx = i

        target = self.current_green_idx
        if highest_idx != self.current_green_idx:
            if active_q == 0 or highest_q > (active_q + 5):
                target = highest_idx
                self.time_in_phase = 0
                print(f"[HEURISTIC] Routing phase to {VALID_DIRECTIONS[target]} (Queue: {highest_q})", flush=True)
        return target

    def _push_to_db(self, state: dict, dir_to_cam: dict):
        """
        Writes RL decisions to both tables:
        - intersection_status  (raw RL telemetry)
        - congested_roads      (what Surveillance.tsx polls)
        No locks held during any I/O.
        """
        try:
            db = self._get_db()
            now_iso = datetime.utcnow().isoformat()

            for direction, data in state.items():
                camera_id = dir_to_cam.get(direction)

                # ── A: Update intersection_status table ──
                rl_row = {
                    "intersection_name": "Main Intersection",
                    "lane_direction":    direction,
                    "camera_id":         camera_id,
                    "signal_state":      data["signal"],
                    "green_duration":    data["green_duration"],
                    "vehicle_count":     data["vehicle_count"],
                    "is_emergency":      data["is_emergency"],
                    "active_corridor":   data["active_corridor"],
                    "last_synced":       now_iso,
                }
                try:
                    existing = db.table("intersection_status").select("id").eq("lane_direction", direction).execute()
                    if existing.data:
                        db.table("intersection_status").update(rl_row).eq("lane_direction", direction).execute()
                    else:
                        db.table("intersection_status").insert(rl_row).execute()
                except Exception:
                    pass

                # ── B: Push signal state to congested_roads (for Surveillance.tsx) ──
                if camera_id:
                    # Recommended green time: active lane gets time_in_phase, others get 0
                    try:
                        db.table("congested_roads").update({
                            "current_state":    data["signal"],
                            "recommended_time": data["green_duration"],
                            "is_emergency":     data["is_emergency"],
                            "last_updated":     now_iso,
                        }).eq("camera_id", camera_id).execute()
                    except Exception:
                        pass

        except Exception as e:
            print(f"[INTERSECTION] DB push error: {e}", flush=True)


# ─── Singleton: instantiate and start the background RL loop ───
intersection_controller = IntersectionController()
intersection_controller.start()
