import type {
  Employee, OpsSnapshot, DailyForecast,
  EmployeeRole, OrderType, RoleCapacity, ReallocationSuggestion,
  AllocationEngineResult, BreakSafetyResult,
} from '@/types'
import { SKILL_MULTIPLIERS, MIN_COVERAGE, DEFAULT_THROUGHPUT } from '@/types'

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
  const cutoffs: Record<OrderType, string> = {
    due_date: '19:00',
    intraday:  '01:30', // next day
  }
  const cutoffStr = cutoffs[orderType]
  const [h, m] = cutoffStr.split(':').map(Number)
  let cutoffMins = h * 60 + m
  const nowMins = now.getHours() * 60 + now.getMinutes()
  // intraday cutoff is next day
  if (orderType === 'intraday') {
    cutoffMins = 24 * 60 + cutoffMins
  }
  return Math.max(0, cutoffMins - nowMins)
}

function computePressureRatio(queue: number, cap: number): number {
  if (cap === 0) return queue > 0 ? 99 : 0
  return queue / cap
}

function computeTTE(queue: number, cap: number): number {
  if (cap === 0) return queue > 0 ? 9999 : 0
  return Math.round((queue / cap) * 60)
}

function getRoleStatus(pressure: number): RoleCapacity['status'] {
  if (pressure <= 0) return 'surplus'
  if (pressure < 0.5) return 'ok'
  if (pressure < 1.0) return 'watch'
  if (pressure < 1.5) return 'risk'
  return 'critical'
}

export function runAllocationEngine(
  employees: Employee[],
  ops: OpsSnapshot | null,
  forecast: DailyForecast | null,
): AllocationEngineResult {
  const roles: EmployeeRole[] = ['operator', 'picker', 'packer', 'validator', 'sorter', 'transporter']

  // Step 1: Workforce capacity
  const capacityMap = {} as Record<EmployeeRole, number>
  const activeCountMap = {} as Record<EmployeeRole, number>

  for (const role of roles) {
    const working = employees.filter(
      e => (e.current_status === 'working' || e.current_status === 'redeployed') && e.primary_role === role
    )
    activeCountMap[role] = working.length
    capacityMap[role] = working.reduce((sum, emp) => {
      return sum + getEmployeeThroughput(emp, role) * getSkillMultiplier(emp.skill_level)
    }, 0)
  }

  // Step 2: Queue depths from ops snapshot
  const queueDepth: Partial<Record<EmployeeRole, number>> = {}
  if (ops) {
    queueDepth.picker = ops.pending_picking
    queueDepth.packer = ops.pending_packing
    queueDepth.sorter = ops.pending_sorting
  } else if (forecast) {
    const total = forecast.due_date_orders + forecast.intraday_orders
    queueDepth.picker = Math.round(total * 0.6)
    queueDepth.packer = Math.round(total * 0.4)
    queueDepth.sorter = Math.round(total * 0.15)
  }

  // Step 3: Pressure ratios
  const slaTimeMap: Record<OrderType, number> = {
    due_date: getSLACutoffMinutes('due_date'),
    intraday:  getSLACutoffMinutes('intraday'),
  }
  const dominantSLAMins = Math.min(...Object.values(slaTimeMap).filter(v => v > 0))
  const pressureMap: Partial<Record<EmployeeRole, number>> = {}
  const tteMap: Partial<Record<EmployeeRole, number>> = {}

  for (const role of ['picker', 'packer', 'sorter'] as EmployeeRole[]) {
    const queue = queueDepth[role] ?? 0
    const cap = capacityMap[role]
    const raw = computePressureRatio(queue, cap)
    const adjusted = dominantSLAMins > 0 ? raw / (dominantSLAMins / 60) : raw
    pressureMap[role] = adjusted
    tteMap[role] = computeTTE(queue, cap)
  }

  // Required staffing
  const requiredMap: Record<EmployeeRole, number> = {
    operator: 2, picker: 6, packer: 7, validator: 2, sorter: 3, transporter: 3, team_leader: 1,
  }
  if (forecast) {
    const total = forecast.due_date_orders + forecast.intraday_orders
    requiredMap.picker = Math.ceil(total / (DEFAULT_THROUGHPUT.picker * 8))
    requiredMap.packer = Math.ceil(total / (DEFAULT_THROUGHPUT.packer * 8))
  }

  // Build role_capacity
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

  // Bottleneck & surplus
  const queueRoles = role_capacity.filter(r => r.pressure_ratio !== null)
  const sorted = [...queueRoles].sort((a, b) => (b.pressure_ratio ?? 0) - (a.pressure_ratio ?? 0))
  const bottleneck = sorted[0]
  const bottleneck_role = bottleneck && (bottleneck.pressure_ratio ?? 0) > 1.0 ? bottleneck.role : null
  const surplusRoles = queueRoles.filter(r => (r.pressure_ratio ?? 1) < 0.5).map(r => r.role)

  // Suggestions
  const suggestions: ReallocationSuggestion[] = []
  const bottleneckEntries = sorted.filter(r => (r.pressure_ratio ?? 0) > 1.0)

  for (const { role: targetRole } of bottleneckEntries) {
    const candidates = employees.filter(emp => {
      if (emp.current_status !== 'working') return false
      if (emp.primary_role === targetRole) return false
      if (!surplusRoles.includes(emp.primary_role)) return false
      const canDo = emp.secondary_role === targetRole || emp.tertiary_role === targetRole
      if (!canDo) return false
      const sourceRC = role_capacity.find(r => r.role === emp.primary_role)
      if (!sourceRC) return false
      return sourceRC.active_count - 1 >= MIN_COVERAGE[emp.primary_role]
    })

    candidates.sort((a, b) => {
      const aT = getEmployeeThroughput(a, targetRole) * getSkillMultiplier(a.skill_level)
      const bT = getEmployeeThroughput(b, targetRole) * getSkillMultiplier(b.skill_level)
      return bT - aT
    })

    for (const candidate of candidates.slice(0, 2)) {
      const gain = getEmployeeThroughput(candidate, targetRole) * getSkillMultiplier(candidate.skill_level)
      suggestions.push({
        employee: candidate,
        from_role: candidate.primary_role,
        to_role: targetRole,
        reason: `Surplus in ${candidate.primary_role}, bottleneck in ${targetRole}`,
        capacity_gain: Math.round(gain),
      })
    }
  }

  // SLA risk — only due_date and intraday
  const sla_risk = {} as Record<OrderType, number>
  const packerCap = capacityMap.packer
  const tte_packing = computeTTE(queueDepth.packer ?? 0, packerCap)

  for (const type of ['due_date', 'intraday'] as OrderType[]) {
    const timeBuffer = slaTimeMap[type] - tte_packing
    const timeRisk = sigmoid(-timeBuffer / 30)
    const pressureRisk = sigmoid(((pressureMap.packer ?? 0) - 1) * 2)
    sla_risk[type] = Math.round((0.6 * timeRisk + 0.4 * pressureRisk) * 1000) / 1000
  }

  const overall_risk = Math.min(1, Math.max(
    sla_risk.due_date * 1.5,
    sla_risk.intraday * 0.5,
  ))

  // Projected clears
  const projected_clears = {} as Record<EmployeeRole, string | null>
  for (const role of roles) {
    const tte = tteMap[role]
    if (tte !== undefined && tte < 9999) {
      projected_clears[role] = new Date(Date.now() + tte * 60000).toISOString()
    } else {
      projected_clears[role] = null
    }
  }

  return {
    role_capacity,
    suggestions,
    sla_risk,
    overall_risk,
    bottleneck_role,
    projected_clears,
    computed_at: new Date().toISOString(),
  }
}

export function evaluateBreakSafety(
  employee: Employee,
  employees: Employee[],
  ops: OpsSnapshot | null,
  forecast: DailyForecast | null,
): BreakSafetyResult {
  const simEmployees = employees.map(e =>
    e.id === employee.id ? { ...e, current_status: 'break' as const } : e
  )
  const before = runAllocationEngine(employees, ops, forecast)
  const after  = runAllocationEngine(simEmployees, ops, forecast)
  const role = employee.primary_role
  const pressureAfter = after.role_capacity.find(r => r.role === role)?.pressure_ratio ?? 0
  const riskDelta = after.overall_risk - before.overall_risk

  let status: BreakSafetyResult['status'] = 'auto_approve'
  let message = 'Ασφαλές να πάρει διάλειμμα.'
  if (pressureAfter > 2.0 || riskDelta > 0.25) {
    status = 'supervisor_review'
    message = `Το διάλειμμα θα ανεβάσει την πίεση ${role} στο ${pressureAfter.toFixed(1)}×.`
  } else if (pressureAfter > 1.5 || riskDelta > 0.10) {
    status = 'caution'
    message = `Προσοχή: πίεση ${role} → ${pressureAfter.toFixed(1)}×.`
  }

  return { status, pressure_after: pressureAfter, risk_delta: riskDelta, message }
}

export function formatTTE(minutes: number | null): string {
  if (minutes === null || minutes >= 9999) return '—'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function riskLabel(score: number): { label: string; color: string } {
  if (score < 0.3) return { label: 'Χαμηλός', color: '#22c55e' }
  if (score < 0.6) return { label: 'Μέτριος', color: '#f59e0b' }
  if (score < 0.8) return { label: 'Υψηλός',  color: '#f97316' }
  return { label: 'Κρίσιμος', color: '#ef4444' }
}