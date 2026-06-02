export type EmployeeRole = 'operator' | 'picker' | 'packer' | 'validator' | 'sorter' | 'transporter'
export type EmployeeStatus = 'working' | 'break' | 'sick' | 'vacation' | 'off' | 'redeployed'
export type SkillLevel = '1' | '2' | '3' | '4' | '5'
export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertCategory = 'sla' | 'bottleneck' | 'break' | 'staffing' | 'ops_stale'
export type OrderType = 'due_date' | 'intraday'

export interface Warehouse {
  id: string
  name: string
  timezone: string
  sla_config: Record<string, unknown>
  created_at: string
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
  intraday_orders: number
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
  remaining_due_date: number
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
  message: string
}

export const ROLE_CONFIG: Record<EmployeeRole, { label: string; short: string; color: string; bg: string }> = {
  operator:    { label: 'AutoStore', short: 'OP', color: '#06b6d4', bg: '#ecfeff' },
  picker:      { label: 'Picking',   short: 'PK', color: '#3b82f6', bg: '#eff6ff' },
  packer:      { label: 'Packing',   short: 'PA', color: '#22c55e', bg: '#f0fdf4' },
  validator:   { label: 'Validator', short: 'VA', color: '#8b5cf6', bg: '#f5f3ff' },
  sorter:      { label: 'Sorter',    short: 'SO', color: '#f97316', bg: '#fff7ed' },
  transporter: { label: 'Transport', short: 'TR', color: '#ec4899', bg: '#fdf2f8' },
}

export const STATUS_CONFIG: Record<EmployeeStatus, { label: string; color: string; dot: string }> = {
  working:    { label: 'Working',    color: '#22c55e', dot: '#22c55e' },
  break:      { label: 'Break',      color: '#f59e0b', dot: '#f59e0b' },
  sick:       { label: 'Sick',       color: '#ef4444', dot: '#ef4444' },
  vacation:   { label: 'Vacation',   color: '#3b82f6', dot: '#3b82f6' },
  off:        { label: 'Off',        color: '#9ca3af', dot: '#9ca3af' },
  redeployed: { label: 'Redeployed', color: '#06b6d4', dot: '#06b6d4' },
}

export const SKILL_LABELS: Record<SkillLevel, string> = {
  '1': 'Trainee', '2': 'Junior', '3': 'Standard', '4': 'Senior', '5': 'Expert',
}

export const SKILL_MULTIPLIERS: Record<SkillLevel, number> = {
  '1': 0.6, '2': 0.8, '3': 1.0, '4': 1.2, '5': 1.5,
}

export const MIN_COVERAGE: Record<EmployeeRole, number> = {
  operator: 1, picker: 3, packer: 4, validator: 1, sorter: 1, transporter: 2,
}

export const DEFAULT_THROUGHPUT: Record<EmployeeRole, number> = {
  operator: 150, picker: 120, packer: 110, validator: 80, sorter: 150, transporter: 0,
}
