// ================================================================
// WAREHOUSE COPILOT — TypeScript Types
// ================================================================

export type EmployeeRole = 'operator' | 'picker' | 'packer' | 'validator' | 'sorter' | 'transporter'
export type EmployeeStatus = 'working' | 'break' | 'sick' | 'vacation' | 'off' | 'redeployed'
export type SkillLevel = '1' | '2' | '3' | '4' | '5'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertCategory = 'sla' | 'bottleneck' | 'break' | 'staffing' | 'ops_stale'
export type OrderType = 'due_date' | 'same_day' | 'intraday'

// ---- DATABASE ENTITIES ----

export interface Warehouse {
  id: string
  name: string
  timezone: string
  sla_config: SLAConfig
  created_at: string
}

export interface SLAConfig {
  weekday: { due_date: string; same_day: string; intraday: string }
  saturday: { due_date: string }
  sunday: { due_date: string; intraday: string }
}

export interface Employee {
  id: string
  warehouse_id: string
  employee_code: string
  full_name: string
  primary_role: EmployeeRole
  secondary_role: EmployeeRole | null
  tertiary_role: EmployeeRole | null
  skill_level: SkillLevel
  current_status: EmployeeStatus
  created_at: string
  updated_at: string
  // joined
  productivity?: EmployeeProductivity[]
}

export interface EmployeeProductivity {
  id: string
  employee_id: string
  role: EmployeeRole
  units_per_hour: number
  recorded_date: string
  source: 'manual' | 'import' | 'auto'
}

export interface Shift {
  id: string
  employee_id: string
  warehouse_id: string
  shift_date: string
  start_time: string
  end_time: string
  assigned_role: EmployeeRole
  import_batch_id: string | null
  created_at: string
  employee?: Employee
}

export interface DailyForecast {
  id: string
  warehouse_id: string
  forecast_date: string
  due_date_orders: number
  same_day_orders: number
  intraday_orders: number
  backlog_orders: number
  latest_ops_snapshot_id: string | null
  ops_updated_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface OpsSnapshot {
  id: string
  warehouse_id: string
  recorded_by: string | null
  recorded_at: string
  pending_picking: number
  pending_packing: number
  pending_sorting: number
  backlog_orders: number
  remaining_due_date: number
  remaining_same_day: number
  remaining_intraday: number
  notes: string | null
  is_latest: boolean
}

export interface WorkforceAllocation {
  id: string
  employee_id: string
  warehouse_id: string
  alloc_date: string
  allocated_role: EmployeeRole
  start_time: string
  end_time: string | null
  reason: string | null
  triggered_by: 'manual' | 'algorithm' | 'ai' | 'break'
  employee?: Employee
}

export interface BreakRequest {
  id: string
  employee_id: string
  warehouse_id: string
  requested_at: string
  break_start: string | null
  break_end: string | null
  status: 'pending' | 'approved' | 'denied' | 'active' | 'completed'
  approved_by: string | null
  pressure_risk: number | null
  realloc_triggered: boolean
  employee?: Employee
}

export interface Alert {
  id: string
  warehouse_id: string
  severity: AlertSeverity
  category: AlertCategory
  message: string
  metadata: Record<string, unknown> | null
  acknowledged_at: string | null
  created_at: string
}

export interface AIConversation {
  id: string
  warehouse_id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  context_snapshot: Record<string, unknown> | null
  created_at: string
}

export interface SLASnapshot {
  id: string
  warehouse_id: string
  ops_snapshot_id: string | null
  snapshot_at: string
  order_type: OrderType
  total_orders: number
  remaining_orders: number
  projected_completion: string | null
  sla_risk_score: number
  bottleneck_role: EmployeeRole | null
  pressure_ratio_picker: number | null
  pressure_ratio_packer: number | null
  pressure_ratio_sorter: number | null
  tte_picking_mins: number | null
  tte_packing_mins: number | null
  tte_sorting_mins: number | null
}

// ---- ALGORITHM OUTPUT ----

export interface RoleCapacity {
  role: EmployeeRole
  active_count: number
  effective_capacity_per_hour: number
  queue_depth: number | null
  pressure_ratio: number | null
  tte_minutes: number | null
  required_count: number
  gap: number
  status: 'ok' | 'watch' | 'risk' | 'critical' | 'surplus'
}

export interface ReallocationSuggestion {
  employee: Employee
  from_role: EmployeeRole
  to_role: EmployeeRole
  reason: string
  capacity_gain: number
}

export interface AllocationEngineResult {
  role_capacity: RoleCapacity[]
  suggestions: ReallocationSuggestion[]
  sla_risk: Record<OrderType, number>
  overall_risk: number
  bottleneck_role: EmployeeRole | null
  projected_clears: Record<EmployeeRole, string | null>
  computed_at: string
}

export interface BreakSafetyResult {
  status: 'auto_approve' | 'caution' | 'supervisor_review'
  pressure_after: number
  risk_delta: number
  alternatives: ReallocationSuggestion[]
  message: string
}

// ---- UI STATE ----

export interface RoleConfig {
  label: string
  short: string
  color: string
  bgColor: string
  borderColor: string
  textColor: string
}

export const ROLE_CONFIG: Record<EmployeeRole, RoleConfig> = {
  operator:    { label: 'Operator',    short: 'OP', color: '#00ffa3', bgColor: 'bg-green-dim',  borderColor: 'border-green/30',  textColor: 'text-green' },
  picker:      { label: 'Picker',      short: 'PK', color: '#3b82f6', bgColor: 'bg-blue-dim',   borderColor: 'border-blue/30',   textColor: 'text-blue' },
  packer:      { label: 'Packer',      short: 'PA', color: '#f97316', bgColor: 'bg-orange-dim', borderColor: 'border-orange/30', textColor: 'text-orange' },
  validator:   { label: 'Validator',   short: 'VA', color: '#a78bfa', bgColor: 'bg-purple-300/10', borderColor: 'border-purple-400/30', textColor: 'text-purple-400' },
  sorter:      { label: 'Sorter',      short: 'SO', color: '#eab308', bgColor: 'bg-yellow-dim', borderColor: 'border-yellow/30', textColor: 'text-yellow' },
  transporter: { label: 'Transporter', short: 'TR', color: '#ec4899', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/30', textColor: 'text-pink-400' },
}

export const STATUS_CONFIG: Record<EmployeeStatus, { label: string; color: string; dot: string }> = {
  working:    { label: 'Working',    color: 'text-green',   dot: 'bg-green' },
  break:      { label: 'Break',      color: 'text-yellow',  dot: 'bg-yellow' },
  sick:       { label: 'Sick',       color: 'text-red',     dot: 'bg-red' },
  vacation:   { label: 'Vacation',   color: 'text-blue',    dot: 'bg-blue' },
  off:        { label: 'Off',        color: 'text-muted',   dot: 'bg-muted' },
  redeployed: { label: 'Redeployed', color: 'text-cyan',    dot: 'bg-cyan' },
}

export const SKILL_LABELS: Record<SkillLevel, string> = {
  '1': 'Trainee',
  '2': 'Junior',
  '3': 'Standard',
  '4': 'Senior',
  '5': 'Expert',
}

export const SKILL_MULTIPLIERS: Record<SkillLevel, number> = {
  '1': 0.6,
  '2': 0.8,
  '3': 1.0,
  '4': 1.2,
  '5': 1.5,
}

export const MIN_COVERAGE: Record<EmployeeRole, number> = {
  operator:    1,
  picker:      3,
  packer:      4,
  validator:   1,
  sorter:      1,
  transporter: 2,
}

export const DEFAULT_THROUGHPUT: Record<EmployeeRole, number> = {
  operator:    0,    // not queue-driven
  picker:      120,
  packer:      110,
  validator:   80,
  sorter:      150,
  transporter: 0,    // derived
}
