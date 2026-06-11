// ================================================================
// WAREHOUSE COPILOT — Allocation Engine v1.1
// Both workforce capacity AND live workload (ops snapshot)
// ================================================================

import type {
  Employee, OpsSnapshot, DailyForecast,
  EmployeeRole, OrderType, RoleCapacity, ReallocationSuggestion,
  AllocationEngineResult, BreakSafetyResult,
} from '@/types'
import {
  SKILL_MULTIPLIERS, MIN_COVERAGE, DEFAULT_THROUGHPUT,
} from '@/types'

// ---- HELPERS ----

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function getSkillMultiplier(level: string): number {
  return SKILL_MULTIPLIERS[level as keyof typeof SKILL_MULTIPLIERS] ?? 1.0
}

function getEmployeeThroughput(emp: Employee, role: EmployeeRole): number {
  const prod = emp.productivity?.find(p => p.role === role)
  if (prod) return prod.units_per_hour
  return DEFAULT_THROUGHPUT[role]
}

function getSLACutoffMinutes(orderType: OrderType): number {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 6=Sat

  const cutoffs: Record<OrderType, Record<string, string>> = {
    due_date: { weekday: '19:00', saturday: '15:00', sunday: '17:00' },
    same_day: { weekday: '13:00', saturday: '23:59', sunday: '23:59' },
    intraday: { weekday: '23:59', saturday: '23:59', sunday: '23:59' },
  }

  const dayKey = day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday'
  const cutoffStr = cutoffs[orderType][dayKey]
  if (!cutoffStr) return 24 * 60

  const [h, m] = cutoffStr.split(':').map(Number)
  const cutoffMins = h * 60 + m
  const nowMins = now.getHours() * 60 + now.getMinutes()
  return Math.max(0, cutoffMins - nowMins)
}

// ---- STEP 1: Compute effective capacity per role ----

function computeEffectiveCapacity(
  employees: Employee[],
  roleFilter: (e: Employee) => boolean,
  role: EmployeeRole,
): number {
  return employees
    .filter(e => e.current_status === 'working' || e.current_status === 'redeployed')
    .filter(roleFilter)
    .reduce((sum, emp) => {
      const throughput = getEmployeeThroughput(emp, role)
      const multiplier = getSkillMultiplier(emp.skill_level)
      return sum + throughput * multiplier
    }, 0)
}

// ---- STEP 4: Pressure Ratio ----

function computePressureRatio(queueDepth: number, capacityPerHour: number): number {
  if (capacityPerHour === 0) return queueDepth > 0 ? 99 : 0
  return queueDepth / capacityPerHour
}

// ---- STEP 5: Time-to-Empty ----

function computeTTE(queueDepth: number, capacityPerHour: number): number {
  if (capacityPerHour === 0) return queueDepth > 0 ? 9999 : 0
  return Math.round((queueDepth / capacityPerHour) * 60)
}

// ---- STEP 6: Bottleneck detection ----

type PressureEntry = { role: EmployeeRole; adjusted: number }

function getRoleStatus(pressure: number): RoleCapacity['status'] {
  if (pressure <= 0) return 'surplus'
  if (pressure < 0.5) return 'ok'
  if (pressure < 1.0) return 'watch'
  if (pressure < 1.5) return 'risk'
  return 'critical'
}

// ---- MAIN ENGINE ----

export function runAllocationEngine(
  employees: Employee[],
  ops: OpsSnapshot | null,
  forecast: DailyForecast | null,
): AllocationEngineResult {
  const roles: EmployeeRole[] = ['operator', 'picker', 'packer', 'validator', 'sorter', 'transporter']

  // STEP 1: Workforce capacity
  const capacityMap: Record<EmployeeRole, number> = {} as Record<EmployeeRole, number>
  const activeCountMap: Record<EmployeeRole, number> = {} as Record<EmployeeRole, number>

  for (const role of roles) {
    const working = employees.filter(
      e => (e.current_status === 'working' || e.current_status === 'redeployed') && e.primary_role === role
    )
    activeCountMap[role] = working.length
    capacityMap[role] = computeEffectiveCapacity(employees, e => e.primary_role === role, role)
  }

  // STEP 2: Load ops snapshot (with fallback to forecast)
  let queueDepth: Partial<Record<EmployeeRole, number>> = {}
  let isStale = false

  if (ops) {
    const ageMinutes = (Date.now() - new Date(ops.recorded_at).getTime()) / 60000
    isStale = ageMinutes > 90

    queueDepth = {
      picker: ops.pending_picking,
      packer: ops.pending_packing,
      sorter: ops.pending_sorting,
    }
  } else if (forecast) {
    // Fallback: estimate from forecast
    const total = forecast.due_date_orders + forecast.same_day_orders + forecast.intraday_orders + forecast.backlog_orders
    queueDepth = {
      picker: Math.round(total * 0.6),
      packer: Math.round(total * 0.4),
      sorter: Math.round(total * 0.15),
    }
  }

  // STEP 3: Map queues to roles; transporter is derived
  const packerCapacity = capacityMap.packer
  queueDepth.transporter = Math.round(packerCapacity * 0.15)

  // STEP 4: Pressure ratios
  const pressureMap: Partial<Record<EmployeeRole, number>> = {}
  const tteMap: Partial<Record<EmployeeRole, number>> = {}

  const slaTimeMap: Record<OrderType, number> = {
    due_date: getSLACutoffMinutes('due_date'),
    same_day: getSLACutoffMinutes('same_day'),
    intraday: getSLACutoffMinutes('intraday'),
  }
  const dominantSLAMins = Math.min(...Object.values(slaTimeMap).filter(v => v > 0))

  for (const role of ['picker', 'packer', 'sorter', 'transporter'] as EmployeeRole[]) {
    const queue = queueDepth[role] ?? 0
    const cap = capacityMap[role]
    const raw = computePressureRatio(queue, cap)
    const tte = computeTTE(queue, cap)

    // Adjusted pressure: ratio relative to SLA time remaining
    const adjusted = dominantSLAMins > 0 ? raw / (dominantSLAMins / 60) : raw

    pressureMap[role] = adjusted
    tteMap[role] = tte
  }

  // Required staffing based on order volumes
  const requiredMap: Record<EmployeeRole, number> = {
    operator: 3,
    picker: 0,
    packer: 0,
    validator: 2,
    sorter: 4,
    transporter: 5,
  }

  if (forecast) {
    const total = forecast.due_date_orders + forecast.same_day_orders + forecast.intraday_orders + forecast.backlog_orders
    requiredMap.picker = Math.ceil(total / (DEFAULT_THROUGHPUT.picker * 60 / 8))
    requiredMap.packer = Math.ceil(total / (DEFAULT_THROUGHPUT.packer * 60 / 8))
  }

  // STEP 6: Build role_capacity array
  const role_capacity: RoleCapacity[] = roles.map(role => {
    const active = activeCountMap[role]
    const cap = capacityMap[role]
    const queue = queueDepth[role] ?? null
    const pressure = pressureMap[role] ?? null
    const tte = tteMap[role] ?? null
    const required = requiredMap[role]

    const status = pressure !== null ? getRoleStatus(pressure) : (active >= required ? 'ok' : 'watch')

    return {
      role,
      active_count: active,
      effective_capacity_per_hour: Math.round(cap),
      queue_depth: queue,
      pressure_ratio: pressure !== null ? Math.round(pressure * 100) / 100 : null,
      tte_minutes: tte,
      required_count: required,
      gap: active - required,
      status,
    }
  })

  // STEP 7: Bottleneck + surplus
  const queueRoles = role_capacity.filter(r => r.pressure_ratio !== null)
  const sorted = [...queueRoles].sort((a, b) => (b.pressure_ratio ?? 0) - (a.pressure_ratio ?? 0))
  const bottleneck = sorted[0]
  const bottleneck_role = bottleneck && (bottleneck.pressure_ratio ?? 0) > 1.0 ? bottleneck.role : null

  // Surplus roles = pressure < 0.5 and have spare headcount
  const surplusRoles = queueRoles
    .filter(r => (r.pressure_ratio ?? 1) < 0.5)
    .map(r => r.role)

  // STEP 7: Reallocation suggestions
  const suggestions: ReallocationSuggestion[] = []
  const bottleneckEntries: PressureEntry[] = sorted
    .filter(r => (r.pressure_ratio ?? 0) > 1.0)
    .map(r => ({ role: r.role, adjusted: r.pressure_ratio ?? 0 }))

  for (const { role: targetRole } of bottleneckEntries) {
    const targetRC = role_capacity.find(r => r.role === targetRole)
    if (!targetRC) continue

    // Find candidates: employees in surplus roles who can do targetRole
    const candidates = employees.filter(emp => {
      if (emp.current_status !== 'working') return false
      if (emp.primary_role === targetRole) return false
      if (!surplusRoles.includes(emp.primary_role)) return false

      const canDo = emp.secondary_role === targetRole || emp.tertiary_role === targetRole
      if (!canDo) return false

      // Check source role won't be under min coverage
      const sourceRC = role_capacity.find(r => r.role === emp.primary_role)
      if (!sourceRC) return false
      return sourceRC.active_count - 1 >= MIN_COVERAGE[emp.primary_role]
    })

    // Sort by skill in target role
    candidates.sort((a, b) => {
      const aThru = getEmployeeThroughput(a, targetRole) * getSkillMultiplier(a.skill_level)
      const bThru = getEmployeeThroughput(b, targetRole) * getSkillMultiplier(b.skill_level)
      return bThru - aThru
    })

    for (const candidate of candidates.slice(0, 2)) {
      const gain = getEmployeeThroughput(candidate, targetRole) * getSkillMultiplier(candidate.skill_level)
      suggestions.push({
        employee: candidate,
        from_role: candidate.primary_role,
        to_role: targetRole,
        reason: `Move from ${candidate.primary_role} (surplus, pressure ${(pressureMap[candidate.primary_role] ?? 0).toFixed(2)}×) to ${targetRole} (pressure ${(pressureMap[targetRole] ?? 0).toFixed(2)}×)`,
        capacity_gain: Math.round(gain),
      })
    }
  }

  // STEP 8: SLA risk scores
  const sla_risk = {} as Record<OrderType, number>
  const remaining: Record<OrderType, number> = {
    due_date: ops?.remaining_due_date ?? (forecast?.due_date_orders ?? 0),
    same_day: ops?.remaining_same_day ?? (forecast?.same_day_orders ?? 0),
    intraday: ops?.remaining_intraday ?? (forecast?.intraday_orders ?? 0),
  }

  const packerCap = capacityMap.packer
  const tte_packing = computeTTE(queueDepth.packer ?? 0, packerCap)

  for (const type of ['due_date', 'same_day', 'intraday'] as OrderType[]) {
    const timeBuffer = slaTimeMap[type] - tte_packing
    const timeRisk = sigmoid(-timeBuffer / 30)
    const pressureRisk = sigmoid(((pressureMap.packer ?? 0) - 1) * 2)
    sla_risk[type] = Math.round((0.6 * timeRisk + 0.4 * pressureRisk) * 1000) / 1000
  }

  const overall_risk = Math.max(
    sla_risk.same_day * 1.5,
    sla_risk.due_date * 1.0,
    sla_risk.intraday * 0.5,
  )

  // Projected clear times
  const projected_clears: Record<EmployeeRole, string | null> = {} as Record<EmployeeRole, string | null>
  for (const role of roles) {
    const tte = tteMap[role]
    if (tte !== undefined && tte < 9999) {
      const clear = new Date(Date.now() + tte * 60000)
      projected_clears[role] = clear.toISOString()
    } else {
      projected_clears[role] = null
    }
  }

  return {
    role_capacity,
    suggestions,
    sla_risk,
    overall_risk: Math.min(1, overall_risk),
    bottleneck_role,
    projected_clears,
    computed_at: new Date().toISOString(),
  }
}

// ---- BREAK SAFETY GATE ----

export function evaluateBreakSafety(
  employee: Employee,
  employees: Employee[],
  ops: OpsSnapshot | null,
  forecast: DailyForecast | null,
): BreakSafetyResult {
  // Simulate removing this employee
  const simEmployees = employees.map(e =>
    e.id === employee.id ? { ...e, current_status: 'break' as const } : e
  )

  const before = runAllocationEngine(employees, ops, forecast)
  const after = runAllocationEngine(simEmployees, ops, forecast)

  const role = employee.primary_role
  const pressureAfter = after.role_capacity.find(r => r.role === role)?.pressure_ratio ?? 0
  const riskDelta = after.overall_risk - before.overall_risk

  let status: BreakSafetyResult['status'] = 'auto_approve'
  let message = 'Safe to take break. Coverage remains adequate.'

  if (pressureAfter > 2.0 || riskDelta > 0.25) {
    status = 'supervisor_review'
    message = `Breaking ${employee.full_name} would push ${role} pressure to ${pressureAfter.toFixed(1)}×. SLA risk increases significantly. Consider alternatives.`
  } else if (pressureAfter > 1.5 || riskDelta > 0.10) {
    status = 'caution'
    message = `Break approved with caution. ${role} pressure rises to ${pressureAfter.toFixed(1)}×. Monitor closely.`
  }

  return {
    status,
    pressure_after: pressureAfter,
    risk_delta: riskDelta,
    alternatives: after.suggestions.slice(0, 2),
    message,
  }
}

// ---- FORMAT HELPERS ----

export function formatTTE(minutes: number | null): string {
  if (minutes === null || minutes >= 9999) return '—'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatPressure(ratio: number | null): string {
  if (ratio === null) return '—'
  return `${ratio.toFixed(2)}×`
}

export function pressureColor(ratio: number | null): string {
  if (ratio === null) return 'text-muted'
  if (ratio < 0.5) return 'text-success'
  if (ratio < 1.0) return 'text-yellow'
  if (ratio < 1.5) return 'text-orange'
  return 'text-red'
}

export function riskLabel(score: number): { label: string; color: string } {
  if (score < 0.3) return { label: 'Low', color: 'text-success' }
  if (score < 0.6) return { label: 'Medium', color: 'text-yellow' }
  if (score < 0.8) return { label: 'High', color: 'text-orange' }
  return { label: 'Critical', color: 'text-red' }
}
