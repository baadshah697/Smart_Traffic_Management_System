-- ═══════════════════════════════════════════════════════════
-- 4-WAY INTERSECTION SYNC — Database Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. New table: intersection_status (The Brain's output)
CREATE TABLE IF NOT EXISTS intersection_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  intersection_name TEXT NOT NULL DEFAULT 'Main Intersection',
  lane_direction TEXT NOT NULL,                          -- 'N', 'S', 'E', 'W'
  camera_id TEXT,
  signal_state TEXT DEFAULT 'red',                       -- 'green', 'red', 'yellow'
  green_duration INT DEFAULT 30,
  vehicle_count INT DEFAULT 0,
  is_emergency BOOLEAN DEFAULT FALSE,
  active_corridor BOOLEAN DEFAULT FALSE,
  last_synced TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one row per direction per intersection
CREATE UNIQUE INDEX IF NOT EXISTS idx_intersection_lane 
  ON intersection_status (intersection_name, lane_direction);

-- 2. Add 'direction' column to surveillance_cameras
ALTER TABLE surveillance_cameras ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT NULL;

-- 3. Add 'source' column to violations table
ALTER TABLE violations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'live_camera';
