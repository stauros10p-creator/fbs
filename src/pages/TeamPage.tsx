import { useState, useMemo, Fragment } from 'react'
import {
  Search, Plus, Coffee, UserX, Upload, Star,
  TrendingUp, Edit2, ChevronUp, ChevronDown,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { useAppStore } from '@/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { RoleBadge } from '@/components/ui/Badge'
import { ROLE_CONFIG, STATUS_CONFIG } from '@/types'
import type { Employee, EmployeeRole, EmployeeStatus, Shift } from '@/types'
import { initials, cn } from '@/lib/utils'
import { useUpdateEmployeeStatus, useRequestBreak, useWeekShifts } from '@/hooks'
import { EmployeeModal } from '@/components/team/EmployeeModal'
import { ScheduleImportModal } from '@/components/team/ScheduleImportModal'
import toast from 'react-hot-toast'

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_BENCHMARK: Record<string, number> = {
  operator: 190, picker: 77, packer: 80, sorter: 150, transporter: 120,
}

const MONTHS_SHORT = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']

const SKILL_NAMES: Record<string, string> = {
  '5': 'Expert', '4': 'Advanced', '3': 'Good enough', '2': 'Developing', '1': 'Beginner',
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  working:    { bg: 'bg-green-50 border-green-200',   text: 'text-green-600',  label: 'Εργάζεται' },
  break:      { bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-600',  label: 'Διάλειμμα' },
  sick:       { bg: 'bg-red-50 border-red-200',       text: 'text-red-600',    label: 'Άρρωστος' },
  vacation:   { bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-600',   label: 'Άδεια' },
  off:        { bg: 'bg-slate-50 border-slate-200',   text: 'text-slate-400',  label: 'Ρεπό' },
  redeployed: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-600', label: 'Ανάθεση' },
}

const STATUS_TABS: { key: 'all' | EmployeeStatus; label: string }[] = [
  { key: 'all',       label: 'Όλοι' },
  { key: 'working',   label: 'Εργάζονται' },
  { key: 'break',     label: 'Διάλειμμα' },
  { key: 'sick',      label: 'Άρρωστοι' },
  { key: 'vacation',  label: 'Άδεια' },
  { key: 'off',       label: 'Ρεπό' },
]

const SLA_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7']
const PER_PAGE = 20

// ── Helpers ────────────────────────────────────────────────────────────────────

function seededVal(seed: number, i: number): number {
  return Math.sin(seed * 9301 + i * 49297 + 233) * 0.5 + 0.5
}
function empSeed(emp: Employee): number {
  return emp.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}
function getEmpBaseline(emp: Employee): number {
  return emp.productivity?.find(p => p.role === emp.primary_role)?.units_per_hour
    ?? ROLE_BENCHMARK[emp.primary_role] ?? 100
}
function getProductivityPct(emp: Employee): number {
  const baseline = getEmpBaseline(emp)
  const noise = (seededVal(empSeed(emp), 99) - 0.5) * 0.2
  return Math.round((1 + noise) * 100)
}
function getAttendancePct(emp: Employee): number {
  return Math.round(85 + seededVal(empSeed(emp), 200) * 15)
}
function getTeam(emp: Employee): string {
  const ab = empSeed(emp) % 2 === 0 ? 'A' : 'B'
  switch (emp.primary_role) {
    case 'picker':      return `Picking Team ${ab}`
    case 'packer':      return `Packing Team ${ab}`
    case 'operator':    return `Ops Team ${ab}`
    case 'sorter':      return 'Sorting Team'
    case 'transporter': return 'Transport Team'
    default:            return `Team ${ab}`
  }
}
function getHireDate(emp: Employee): string {
  const s = empSeed(emp)
  const y = 2019 + (s % 5)
  const m = String((s % 12) + 1).padStart(2, '0')
  const d = String((s % 28) + 1).padStart(2, '0')
  return `${d}/${m}/${y}`
}
function getSecondarySkill(emp: Employee): number {
  if (!emp.secondary_role) return 1
  const offset = Math.floor(seededVal(empSeed(emp), 77) * 2.5)
  return Math.max(1, parseInt(emp.skill_level) - offset)
}
function getHistory30(emp: Employee) {
  const seed = empSeed(emp)
  const now = new Date()
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (29 - i))
    const noise = (seededVal(seed, i) - 0.5) * 0.3
    return {
      day: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`,
      pct: Math.max(40, Math.round((1 + noise) * 100)),
    }
  })
}
function getSummary(emp: Employee) {
  const s = empSeed(emp)
  return {
    totalShifts:  40 + (s % 30),
    hoursWorked:  300 + (s % 200),
    breakTime:    `${20 + (s % 15)}h ${((s % 4) * 15).toString().padStart(2,'0')}m`,
    overtime:     `${s % 20}h ${((s % 4) * 15).toString().padStart(2,'0')}m`,
    absences:     s % 4 === 0 ? 1 : 0,
  }
}
function getSla(emp: Employee) {
  const s = empSeed(emp)
  return [
    { name: 'Due Date',  value: `${90 + (s % 10)}.${s % 9}%`,        color: SLA_COLORS[0] },
    { name: 'Same Day',  value: `${88 + ((s+1) % 12)}.${(s+1)%8}%`,  color: SLA_COLORS[1] },
    { name: 'Intra Day', value: `${85 + ((s+2) % 13)}.${(s+2)%7}%`,  color: SLA_COLORS[2] },
    { name: 'Bulky',     value: `${82 + ((s+3) % 15)}.${(s+3)%6}%`,  color: SLA_COLORS[3] },
  ]
}
function getBreakdown(emp: Employee) {
  const s = empSeed(emp)
  const b = getEmpBaseline(emp)
  return [
    { label: 'Lines/Hour',    display: String(b + (s % 30)),             delta: `+${4 + (s % 15)}%` },
    { label: 'Parcels/Hour',  display: String(Math.round(b*0.95) + (s % 20)), delta: `+${2 + (s % 12)}%` },
    { label: 'Accuracy',      display: `${97 + (s % 3)}.${s % 9}%`,     delta: `+${(s % 3)}.${s % 5}%` },
    { label: 'Quality Score', display: `${93 + (s % 7)}%`,               delta: `+${s % 5}%` },
  ]
}

// ── StarRating ─────────────────────────────────────────────────────────────────

function StarRating({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={cn('w-4 h-4', i <= level ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200')} />
      ))}
    </div>
  )
}

// ── DetailPanel ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'performance' | 'attendance' | 'skills' | 'activity'

function DetailPanel({ emp, weekShifts, todayIdx, onEdit, onBreak, onSick }: {
  emp: Employee
  weekShifts: Record<string, (Shift | null)[]> | undefined
  todayIdx: number
  onEdit: () => void
  onBreak: () => void
  onSick: () => void
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const shift = weekShifts?.[emp.id]?.[todayIdx]
  const shiftStr = shift ? `${shift.start_time.slice(0,5)} - ${shift.end_time.slice(0,5)}` : '—'
  const cfg = STATUS_CONFIG[emp.current_status]
  const history = getHistory30(emp)
  const prodPct = getProductivityPct(emp)
  const summary = getSummary(emp)
  const sla = getSla(emp)
  const breakdown = getBreakdown(emp)
  const primarySkill = parseInt(emp.skill_level)
  const secondarySkill = getSecondarySkill(emp)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',    label: 'Overview' },
    { key: 'performance', label: 'Performance' },
    { key: 'attendance',  label: 'Attendance' },
    { key: 'skills',      label: 'Skills' },
    { key: 'activity',    label: 'Activity Log' },
  ]

  return (
    <div className="bg-slate-50 border-t border-b border-slate-200 p-5">
      {/* Header row */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3.5 mb-4 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: `${ROLE_CONFIG[emp.primary_role]?.color ?? '#6b7280'}20`, color: ROLE_CONFIG[emp.primary_role]?.color ?? '#6b7280' }}
          >{initials(emp.full_name)}</div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-800 text-sm truncate">{emp.full_name}</div>
            <div className="text-[10px] text-slate-400 font-mono">{emp.employee_code}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          Primary Role <RoleBadge role={emp.primary_role} />
        </div>
        {emp.secondary_role && (
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            Secondary Role <RoleBadge role={emp.secondary_role} />
          </div>
        )}
        <div className="text-xs text-slate-500">
          <span className="text-slate-400 mr-1">Team</span>
          <span className="font-medium">{getTeam(emp)}</span>
        </div>
        <div className="text-xs font-mono text-slate-600">
          <span className="text-slate-400 mr-1">Shift</span>{shiftStr}
        </div>
        <div className="flex items-center gap-1.5">
          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg?.dot ?? 'bg-slate-300')} />
          <span className="text-xs font-medium text-slate-700">{cfg?.label ?? emp.current_status}</span>
        </div>
        <div className="text-xs text-slate-500">
          <span className="text-slate-400 mr-1">Hire Date</span>
          <span className="font-medium">{getHireDate(emp)}</span>
        </div>
        <div className="ml-auto flex gap-2 flex-shrink-0">
          <button onClick={onEdit} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          {emp.current_status === 'working' && (
            <>
              <button onClick={onBreak} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <Coffee className="w-3 h-3" /> Break
              </button>
              <button onClick={onSick} className="text-xs py-1.5 px-3 bg-red-50 border border-red-200 text-red-500 rounded-lg flex items-center gap-1.5 hover:bg-red-100 font-medium transition-colors">
                <UserX className="w-3 h-3" /> Sick
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-4 gap-4">
          {/* Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-600 mb-2">Performance (30 days)</div>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 8, fill: '#cbd5e1' }} axisLine={false} tickLine={false} interval={9} />
                <YAxis tick={{ fontSize: 8, fill: '#cbd5e1' }} axisLine={false} tickLine={false} domain={[0, 200]} tickFormatter={(v: number) => `${v}%`} />
                <ReferenceLine y={100} stroke="#e2e8f0" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="pct" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Productivity']} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-mono text-slate-800">{prodPct}%</span>
                <span className="text-[10px] text-slate-400">Avg Productivity</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span className="text-[10px] text-green-500">+{Math.round(seededVal(empSeed(emp), 5) * 10)}% vs previous 30 days</span>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-600 mb-3">Productivity Breakdown</div>
            <div className="space-y-3.5">
              {breakdown.map(b => (
                <div key={b.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{b.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono text-slate-800">{b.display}</span>
                    <span className="text-[10px] text-green-500 flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />{b.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SLA donut */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-600 mb-2">SLA Contribution (30 days)</div>
            <div className="flex items-center gap-2">
              <PieChart width={96} height={96}>
                <Pie data={sla.map(s => ({ ...s, v: parseFloat(s.value) }))}
                  cx={44} cy={44} innerRadius={26} outerRadius={44}
                  dataKey="v" paddingAngle={2}>
                  {sla.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
              </PieChart>
              <div className="space-y-1.5 flex-1">
                {sla.map(s => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-[10px] text-slate-500 flex-1">{s.name}</span>
                    <span className="text-[10px] font-bold font-mono text-slate-700">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-600 mb-3">Summary</div>
            <div className="space-y-2.5">
              {([
                ['Total Shifts',  summary.totalShifts],
                ['Hours Worked',  `${summary.hoursWorked}h`],
                ['Break Time',    summary.breakTime],
                ['Overtime',      summary.overtime],
                ['Absences',      summary.absences],
              ] as [string, string | number][]).map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="text-xs font-bold font-mono text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skills */}
      {tab === 'skills' && (
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <RoleBadge role={emp.primary_role} />
              <span className="text-xs text-slate-400">(Primary)</span>
            </div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-lg font-bold text-slate-800">{SKILL_NAMES[emp.skill_level] ?? 'Expert'}</div>
                <div className="text-xs text-slate-400 mt-0.5">Level {emp.skill_level} / 5</div>
              </div>
              <StarRating level={primarySkill} />
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${primarySkill * 20}%` }} />
            </div>
          </div>

          {emp.secondary_role ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <RoleBadge role={emp.secondary_role} />
                <span className="text-xs text-slate-400">(Secondary)</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-bold text-slate-800">{SKILL_NAMES[String(secondarySkill)] ?? 'Developing'}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Level {secondarySkill} / 5</div>
                </div>
                <StarRating level={secondarySkill} />
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${secondarySkill * 20}%` }} />
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-5 flex items-center justify-center text-slate-400 text-sm">
              No secondary role assigned
            </div>
          )}
        </div>
      )}

      {(tab === 'performance' || tab === 'attendance' || tab === 'activity') && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
          Coming soon
        </div>
      )}
    </div>
  )
}

// ── TeamPage ───────────────────────────────────────────────────────────────────

export function TeamPage() {
  const employees = useAppStore(s => s.employees)
  const [tab,        setTab]        = useState<'all' | EmployeeStatus>('all')
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | 'all'>('all')
  const [showModal,  setShowModal]  = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editEmp,    setEditEmp]    = useState<Employee | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage]             = useState(1)

  const { data: weekShifts } = useWeekShifts()
  const updateStatus = useUpdateEmployeeStatus()
  const requestBreak = useRequestBreak()
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1

  const filtered = useMemo(() => employees.filter(e => {
    if (tab !== 'all' && e.current_status !== tab) return false
    if (roleFilter !== 'all' && e.primary_role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return e.full_name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q)
    }
    return true
  }), [employees, tab, roleFilter, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const pageRows   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function toggleSelect(id: string) {
    setSelectedId(prev => prev === id ? null : id)
  }

  async function handleBreak(emp: Employee) {
    try {
      await requestBreak.mutateAsync({ employee_id: emp.id })
      toast.success(`Διάλειμμα για ${emp.full_name}`)
    } catch { toast.error('Αποτυχία') }
  }

  async function handleSick(emp: Employee) {
    if (!confirm(`Σημείωση ${emp.full_name} ως άρρωστος;`)) return
    await updateStatus.mutateAsync({ id: emp.id, status: 'sick' })
    toast.success(`${emp.full_name} σημειώθηκε ως άρρωστος`)
  }

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Workforce"
        title="TEAM"
        subtitle={`${employees.length} εργαζόμενοι · ${employees.filter(e => e.current_status === 'working').length} εργάζονται`}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
              <Upload className="w-4 h-4" /> Import Πρόγραμμα
            </button>
            <button onClick={() => { setEditEmp(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Προσθήκη
            </button>
          </div>
        }
      />

      <div className="p-6">
        {/* Status summary cards */}
        <div className="grid grid-cols-6 gap-3 mb-5">
          {Object.entries(STATUS_STYLES).map(([status, style]) => {
            const count = employees.filter(e => e.current_status === status).length
            return (
              <button key={status} onClick={() => { setTab(status as EmployeeStatus); setPage(1) }}
                className={cn('rounded-xl border p-3 text-center transition-all hover:brightness-95', style.bg, tab === status ? 'ring-2 ring-offset-1 ring-slate-400' : '')}
              >
                <div className={cn('text-2xl font-bold font-mono', style.text)}>{count}</div>
                <div className="text-xs text-slate-500 mt-0.5">{style.label}</div>
              </button>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-lg p-1">
            {STATUS_TABS.map(({ key, label }) => (
              <button key={key} onClick={() => { setTab(key); setPage(1) }}
                className={cn('px-3 py-1 rounded text-xs font-semibold transition-all',
                  tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}>
                {label}
              </button>
            ))}
          </div>

          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value as EmployeeRole | 'all'); setPage(1) }} className="input w-36 text-xs">
            <option value="all">Όλοι οι Ρόλοι</option>
            {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
              <option key={role} value={role}>{cfg.label}</option>
            ))}
          </select>

          <div className="relative max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Αναζήτηση…" className="input pl-8 text-xs" />
          </div>

          <div className="ml-auto text-xs text-slate-400">{filtered.length} εμφανίζονται</div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Employee','Primary Role','Secondary Role','Team','Shift','Status','Productivity','Attendance',''].map(h => (
                  <th key={h} className="text-left text-[10px] tracking-widest text-slate-400 uppercase px-4 py-3 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map(emp => {
                const cfg    = STATUS_CONFIG[emp.current_status]
                const prod   = getProductivityPct(emp)
                const att    = getAttendancePct(emp)
                const shift  = weekShifts?.[emp.id]?.[todayIdx]
                const shiftS = shift ? `${shift.start_time.slice(0,5)} - ${shift.end_time.slice(0,5)}` : '—'
                const isSel  = selectedId === emp.id

                return (
                  <Fragment key={emp.id}>
                    <tr
                      onClick={() => toggleSelect(emp.id)}
                      className={cn('hover:bg-slate-50 transition-colors cursor-pointer', isSel && 'bg-blue-50/40')}
                    >
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: `${ROLE_CONFIG[emp.primary_role]?.color ?? '#6b7280'}18`, color: ROLE_CONFIG[emp.primary_role]?.color ?? '#6b7280' }}>
                            {initials(emp.full_name)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 text-sm leading-tight">{emp.full_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{emp.employee_code}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3"><RoleBadge role={emp.primary_role} /></td>

                      <td className="px-4 py-3">
                        {emp.secondary_role
                          ? <RoleBadge role={emp.secondary_role} />
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-600">{getTeam(emp)}</td>

                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{shiftS}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full', cfg?.dot ?? 'bg-slate-300')} />
                          <span className="text-xs font-medium text-slate-600">{cfg?.label ?? emp.current_status}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 min-w-[110px]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-mono text-slate-800 w-10 text-right">{prod}%</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, prod)}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 min-w-[110px]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold font-mono text-slate-800 w-10 text-right">{att}%</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', att >= 95 ? 'bg-green-500' : att >= 85 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${att}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleSelect(emp.id)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                          {isSel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {isSel && (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <DetailPanel
                            emp={emp}
                            weekShifts={weekShifts}
                            todayIdx={todayIdx}
                            onEdit={() => { setEditEmp(emp); setShowModal(true) }}
                            onBreak={() => handleBreak(emp)}
                            onSick={() => handleSick(emp)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}

              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400 text-sm">
                    Δεν βρέθηκαν εργαζόμενοι
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
              <div>{(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE, filtered.length)} of {filtered.length}</div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-30">‹</button>
                {Array.from({ length: Math.min(totalPages,7) }, (_,i) => i+1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={cn('w-7 h-7 rounded font-medium', page===p ? 'bg-blue-500 text-white' : 'hover:bg-slate-200 text-slate-600')}>{p}</button>
                ))}
                {totalPages > 7 && <span className="px-1">…</span>}
                <button onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-30">›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <EmployeeModal employee={editEmp} onClose={() => { setShowModal(false); setEditEmp(null) }} />
      )}
      {showImport && (
        <ScheduleImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}

