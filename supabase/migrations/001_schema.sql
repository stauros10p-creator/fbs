-- ================================================================
-- WAREHOUSE COPILOT — DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------
CREATE TYPE employee_role AS ENUM (
  'operator', 'picker', 'packer', 'validator', 'sorter', 'transporter'
);

CREATE TYPE employee_status AS ENUM (
  'working', 'break', 'sick', 'vacation', 'off', 'redeployed'
);

CREATE TYPE skill_level AS ENUM ('1', '2', '3', '4', '5');

CREATE TYPE alert_severity AS ENUM ('info', 'warning', 'critical');

CREATE TYPE alert_category AS ENUM ('sla', 'bottleneck', 'break', 'staffing', 'ops_stale');

CREATE TYPE allocation_trigger AS ENUM ('manual', 'algorithm', 'ai', 'break');

CREATE TYPE order_type AS ENUM ('due_date', 'same_day', 'intraday');

-- ----------------------------------------------------------------
-- WAREHOUSES (tenant table)
-- ----------------------------------------------------------------
CREATE TABLE warehouses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  timezone    TEXT NOT NULL DEFAULT 'Europe/Athens',
  sla_config  JSONB NOT NULL DEFAULT '{
    "weekday": { "due_date": "19:00", "same_day": "13:00", "intraday": "24:00" },
    "saturday": { "due_date": "15:00" },
    "sunday": { "due_date": "17:00", "intraday": "24:00" }
  }',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- EMPLOYEES
-- ----------------------------------------------------------------
CREATE TABLE employees (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  employee_code    TEXT NOT NULL,
  full_name        TEXT NOT NULL,
  primary_role     employee_role NOT NULL,
  secondary_role   employee_role,
  tertiary_role    employee_role,
  skill_level      skill_level NOT NULL DEFAULT '3',
  current_status   employee_status NOT NULL DEFAULT 'off',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, employee_code)
);

-- ----------------------------------------------------------------
-- EMPLOYEE PRODUCTIVITY (units per hour per role)
-- ----------------------------------------------------------------
CREATE TABLE employee_productivity (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role          employee_role NOT NULL,
  units_per_hour DECIMAL(8,2) NOT NULL DEFAULT 100,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'auto')),
  UNIQUE(employee_id, role, recorded_date)
);

-- ----------------------------------------------------------------
-- SHIFTS (weekly schedule)
-- ----------------------------------------------------------------
CREATE TABLE shifts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  shift_date      DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  assigned_role   employee_role NOT NULL,
  import_batch_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, shift_date)
);

CREATE INDEX idx_shifts_date ON shifts(warehouse_id, shift_date);

-- ----------------------------------------------------------------
-- DAILY FORECASTS
-- ----------------------------------------------------------------
CREATE TABLE daily_forecasts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id          UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  forecast_date         DATE NOT NULL,
  due_date_orders       INTEGER NOT NULL DEFAULT 0,
  same_day_orders       INTEGER NOT NULL DEFAULT 0,
  intraday_orders       INTEGER NOT NULL DEFAULT 0,
  backlog_orders        INTEGER NOT NULL DEFAULT 0,
  latest_ops_snapshot_id UUID,
  ops_updated_at        TIMESTAMPTZ,
  created_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(warehouse_id, forecast_date)
);

-- ----------------------------------------------------------------
-- OPS SNAPSHOTS (live workload — the new module)
-- ----------------------------------------------------------------
CREATE TABLE ops_snapshots (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id        UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  recorded_by         UUID,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pending_picking     INTEGER NOT NULL DEFAULT 0 CHECK (pending_picking >= 0),
  pending_packing     INTEGER NOT NULL DEFAULT 0 CHECK (pending_packing >= 0),
  pending_sorting     INTEGER NOT NULL DEFAULT 0 CHECK (pending_sorting >= 0),
  backlog_orders      INTEGER NOT NULL DEFAULT 0 CHECK (backlog_orders >= 0),
  remaining_due_date  INTEGER NOT NULL DEFAULT 0 CHECK (remaining_due_date >= 0),
  remaining_same_day  INTEGER NOT NULL DEFAULT 0 CHECK (remaining_same_day >= 0),
  remaining_intraday  INTEGER NOT NULL DEFAULT 0 CHECK (remaining_intraday >= 0),
  notes               TEXT,
  is_latest           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_ops_snapshots_latest ON ops_snapshots(warehouse_id, is_latest);
CREATE INDEX idx_ops_snapshots_time   ON ops_snapshots(warehouse_id, recorded_at DESC);

-- Function: when a new snapshot is inserted, flip all others is_latest = false
CREATE OR REPLACE FUNCTION flip_ops_snapshot_latest()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ops_snapshots
  SET is_latest = FALSE
  WHERE warehouse_id = NEW.warehouse_id
    AND id <> NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ops_snapshot_latest
  AFTER INSERT ON ops_snapshots
  FOR EACH ROW EXECUTE FUNCTION flip_ops_snapshot_latest();

-- ----------------------------------------------------------------
-- WORKFORCE ALLOCATIONS (real-time assignment log)
-- ----------------------------------------------------------------
CREATE TABLE workforce_allocations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id    UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  warehouse_id   UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  alloc_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  allocated_role employee_role NOT NULL,
  start_time     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time       TIMESTAMPTZ,
  reason         TEXT,
  triggered_by   allocation_trigger NOT NULL DEFAULT 'manual'
);

CREATE INDEX idx_allocations_date ON workforce_allocations(warehouse_id, alloc_date);

-- ----------------------------------------------------------------
-- BREAK REQUESTS
-- ----------------------------------------------------------------
CREATE TABLE break_requests (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  warehouse_id      UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  break_start       TIMESTAMPTZ,
  break_end         TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','denied','active','completed')),
  approved_by       UUID,
  pressure_risk     DECIMAL(4,3),
  realloc_triggered BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_breaks_active ON break_requests(warehouse_id, status);

-- ----------------------------------------------------------------
-- SLA SNAPSHOTS (algorithm output — audit log)
-- ----------------------------------------------------------------
CREATE TABLE sla_snapshots (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id          UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  ops_snapshot_id       UUID REFERENCES ops_snapshots(id),
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_type            order_type NOT NULL,
  total_orders          INTEGER NOT NULL DEFAULT 0,
  remaining_orders      INTEGER NOT NULL DEFAULT 0,
  projected_completion  TIMESTAMPTZ,
  sla_risk_score        DECIMAL(4,3) NOT NULL DEFAULT 0,
  bottleneck_role       employee_role,
  pressure_ratio_picker DECIMAL(6,3),
  pressure_ratio_packer DECIMAL(6,3),
  pressure_ratio_sorter DECIMAL(6,3),
  tte_picking_mins      INTEGER,
  tte_packing_mins      INTEGER,
  tte_sorting_mins      INTEGER
);

CREATE INDEX idx_sla_snapshots_time ON sla_snapshots(warehouse_id, snapshot_at DESC);

-- ----------------------------------------------------------------
-- ALERTS
-- ----------------------------------------------------------------
CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  severity        alert_severity NOT NULL,
  category        alert_category NOT NULL,
  message         TEXT NOT NULL,
  metadata        JSONB,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_unacked ON alerts(warehouse_id, acknowledged_at) WHERE acknowledged_at IS NULL;

-- ----------------------------------------------------------------
-- AI CONVERSATIONS (copilot chat history)
-- ----------------------------------------------------------------
CREATE TABLE ai_conversations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL DEFAULT uuid_generate_v4(),
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  context_snapshot JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conv_session ON ai_conversations(session_id, created_at);

-- ----------------------------------------------------------------
-- SEED: default warehouse
-- ----------------------------------------------------------------
INSERT INTO warehouses (id, name, timezone) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Main Warehouse', 'Europe/Athens');

-- ----------------------------------------------------------------
-- ROW LEVEL SECURITY (basic — enable per table)
-- ----------------------------------------------------------------
ALTER TABLE warehouses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_productivity ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_forecasts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workforce_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_snapshots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations    ENABLE ROW LEVEL SECURITY;

-- For MVP: allow all authenticated users full access (tighten per-tenant in v2)
CREATE POLICY "allow_all_authenticated" ON warehouses         FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON employees          FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON employee_productivity FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON shifts              FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON daily_forecasts     FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON ops_snapshots       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON workforce_allocations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON break_requests      FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON sla_snapshots       FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON alerts              FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "allow_all_authenticated" ON ai_conversations    FOR ALL USING (auth.role() = 'authenticated');
