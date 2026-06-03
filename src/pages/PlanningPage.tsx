import { useState, useRef } from 'react'
import { useAppStore } from '@/store'
import { ROLE_CONFIG, SKILL_LABELS } from '@/types'
import type { Employee } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedEmployee {
  full_name: string
  role: string
  shift: string
  shift_start: number // minutes from midnight
  shift_end: number
  break_time: number  // minutes from midnight
}

interface OverviewData {
  kataxorisi: { poly: number; mono: number; autostore: number; picked_as: number; ogkodi: number; cargo: number }
  proetoimasia: { poly: number; mono: number; autostore: number; picked_as: number; ogkodi: number; cargo: number }
}

interface ThroughputRow {
  hour_start: number // 0-23
  packed: number
  downloaded: number
}

interface ShiftPlan {
  time: string
  label: string
  employees: PlanAssignment[]
  totalCapacity: number
  pendingOrders: number
  neededCapacity: number
  status: 'ok' | 'warning' | 'critical'
}

interface PlanAssignment {
  employee: ParsedEmployee
  supabaseEmp: Employee | null
  zone: string
  position: string
  uph: number
  withValidator?: string
}

// ─── Shift & Break config ─────────────────────────────────────────────────────

function parseTime(t: string): number {
  if (!t || t === 'day_off' || t === 'unexcused' || t === 'regular') return -1
  const parts = t.split('-')
  if (parts.length < 2) return -1
  const [h, m] = parts[0].split(':').map(Number)
  return h * 60 + (m || 0)
}

function shiftEnd(t: string): number {
  if (!t || t === 'day_off') return -1
  const parts = t.split('-')
  if (parts.length < 2) return -1
  const [h, m] = parts[1].split(':').map(Number)
  const mins = h * 60 + (m || 0)
  return mins < parseTime(t) ? mins + 24 * 60 : mins
}

function getBreak(shiftStr: string): number {
  const start = parseTime(shiftStr)
  if (start < 0) return -1
  if (start <= 6 * 60)  return 12 * 60        // 06:xx → break 12:00
  if (start <= 7 * 60)  return 12 * 60 + 30   // 07:xx → break 12:30
  if (start <= 9 * 60)  return 12 * 60 + 30   // 09:xx → break 12:30
  if (start <= 13 * 60) return 18 * 60 + 30   // 13:xx → break 18:30
  return 22 * 60 + 30                           // 18:xx → break 22:30
}

function isActiveAt(emp: ParsedEmployee, timeMins: number): boolean {
  if (emp.shift_start < 0) return false
  // on break ±15min window
  if (Math.abs(emp.break_time - timeMins) < 30) return false
  const end = emp.shift_end
  if (end > emp.shift_start) {
    return timeMins >= emp.shift_start && timeMins < end
  } else {
    // overnight shift
    return timeMins >= emp.shift_start || timeMins < end
  }
}

// ─── Excel parsers ────────────────────────────────────────────────────────────

async function parsePapakias(file: File, date: Date): Promise<ParsedEmployee[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]
  const dow = date.getDay()
  const colIndex = dow === 0 ? 8 : dow + 1

  const result: ParsedEmployee[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[1]) continue
    const roleRaw = String(row[0] ?? '').toLowerCase().trim()
    const nameRaw = String(row[1] ?? '').trim()
    const shiftRaw = String(row[colIndex] ?? '').trim()
    if (!nameRaw || shiftRaw === 'day_off' || shiftRaw === 'unexcused') continue
    const name = nameRaw.replace(/\s*\(id:\d+\)\s*$/, '').trim()
    let role = roleRaw
    if (role === 'palletizing') role = 'sorter'
    const start = parseTime(shiftRaw)
    const end = shiftEnd(shiftRaw)
    const brk = getBreak(shiftRaw)
    if (start < 0) continue
    result.push({ full_name: name, role, shift: shiftRaw, shift_start: start, shift_end: end, break_time: brk })
  }
  return result
}

async function parseOverview(file: File): Promise<OverviewData> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  function cleanNum(v: unknown): number {
    if (v == null) return 0
    const n = parseFloat(String(v).replace(/[^0-9.-]/g, '').replace(',', '.'))
    return isNaN(n) ? 0 : n
  }

  // Row 1 = Καταχώρηση, Row 2 = Προετοιμασία
  const k = rows[1] ?? []
  const p = rows[2] ?? []
  return {
    kataxorisi:   { poly: cleanNum(k[1]), mono: cleanNum(k[2]), autostore: cleanNum(k[3]), picked_as: cleanNum(k[4]), ogkodi: cleanNum(k[5]), cargo: cleanNum(k[6]) },
    proetoimasia: { poly: cleanNum(p[1]), mono: cleanNum(p[2]), autostore: cleanNum(p[3]), picked_as: cleanNum(p[4]), ogkodi: cleanNum(p[5]), cargo: cleanNum(p[6]) },
  }
}

async function parseThroughput(file: File, targetDow: number): Promise<ThroughputRow[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  const DOW_NAMES = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο']
  // Use previous day's data for forecast
  const prevDow = targetDow === 0 ? 6 : targetDow - 1
  const prevName = DOW_NAMES[prevDow]

  const result: ThroughputRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[2]) continue
    const day = String(row[1] ?? '').trim()
    const hourStr = String(row[2] ?? '').trim()
    if (hourStr === 'Σύνολο') continue
    const hourStart = parseInt(hourStr.split('-')[0])
    const packed = parseFloat(String(row[3] ?? '0').replace(/[^0-9.-]/g, '')) || 0
    const downloaded = parseFloat(String(row[4] ?? '0').replace(/[^0-9.-]/g, '')) || 0
    if (day === prevName || rows.length < 30) {
      result.push({ hour_start: hourStart, packed, downloaded })
    }
  }

  // If no match for prev day, use all available rows
  if (result.length === 0) {
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !row[2]) continue
      const hourStr = String(row[2] ?? '').trim()
      if (hourStr === 'Σύνολο') continue
      const hourStart = parseInt(hourStr.split('-')[0])
      const packed = parseFloat(String(row[3] ?? '0').replace(/[^0-9.-]/g, '')) || 0
      const downloaded = parseFloat(String(row[4] ?? '0').replace(/[^0-9.-]/g, '')) || 0
      result.push({ hour_start: hourStart, packed, downloaded })
    }
  }

  return result.sort((a, b) => a.hour_start - b.hour_start)
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

function calcPendingOrders(
  overview: OverviewData,
  throughput: ThroughputRow[],
  atTimeMins: number,
  cutoffMins: number
): number {
  // Total currently pending = proetoimasia total (ready to pack)
  const pendingNow =
    overview.proetoimasia.poly +
    overview.proetoimasia.mono +
    overview.proetoimasia.picked_as +
    overview.proetoimasia.ogkodi

  // Estimate additional downloads from now until cutoff
  const hoursLeft = Math.max(0, (cutoffMins - atTimeMins) / 60)
  const atHour = Math.floor(atTimeMins / 60)
  const cutoffHour = Math.min(23, Math.floor(cutoffMins / 60))

  let expectedDownloads = 0
  for (const row of throughput) {
    if (row.hour_start >= atHour && row.hour_start < cutoffHour) {
      expectedDownloads += row.downloaded
    }
  }

  return Math.round(pendingNow + expectedDownloads * 0.85) // 0.85 = day-to-day variance factor
}

function assignZones(
  activeEmps: ParsedEmployee[],
  supabaseEmps: Employee[],
  timeMins: number
): PlanAssignment[] {
  const assignments: PlanAssignment[] = []

  function findSupa(name: string): Employee | null {
    return supabaseEmps.find(e => e.full_name === name || e.full_name.toLowerCase() === name.toLowerCase()) ?? null
  }

  function getUph(emp: Employee | null, role: string): number {
    if (!emp) return 100
    const p = emp.productivity?.find(pr => pr.role === role) ?? emp.productivity?.[0]
    return p?.units_per_hour ?? 100
  }

  const packers    = activeEmps.filter(e => e.role === 'packer').map(e => ({ e, s: findSupa(e.full_name), uph: getUph(findSupa(e.full_name), 'packer') })).sort((a, b) => b.uph - a.uph)
  const validators = activeEmps.filter(e => e.role === 'validator').map(e => ({ e, s: findSupa(e.full_name), uph: 0 }))
  const operators  = activeEmps.filter(e => e.role === 'operator')
  const pickers    = activeEmps.filter(e => e.role === 'picker')
  const sorters    = activeEmps.filter(e => e.role === 'sorter' || e.role === 'palletizing')

  const usedP = new Set<string>()
  const usedV = new Set<string>()

  // Operators
  operators.forEach((e, i) => {
    const s = findSupa(e.full_name)
    assignments.push({ employee: e, supabaseEmp: s, zone: 'AutoStore', position: `Op${i+1}`, uph: getUph(s,'operator') })
  })

  // Pickers
  pickers.forEach((e, i) => {
    const s = findSupa(e.full_name)
    assignments.push({ employee: e, supabaseEmp: s, zone: 'Picking', position: `PK${i+1}`, uph: getUph(s,'picker') })
  })

  // Sorters
  sorters.forEach((e, i) => {
    const s = findSupa(e.full_name)
    assignments.push({ employee: e, supabaseEmp: s, zone: 'Sorting', position: `SR${i+1}`, uph: 0 })
  })

  // OG1 — weakest packer
  const ogPacker = packers[packers.length - 1]
  if (ogPacker && !usedP.has(ogPacker.e.full_name)) {
    usedP.add(ogPacker.e.full_name)
    assignments.push({ employee: ogPacker.e, supabaseEmp: ogPacker.s, zone: 'OG1', position: 'Og1', uph: 80 })
  }

  // Red zone — best packers + validators
  const redPositions = ['Π1','Π2','Π3','Π4']
  const availPackers = packers.filter(p => !usedP.has(p.e.full_name))
  const availValidators = validators.filter(v => !usedV.has(v.e.full_name))

  for (const pos of redPositions) {
    const packer = availPackers.find(p => !usedP.has(p.e.full_name))
    if (!packer) break
    usedP.add(packer.e.full_name)
    const validator = availValidators.find(v => !usedV.has(v.e.full_name))
    if (validator) {
      usedV.add(validator.e.full_name)
      const valShortName = validator.e.full_name.split(' ')[0]
      assignments.push({ employee: validator.e, supabaseEmp: validator.s, zone: `RED_${pos}`, position: pos, uph: 145, withValidator: undefined })
      assignments.push({ employee: packer.e, supabaseEmp: packer.s, zone: `RED_${pos}`, position: pos, uph: 145, withValidator: valShortName })
    } else {
      assignments.push({ employee: packer.e, supabaseEmp: packer.s, zone: `RED_${pos}`, position: pos, uph: 90 })
    }
  }

  // Green zone L1-L5
  const greenPositions = ['L1','L2','L3','L4','L5']
  packers.filter(p => !usedP.has(p.e.full_name)).forEach((packer, i) => {
    if (i >= greenPositions.length) return
    usedP.add(packer.e.full_name)
    assignments.push({ employee: packer.e, supabaseEmp: packer.s, zone: greenPositions[i], position: greenPositions[i], uph: 110 })
  })

  // Remaining validators
  validators.filter(v => !usedV.has(v.e.full_name)).forEach((v, i) => {
    assignments.push({ employee: v.e, supabaseEmp: v.s, zone: 'Validator', position: `VA${i+1}`, uph: 0 })
  })

  return assignments
}

function buildShiftPlans(
  allEmps: ParsedEmployee[],
  supabaseEmps: Employee[],
  overview: OverviewData,
  throughput: ThroughputRow[]
): ShiftPlan[] {
  const planTimes = [
    { time: '07:00', label: 'Έναρξη Πρωινής', mins: 7 * 60 },
    { time: '12:00', label: 'Διάλειμμα 06:00 βάρδια', mins: 12 * 60 },
    { time: '12:30', label: 'Κύρια Αλλαγή', mins: 12 * 60 + 30 },
    { time: '13:00', label: 'Ενίσχυση Απογευματινής', mins: 13 * 60 },
    { time: '18:30', label: 'Διάλειμμα Απογευματινής', mins: 18 * 60 + 30 },
  ]

  const dueCutoff = 19 * 60
  const intradayCutoff = 24 * 60 + 90

  return planTimes.map(({ time, label, mins }) => {
    const active = allEmps.filter(e => isActiveAt(e, mins))
    const assignments = assignZones(active, supabaseEmps, mins)
    const packingAssignments = assignments.filter(a => a.employee.role === 'packer' || (a.uph > 0 && ['OG1','L1','L2','L3','L4','L5','Π1','Π2','Π3','Π4'].includes(a.zone)))
    // Deduplicate (packer+validator pairs count once)
    const uniquePackingZones = new Set(packingAssignments.filter(a => a.employee.role === 'packer' || !a.withValidator).map(a => a.zone))
    const totalCapacity = assignments.filter(a => a.employee.role === 'packer').reduce((s, a) => s + a.uph, 0)

    const cutoff = mins < 19 * 60 ? dueCutoff : intradayCutoff
    const pending = calcPendingOrders(overview, throughput, mins, cutoff)
    const hoursLeft = Math.max(0.5, (cutoff - mins) / 60)
    const needed = Math.ceil(pending / hoursLeft)

    const gap = totalCapacity - needed
    const status: 'ok' | 'warning' | 'critical' = gap >= 0 ? 'ok' : gap > -100 ? 'warning' : 'critical'

    return { time, label, employees: assignments, totalCapacity, pendingOrders: pending, neededCapacity: needed, status }
  })
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const ROLE_COLOR: Record<string, { color: string; bg: string }> = {
  operator:  { color: '#06b6d4', bg: '#ecfeff' },
  picker:    { color: '#3b82f6', bg: '#eff6ff' },
  packer:    { color: '#22c55e', bg: '#f0fdf4' },
  validator: { color: '#8b5cf6', bg: '#f5f3ff' },
  sorter:    { color: '#f97316', bg: '#fff7ed' },
}

const ZONE_SECTION: { key: string; title: string; color: string; bg: string; zones: string[] }[] = [
  { key: 'autostore', title: 'AutoStore',            color: '#06b6d4', bg: '#ecfeff', zones: ['AutoStore'] },
  { key: 'picking',   title: 'Picking',               color: '#3b82f6', bg: '#eff6ff', zones: ['Picking'] },
  { key: 'og',        title: '🟡 Ογκώδη',            color: '#f59e0b', bg: '#fffbeb', zones: ['OG1'] },
  { key: 'red',       title: '🔴 Κόκκινη Ζώνη',      color: '#ef4444', bg: '#fef2f2', zones: ['RED_Π1','RED_Π2','RED_Π3','RED_Π4'] },
  { key: 'green',     title: '🟢 Πράσινη Ζώνη',      color: '#22c55e', bg: '#f0fdf4', zones: ['L1','L2','L3','L4','L5'] },
  { key: 'sorting',   title: 'Sorting / Palletizing', color: '#f97316', bg: '#fff7ed', zones: ['Sorting'] },
  { key: 'validator', title: 'Validators',            color: '#8b5cf6', bg: '#f5f3ff', zones: ['Validator'] },
]

const STATUS_COLOR = { ok: '#22c55e', warning: '#f59e0b', critical: '#ef4444' }
const STATUS_LABEL = { ok: '✅ OK', warning: '⚠️ Οριακά', critical: '🔴 Έλλειμμα' }

function AssignmentCard({ a }: { a: PlanAssignment }) {
  const rc = ROLE_COLOR[a.employee.role] ?? ROLE_COLOR.packer
  const skill = a.supabaseEmp ? SKILL_LABELS[a.supabaseEmp.skill_level as keyof typeof SKILL_LABELS] : ''
  return (
    <div style={{ background: 'white', padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: rc.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: 'white', flexShrink: 0 }}>
          {initials(a.employee.full_name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.employee.full_name.split(' ').slice(0, 2).join(' ')}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>{a.employee.shift}</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: rc.color, background: rc.bg, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
          {a.position}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {skill && <span style={{ fontSize: 9, color: '#9ca3af', background: '#f9f9f7', padding: '2px 6px', borderRadius: 10 }}>{skill}</span>}
        {a.uph > 0 && <span style={{ fontSize: 9, color: '#9ca3af', background: '#f9f9f7', padding: '2px 6px', borderRadius: 10, fontFamily: 'monospace' }}>{a.uph} u/h</span>}
        {a.withValidator && <span style={{ fontSize: 9, color: '#8b5cf6', background: '#f5f3ff', padding: '2px 6px', borderRadius: 10 }}>+{a.withValidator}</span>}
      </div>
    </div>
  )
}

function ShiftPlanCard({ plan, expanded, onToggle }: { plan: ShiftPlan; expanded: boolean; onToggle: () => void }) {
  const sc = STATUS_COLOR[plan.status]
  const groups: Record<string, PlanAssignment[]> = {}
  for (const a of plan.employees) {
    if (!groups[a.zone]) groups[a.zone] = []
    groups[a.zone].push(a)
  }

  return (
    <div style={{ background: 'white', borderRadius: 12, border: `0.5px solid ${expanded ? '#1a1a1a' : '#e5e5e5'}`, overflow: 'hidden', transition: 'border-color 0.15s' }}>
      {/* Plan header */}
      <div onClick={onToggle} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ background: '#1a1a1a', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 14, fontWeight: 500, flexShrink: 0 }}>
          {plan.time}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 }}>{plan.label}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{plan.employees.length} εργαζόμενοι ενεργοί</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: sc, fontWeight: 600, marginBottom: 2 }}>{STATUS_LABEL[plan.status]}</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>{plan.totalCapacity} / {plan.neededCapacity} u/h</div>
        </div>
        <div style={{ fontSize: 16, color: '#9ca3af', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {/* Capacity bar */}
      <div style={{ height: 3, background: '#f0f0f0' }}>
        <div style={{ height: '100%', width: `${Math.min(100, Math.round((plan.totalCapacity / Math.max(1, plan.neededCapacity)) * 100))}%`, background: sc, transition: 'width 0.5s ease' }} />
      </div>

      {expanded && (
        <>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '0.5px solid #f0f0f0' }}>
            {[
              { label: 'Εκκρεμείς παρ.', val: plan.pendingOrders.toLocaleString(), color: '#1a1a1a' },
              { label: 'Capacity/h', val: `${plan.totalCapacity}`, color: sc },
              { label: 'Στόχος/h', val: `${plan.neededCapacity}`, color: '#3b82f6' },
              { label: 'Διαφορά', val: `${plan.totalCapacity - plan.neededCapacity > 0 ? '+' : ''}${plan.totalCapacity - plan.neededCapacity}`, color: plan.totalCapacity >= plan.neededCapacity ? '#22c55e' : '#ef4444' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ padding: '12px 14px', borderRight: '0.5px solid #f0f0f0' }}>
                <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 500, color, fontFamily: 'monospace' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Zone assignments */}
          {ZONE_SECTION.map(section => {
            const sectionItems = section.zones.flatMap(z => (groups as Record<string, PlanAssignment[]>)[z] ?? [])
            if (sectionItems.length === 0) return null
            const sectionCapacity = sectionItems.filter(a => a.employee.role === 'packer').reduce((s, a) => s + a.uph, 0)
            return (
              <div key={section.key} style={{ borderTop: '0.5px solid #f0f0f0' }}>
                <div style={{ background: section.bg, padding: '8px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: section.color }}>{section.title}</div>
                  {sectionCapacity > 0 && <div style={{ fontSize: 10, color: '#9ca3af' }}>{sectionCapacity} παρ/ώρα</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.5px', background: '#f9f9f7' }}>
                  {sectionItems.map((a, i) => <AssignmentCard key={i} a={a} />)}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PlanningPage() {
  const employees = useAppStore(s => s.employees)

  const [step, setStep] = useState<1 | 2>(1)
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [papakiasFile, setPapakiasFile] = useState<File | null>(null)
  const [overviewFile, setOverviewFile] = useState<File | null>(null)
  const [throughputFile, setThroughputFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plans, setPlans] = useState<ShiftPlan[]>([])
  const [expandedPlan, setExpandedPlan] = useState<number>(0)
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null)

  const papakiasRef = useRef<HTMLInputElement>(null)
  const overviewRef = useRef<HTMLInputElement>(null)
  const throughputRef = useRef<HTMLInputElement>(null)

  async function handleGenerate() {
    if (!papakiasFile || !overviewFile || !throughputFile) {
      setError('Ανέβασε και τα 3 αρχεία')
      return
    }
    setLoading(true)
    setError('')
    try {
      const date = new Date(selectedDate + 'T12:00:00')
      const [emps, ov, tp] = await Promise.all([
        parsePapakias(papakiasFile, date),
        parseOverview(overviewFile),
        parseThroughput(throughputFile, date.getDay()),
      ])
      if (emps.length === 0) { setError('Δεν βρέθηκαν εργαζόμενοι για αυτή την ημέρα'); setLoading(false); return }
      setOverviewData(ov)
      const shiftPlans = buildShiftPlans(emps, employees, ov, tp)
      setPlans(shiftPlans)
      setStep(2)
    } catch (e) {
      setError('Σφάλμα ανάγνωσης αρχείων — έλεγξε ότι ανέβασες τα σωστά')
    }
    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    border: '0.5px solid #e5e5e5', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, outline: 'none',
    fontFamily: 'Inter, sans-serif', width: '100%', color: '#1a1a1a', background: 'white',
  }

  function UploadBox({ label, hint, file, onFile, inputRef, color }: {
    label: string; hint: string; file: File | null; onFile: (f: File) => void
    inputRef: React.RefObject<HTMLInputElement>; color: string
  }) {
    return (
      <div onClick={() => inputRef.current?.click()} style={{
        border: `1.5px dashed ${file ? color : '#e5e5e5'}`, borderRadius: 12,
        padding: '18px 16px', cursor: 'pointer', textAlign: 'center',
        background: file ? '#fafffe' : '#fafafa', transition: 'all 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = file ? color : '#e5e5e5')}
      >
        <div style={{ fontSize: 22, marginBottom: 6 }}>{file ? '✅' : '📂'}</div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 10, color: '#9ca3af' }}>{file ? file.name : hint}</div>
        <input ref={inputRef} type="file" accept=".xlsx" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f5f5f0', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '0.5px solid #e5e5e5', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Προγραμματισμός</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#1a1a1a' }}>Daily Planning</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {step === 2 && (
              <>
                <button onClick={() => { setStep(1); setPlans([]) }} style={{ border: '0.5px solid #e5e5e5', background: 'white', padding: '8px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer', color: '#1a1a1a' }}>
                  ← Νέο Πλάνο
                </button>
                <button onClick={() => window.print()} style={{ background: '#1a1a1a', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  🖨️ Print PDF
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e5e5', padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 14 }}>Ημερομηνία βάρδιας</div>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={inputStyle} />
            </div>

            <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e5e5', padding: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 6 }}>Ανέβασε τα 3 αρχεία</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>Papakias + Overview (τρέχουσα κατάσταση) + Throughput χθες</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <UploadBox label="Papakias" hint="fbs_papakias_view_*.xlsx" file={papakiasFile} onFile={setPapakiasFile} inputRef={papakiasRef} color="#1a1a1a" />
                <UploadBox label="Overview" hint="overview.xlsx" file={overviewFile} onFile={setOverviewFile} inputRef={overviewRef} color="#3b82f6" />
                <UploadBox label="Throughput" hint="throughput_*.xlsx" file={throughputFile} onFile={setThroughputFile} inputRef={throughputRef} color="#22c55e" />
              </div>
            </div>

            {error && <div style={{ padding: '10px 14px', background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>{error}</div>}

            <button onClick={handleGenerate} disabled={loading || !papakiasFile || !overviewFile || !throughputFile}
              style={{ background: (!papakiasFile || !overviewFile || !throughputFile) ? '#e5e5e5' : '#1a1a1a', color: 'white', border: 'none', padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', width: '100%' }}>
              {loading ? 'Επεξεργασία...' : 'Δημιουργία Πλάνου →'}
            </button>
          </div>
        )}

        {/* ── STEP 2: Plans ── */}
        {step === 2 && plans.length > 0 && (
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Overview summary */}
            {overviewData && (
              <div style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e5e5', padding: '14px 18px' }}>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Τρέχουσα Κατάσταση Αποθήκης</div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Πολυγρ. (Ράφι)', val: overviewData.proetoimasia.poly },
                    { label: 'Μονογρ. (Ράφι)', val: overviewData.proetoimasia.mono },
                    { label: 'AutoStore', val: overviewData.proetoimasia.autostore },
                    { label: 'Picked AS', val: overviewData.proetoimasia.picked_as },
                    { label: 'Ογκώδη', val: overviewData.proetoimasia.ogkodi },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 500, color: '#1a1a1a', fontFamily: 'monospace' }}>{val.toLocaleString()}</div>
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', borderLeft: '0.5px solid #f0f0f0', paddingLeft: 16 }}>
                    <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Σύνολο Εκκρεμών</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: '#3b82f6', fontFamily: 'monospace' }}>
                      {(overviewData.proetoimasia.poly + overviewData.proetoimasia.mono + overviewData.proetoimasia.picked_as + overviewData.proetoimasia.ogkodi).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Shift plans */}
            {plans.map((plan, i) => (
              <ShiftPlanCard
                key={plan.time}
                plan={plan}
                expanded={expandedPlan === i}
                onToggle={() => setExpandedPlan(expandedPlan === i ? -1 : i)}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`@media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } }`}</style>
    </div>
  )
}
