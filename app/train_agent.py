"""
═══════════════════════════════════════════════════════════════
  🤖 TRAIN AGENT — PPO Trainer for V.I.TA.L.S.
  
  Run:  python -m app.train_agent
  
  The trained model (vitals_ppo_model.zip) is automatically
  loaded by intersection_controller.py for live inference.
  
  Traffic Patterns (matching live simulator):
    N  — real laptop camera  (0–20 vehicles, varies)
    S  — moderate steady     (5–15 vehicles)
    E  — light traffic       (1–8 vehicles)
    W  — heavy traffic       (12–25 vehicles)
═══════════════════════════════════════════════════════════════
"""

import os
import random
import numpy as np
import gymnasium as gym
from gymnasium import spaces


class VitalsTrainingEnv(gym.Env):
    """
    Simulated 4-way intersection matching the live simulator patterns.

    State (13D tensor):
        [q_N, q_E, q_S, q_W,       ← queue lengths (0–1 normalised)
         e_N, e_E, e_S, e_W,       ← emergency flags (0 or 1)
         p_N, p_E, p_S, p_W,       ← current phase one-hot
         t_norm]                    ← time in current phase (0–1)

    Actions: 0=N  1=E  2=S  3=W  (which lane gets green)

    Reward:
        -total_queue                         (minimise total waiting)
        -50  if switch faster than MIN_GREEN  (prevent flickering)
        +10  if longest queue gets green      (efficient routing)
    """

    MAX_CAPACITY  = 50.0
    MAX_PHASE_SEC = 60.0
    MIN_GREEN     = 10      # Steps before switching is allowed
    EPISODE_LEN   = 500

    def __init__(self):
        super().__init__()
        self.observation_space = spaces.Box(low=0, high=1, shape=(13,), dtype=np.float32)
        self.action_space      = spaces.Discrete(4)
        self.steps         = 0
        self.queues        = np.zeros(4, dtype=np.float32)
        self.emerg         = np.zeros(4, dtype=np.float32)
        self.current_phase = 0
        self.time_in_phase = 0.0

    # ── Traffic-pattern generators matching live simulator ─────
    @staticmethod
    def _sample_arrivals():
        """Generate realistic per-lane arrival rates."""
        return np.array([
            random.randint(0, 5),    # N — laptop camera, variable
            random.randint(1, 4),    # E — light
            random.randint(2, 8),    # S — moderate
            random.randint(6, 13),   # W — heavy (index 3)
        ], dtype=np.float32)

    # ── Gymnasium interface ────────────────────────────────────
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.steps         = 0
        self.queues        = self._sample_arrivals() * 2  # Start with some backlog
        self.emerg         = np.zeros(4, dtype=np.float32)
        self.current_phase = random.randint(0, 3)
        self.time_in_phase = float(random.randint(0, self.MIN_GREEN))
        return self._get_obs(), {}

    def _get_obs(self):
        q_norm   = np.clip(self.queues / self.MAX_CAPACITY, 0, 1)
        phase_oh = np.zeros(4, dtype=np.float32)
        phase_oh[self.current_phase] = 1.0
        t_norm   = np.clip(self.time_in_phase / self.MAX_PHASE_SEC, 0, 1)
        return np.concatenate([q_norm, self.emerg, phase_oh, [t_norm]]).astype(np.float32)

    def step(self, action: int):
        self.steps += 1
        action = int(action)

        # ── Phase switching logic ──────────────────────────────
        switch_penalty = 0.0
        if action != self.current_phase:
            if self.time_in_phase < self.MIN_GREEN:
                switch_penalty = -50.0  # Penalty for flickering
            self.current_phase = action
            self.time_in_phase = 0.0
        else:
            self.time_in_phase += 1.0

        # ── Vehicle dynamics ───────────────────────────────────
        arrivals = self._sample_arrivals()
        for i in range(4):
            if i == self.current_phase:
                # Green lane: drain faster than it arrives
                drain = random.uniform(3.0, 6.0)
                self.queues[i] = max(0.0, self.queues[i] - drain + arrivals[i] * 0.3)
            else:
                # Red lanes: queue builds up
                self.queues[i] = min(self.MAX_CAPACITY, self.queues[i] + arrivals[i])

        # ── Reward ────────────────────────────────────────────
        total_q  = float(np.sum(self.queues))
        max_q_i  = int(np.argmax(self.queues))
        routing_bonus = 10.0 if action == max_q_i else 0.0  # Reward serving busiest lane

        reward = -total_q * 0.1 + routing_bonus + switch_penalty

        terminated = self.steps >= self.EPISODE_LEN
        return self._get_obs(), reward, terminated, False, {}


# ─────────────────────────────────────────────────────────────
# Training Entry Point
# ─────────────────────────────────────────────────────────────
def main():
    import torch
    import warnings
    from stable_baselines3 import PPO
    from stable_baselines3.common.env_util import make_vec_env
    from stable_baselines3.common.callbacks import EvalCallback, StopTrainingOnRewardThreshold
    warnings.filterwarnings("ignore", category=UserWarning, module="stable_baselines3")

    device_opt = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n{'='*60}")
    print(f"  V.I.TA.L.S. PPO TRAINER")
    print(f"  Device : {device_opt.upper()}")
    print(f"{'='*60}\n")

    # Vectorize environment for faster training (4 parallel envs)
    n_envs = 4
    env = make_vec_env(VitalsTrainingEnv, n_envs=n_envs)

    model_path = "vitals_ppo_model.zip"

    # If an existing model exists, continue training from it
    if os.path.exists(model_path):
        print(f"[TRAIN] Found existing model — continuing training from {model_path}")
        model = PPO.load(model_path, env=env, device=device_opt)
        model.set_env(env)
    else:
        print("[TRAIN] No existing model — training from scratch")
        model = PPO(
            "MlpPolicy",
            env,
            verbose=1,
            device=device_opt,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=64,
            n_epochs=10,
            gamma=0.99,
            gae_lambda=0.95,
            clip_range=0.2,
            tensorboard_log="./tensorboard_logs/",
        )

    TIMESTEPS = 100_000
    print(f"[TRAIN] Training for {TIMESTEPS:,} timesteps across {n_envs} parallel environments...")
    print("[TRAIN] This will take 2-4 minutes on GPU. Watch for mean_reward improvement.\n")

    model.learn(total_timesteps=TIMESTEPS, progress_bar=True)

    model.save(model_path)
    print(f"\n[DONE] Model saved => '{model_path}'")
    print("[DONE] Restart the backend server to load the new weights automatically!")
    print("       The PPO Agent will now serve all 4 lanes (N/E/S/W) intelligently.\n")


if __name__ == "__main__":
    main()
