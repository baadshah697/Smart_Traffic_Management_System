-- ==============================================================================
-- V.I.T.A.L.S. MASTER SCHEMA INITIALIZATION (TABLES ONLY)
-- Run this script first in your Supabase SQL Editor to create the base tables.
-- ==============================================================================

-- 1. Create necessary ENUM types (Required for the tables below)
CREATE TYPE public.user_role AS ENUM ('citizen', 'admin', 'officer');
CREATE TYPE public.violation_status AS ENUM ('pending', 'verified', 'rejected', 'paid');

-- 2. Base Tables
create table public.users (
  id uuid not null default extensions.uuid_generate_v4 (),
  email text not null,
  password text not null,
  created_at timestamp with time zone null default now(),
  phone text null,
  constraint users_pkey primary key (id),
  constraint users_email_key unique (email)
) TABLESPACE pg_default;

create table public.user_roles (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  role public.user_role null default 'citizen'::user_role,
  assigned_at timestamp with time zone null default now(),
  badge_number text null,
  constraint user_roles_pkey primary key (id),
  constraint user_roles_badge_number_key unique (badge_number),
  constraint user_roles_user_id_key unique (user_id),
  constraint user_roles_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.accidents (
  id uuid not null default gen_random_uuid (),
  description text null,
  reported_by uuid null,
  injuries integer null default 0,
  fatalities integer null default 0,
  reported_at timestamp with time zone null default now(),
  severity text null default 'Minor'::text,
  latitude double precision null,
  longitude double precision null,
  constraint accidents_pkey primary key (id),
  constraint accidents_reported_by_fkey foreign KEY (reported_by) references users (id) on delete set null
) TABLESPACE pg_default;

create table public.audit_logs (
  id uuid not null default gen_random_uuid (),
  changed_by uuid null,
  action_type text not null,
  table_name text not null,
  record_id uuid null,
  payload jsonb null,
  created_at timestamp with time zone null default now(),
  constraint audit_logs_pkey primary key (id),
  constraint audit_logs_user_id_fkey foreign KEY (changed_by) references users (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_audit_logs_user_id on public.audit_logs using btree (changed_by) TABLESPACE pg_default;
create index IF not exists idx_audit_logs_table_record on public.audit_logs using btree (table_name, record_id) TABLESPACE pg_default;

create table public.congested_roads (
  id uuid not null default gen_random_uuid (),
  road_name text not null,
  area text null,
  congestion_level integer null,
  is_closed boolean null default false,
  camera_id text null,
  current_state text null default 'red'::text,
  vehicle_count integer null default 0,
  recommended_time integer null default 30,
  is_emergency boolean null default false,
  last_updated timestamp with time zone null default now(),
  constraint congested_roads_pkey primary key (id),
  constraint signal_state_check check (
    (
      current_state = any (array['red'::text, 'yellow'::text, 'green'::text])
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_congested_roads_name on public.congested_roads using btree (road_name) TABLESPACE pg_default;

create table public.intersection_status (
  id uuid not null default gen_random_uuid (),
  intersection_name text not null default 'Main Intersection'::text,
  lane_direction text not null,
  camera_id text null,
  signal_state text null default 'red'::text,
  green_duration integer null default 30,
  vehicle_count integer null default 0,
  is_emergency boolean null default false,
  active_corridor boolean null default false,
  last_synced timestamp with time zone null default now(),
  constraint intersection_status_pkey primary key (id)
) TABLESPACE pg_default;

create unique INDEX IF not exists idx_intersection_lane on public.intersection_status using btree (intersection_name, lane_direction) TABLESPACE pg_default;

create table public.parking_lots (
  id uuid not null default gen_random_uuid (),
  name text not null,
  location text null,
  total_slots integer null,
  occupied integer null,
  updated_at timestamp with time zone null default now(),
  latitude double precision null,
  longitude double precision null,
  constraint parking_lots_pkey primary key (id)
) TABLESPACE pg_default;

create table public.parking_requests (
  id uuid not null default gen_random_uuid (),
  parking_lot_id uuid null,
  vehicle_number text null,
  reason text null,
  estimated_duration integer null default 60,
  status text null default 'pending'::text,
  created_at timestamp with time zone null default now(),
  approved_by uuid null,
  constraint parking_requests_pkey primary key (id),
  constraint parking_requests_approved_by_fkey foreign KEY (approved_by) references users (id),
  constraint parking_requests_parking_lot_id_fkey foreign KEY (parking_lot_id) references parking_lots (id)
) TABLESPACE pg_default;

create table public.ptu_settings (
  key text not null,
  value numeric not null,
  updated_at timestamp with time zone null default now(),
  constraint ptu_settings_pkey primary key (key)
) TABLESPACE pg_default;

create table public.surveillance_cameras (
  id text not null default gen_random_uuid (),
  location_name text not null,
  ip_address text null,
  is_active boolean null default true,
  created_at timestamp with time zone null default now(),
  latitude double precision null,
  longitude double precision null,
  managed_by uuid null,
  officer_id uuid null,
  api_key text null default gen_random_uuid (),
  direction text null,
  constraint surveillance_cameras_pkey primary key (id),
  constraint surveillance_cameras_managed_by_fkey foreign KEY (managed_by) references users (id) on delete set null,
  constraint surveillance_cameras_officer_id_fkey foreign KEY (officer_id) references user_roles (id)
) TABLESPACE pg_default;

create table public.system_configs (
  key text not null,
  value jsonb not null,
  updated_at timestamp with time zone null default now(),
  constraint system_configs_pkey primary key (key)
) TABLESPACE pg_default;

create table public.traffic_signals (
  id uuid not null default gen_random_uuid (),
  camera_id text null,
  current_state text null default 'red'::text,
  vehicle_count integer null default 0,
  recommended_time integer null default 30,
  is_emergency boolean null default false,
  last_updated timestamp with time zone null default now(),
  constraint traffic_signals_pkey primary key (id),
  constraint traffic_signals_camera_id_fkey foreign KEY (camera_id) references surveillance_cameras (id) on delete CASCADE,
  constraint signal_state_check check (
    (
      current_state = any (array['red'::text, 'yellow'::text, 'green'::text])
    )
  )
) TABLESPACE pg_default;

create table public.violations (
  id uuid not null default gen_random_uuid (),
  plate_number text null,
  violation_type text not null,
  evidence_image_url text not null,
  confidence_score double precision null,
  status text null default 'pending'::violation_status,
  detected_at timestamp with time zone null default now(),
  camera_id text null,
  location text null default 'Bhopal City'::text,
  severity text null default 'medium'::text,
  source text null default 'live_camera'::text,
  constraint violations_pkey primary key (id),
  constraint fk_violation_camera foreign KEY (camera_id) references surveillance_cameras (id)
) TABLESPACE pg_default;

create index IF not exists idx_violations_camera_id on public.violations using btree (camera_id) TABLESPACE pg_default;
create index IF not exists idx_violations_status on public.violations using btree (status) TABLESPACE pg_default;
create index IF not exists idx_violations_plate_number on public.violations using btree (plate_number) TABLESPACE pg_default;

create table public.e_challans (
  id uuid not null default gen_random_uuid (),
  violation_id uuid null,
  vehicle_number text null,
  amount numeric(10, 2) not null,
  status text null default 'unpaid'::text,
  owner_name text null,
  issued_at timestamp with time zone null default now(),
  owner_id uuid null,
  due_date timestamp with time zone null,
  paid_at timestamp with time zone null,
  issued_by text null,
  location text null default 'Unknown'::text,
  is_strategic boolean null default false,
  phone_number text null,
  constraint e_challans_pkey primary key (id),
  constraint e_challans_owner_id_fkey foreign KEY (owner_id) references users (id) on delete set null,
  constraint e_challans_violation_id_fkey foreign KEY (violation_id) references violations (id) on delete CASCADE,
  constraint e_challans_status_check check (
    (
      status = any (
        array['unpaid'::text, 'paid'::text, 'disputed'::text]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_e_challans_issued_by on public.e_challans using btree (issued_by) TABLESPACE pg_default;
create index IF not exists idx_e_challans_owner_id on public.e_challans using btree (owner_id) TABLESPACE pg_default;
create index IF not exists idx_e_challans_vehicle_number on public.e_challans using btree (vehicle_number) TABLESPACE pg_default;
create index IF not exists idx_e_challans_status on public.e_challans using btree (status) TABLESPACE pg_default;

create table public.payments (
  id uuid not null default gen_random_uuid (),
  challan_id uuid null,
  amount numeric(10, 2) not null,
  payment_method text null default 'UPI'::text,
  transaction_id text not null,
  status text null default 'success'::text,
  paid_at timestamp with time zone null default now(),
  constraint payments_pkey primary key (id),
  constraint payments_transaction_id_key unique (transaction_id),
  constraint payments_challan_id_fkey foreign KEY (challan_id) references e_challans (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_payments_challan_id on public.payments using btree (challan_id) TABLESPACE pg_default;

create table public.vehicles (
  id uuid not null default gen_random_uuid (),
  plate_number text not null,
  type text null,
  model text null,
  owner_name text null default 'Unknown Owner'::text,
  created_at timestamp with time zone null default now(),
  owner_id uuid null,
  phone text null,
  vehicle_color text null,
  constraint vehicles_pkey primary key (id),
  constraint vehicles_plate_number_key unique (plate_number),
  constraint vehicles_owner_id_fkey foreign KEY (owner_id) references users (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_vehicles_owner_id on public.vehicles using btree (owner_id) TABLESPACE pg_default;
