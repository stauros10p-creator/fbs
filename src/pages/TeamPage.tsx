import { useState, useMemo } from 'react'
import {
  Search, Plus, Coffee, UserX, X, TrendingUp, TrendingDown,
  Minus, Edit2, AlertTriangle,
} from 'lucide-react'
import { WEEKLY_SCHEDULE, SCHEDULE_DAYS, classifyShift } from '@/lib/schedule'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import { useAppStore } from '@/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { RoleBadge } from '@/components/ui/Badge'
import { ROLE_CONFIG, STATUS_CONFIG, SKILL_LABELS } from '@/types'
import type { Employee, EmployeeRole, EmployeeStatus } from '@/types'
import { initials, cn } from '@/lib/utils'
import { useUpdateEmployeeStatus, useRequestBreak } from '@/hooks'
import { EmployeeModal } from '@/components/team/EmployeeModal'
import toast from 'react-hot-toast'

// ── Constants ────────────────────────────────────────────────────────────────

const ROLE_BENCHMARK: Record<string, number> = {
  operator: 190, picker: 77, packer: 80, sorter: 150, transporter: 120,
}

const MONTHS_SHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαϊ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ']

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  working:    { bg: 'bg-green-50 border-green-200',   text: 'text-green-600',  label: 'Εργάζεται' },
  break:      { bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-600',  label: 'Διάλειμμα' },
  sick:       { bg: 'bg-red-50 border-red-200',       text: 'text-red-600',    label: 'Άρρωστος' },
  vacation:   { bg: 'bg-blue-50 border-blue-200',     text: 'text-blue-600',   label: 'Άδεια' },
  off:        { bg: 'bg-slate-50 border-slate-200',   text: 'text-slate-400',  label: 'Ρεπό' },
  redeployed: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-600', label: 'Ανάθεση' },
}

const STATUS_TABS: { key: 'all' | EmployeeStatus; label: string }[] = [
  { key: 'all',        label: 'Όλοι' },
  { key: 'working',   label: 'Εργάζονται' },
  { key: 'break',     label: 'Διάλειμμα' },
  { key: 'sick',      label: 'Άρρωστοι' },
  { key: 'vacation',  label: 'Άδεια' },
  { key: 'off',       label: 'Ρεπό' },
]

// ── Mock data helpers (seeded by employee id for consistency) ─────────────────

function seededVal(seed: number, i: number): number {
  return (Math.sin(seed * 9301 + i * 49297 + 233) * 0.5 + 0.5)
}

function empSeed(emp: Employee): number {
  return emp.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

function getEmpBaseline(emp: Employee): number {
  return emp.productivity?.find(p => p.role === emp.primary_role)?.units_per_hour
    ?? ROLE_BENCHMARK[emp.primary_role]
    ?? 100
}

/** 12-week productivity history */
function getProductivityHistory(emp: Employee) {
  const seed = empSeed(emp)
  const baseline = getEmpBaseline(emp)
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (11 - i) * 7)
    const noise = (seededVal(seed, i) - 0.5) * 0.2   // ±10%
    return {
      week: `W${i + 1}`,
      label: `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`,
      uph: Math.round(baseline * (1 + noise)),
      benchmark: baseline,
    }
  })
}

/** Simulated yesterday UPH */
function getYesterdayUPH(emp: Employee): number {
  const baseline = getEmpBaseline(emp)
  const noise = (seededVal(empSeed(emp), 99) - 0.5) * 0.2
  return Math.round(baseline * (1 + noise))
}


// ── EmployeeDetailPanel ───────────────────────────────────────────────────────

function EmployeeDetailPanel({
  emp, teamAvgYesterday, teamQ3Avg, onEdit, onClose, onBreak, onSick,
}: {
  emp: Employee
  teamAvgYesterday: number
  teamQ3Avg: number
  onEdit: () => void
  onClose: () => void
  onBreak: () => Promise<void>
  onSick: () => Promise<void>
}) {
  const history    = getProductivityHistory(emp)
  const yUPH       = getYesterdayUPH(emp)
  const benchmark  = getEmpBaseline(emp)
  const empSchedule = WEEKLY_SCHEDULE[emp.employee_code] ?? null
  const q3Avg      = Math.round(history.reduce((a, b) => a + b.uph, 0) / history.length)
  const diffYest   = Math.round(((yUPH - teamAvgYesterday) / teamAvgYesterday) * 100)
  const diffQ3     = Math.round(((q3Avg - teamQ3Avg) / teamQ3Avg) * 100)
  const cfg        = STATUS_CONFIG[emp.current_status]
  const trend      = history[11].uph - history[8].uph
  const isAlert    = yUPH < benchmark * 0.85

  const maxUPH = Math.max(yUPH, teamAvgYesterday, benchmark, 1)

  const bars = [
    { label: 'Εργαζόμενος χθες', value: yUPH,               color: '#3b82f6' },
    { label: 'Μέσος ομάδας χθες', value: teamAvgYesterday,   color: '#94a3b8' },
    { label: 'Benchmark ρόλου',   value: benchmark,           color: '#e2e8f0' },
  ]

  return (
    <div className="w-80 flex-shrink-0 bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{
              background: `${ROLE_CONFIG[emp.primary_role]?.color ?? '#6b7280'}18`,
              color: ROLE_CONFIG[emp.primary_role]?.color ?? '#6b7280',
            }}
          >
            {initials(emp.full_name)}
          </div>
          <div>
            <div className="font-semibold text-slate-800 text-sm leading-tight">{emp.full_name}</div>
            <div className="text-xs text-slate-400 font-mono">{emp.employee_code}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Status + Skill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', cfg?.dot ?? 'bg-slate-300')} />
            <span className="text-xs font-medium text-slate-600">{cfg?.label ?? emp.current_status}</span>
          </div>
          <div className="flex gap-0.5" title={SKILL_LABELS[emp.skill_level]}>
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className={cn('w-2.5 h-2.5 rounded-sm', parseInt(emp.skill_level) >= n ? 'bg-green-400' : 'bg-slate-100')} />
            ))}
          </div>
        </div>

        {/* Roles */}
        <div className="flex gap-2 flex-wrap">
          <RoleBadge role={emp.primary_role} />
          {emp.secondary_role && <RoleBadge role={emp.secondary_role} />}
        </div>

        {/* Alert banner */}
        {isAlert && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
            <span className="text-xs text-red-600">Απόδοση χθες &gt;15% κάτω από benchmark</span>
          </div>
        )}

        {/* Yesterday KPIs */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">Χθεσινή vs Ομάδα</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <div className="text-xl font-bold font-mono text-slate-800">{yUPH}</div>
              <div className="text-[10px] text-slate-400">UPH χθες</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <div className="text-xl font-bold font-mono text-slate-400">{teamAvgYesterday}</div>
              <div className="text-[10px] text-slate-400">Μέσος ομάδας</div>
            </div>
            <div className={cn('rounded-lg p-2 text-center', diffYest >= 0 ? 'bg-green-50' : 'bg-red-50')}>
              <div className={cn('text-xl font-bold font-mono', diffYest >= 0 ? 'text-green-600' : 'text-red-500')}>
                {diffYest > 0 ? '+' : ''}{diffYest}%
              </div>
              <div className="text-[10px] text-slate-400">vs Ομάδα</div>
            </div>
          </div>
        </div>

        {/* Quarterly comparison */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">Τρίμηνο (12 εβδ.)</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <div className="text-xl font-bold font-mono text-slate-800">{q3Avg}</div>
              <div className="text-[10px] text-slate-400">UPH μέσος</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 text-center">
              <div className="text-xl font-bold font-mono text-slate-400">{teamQ3Avg}</div>
              <div className="text-[10px] text-slate-400">Μέσος ομάδας</div>
            </div>
            <div className={cn('rounded-lg p-2 text-center', diffQ3 >= 0 ? 'bg-green-50' : 'bg-red-50')}>
              <div className={cn('text-xl font-bold font-mono', diffQ3 >= 0 ? 'text-green-600' : 'text-red-500')}>
                {diffQ3 > 0 ? '+' : ''}{diffQ3}%
              </div>
              <div className="text-[10px] text-slate-400">vs Ομάδα</div>
            </div>
          </div>
        </div>

        {/* Horizontal bar comparison */}
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-2">Σύγκριση χθες</div>
          <div className="space-y-2">
            {bars.map(({ label, value, color }) => (
              <div key={label}>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>{label}</span>
                  <span className="font-mono font-semibold text-slate-700">{value}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (value / (maxUPH * 1.1)) * 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 12-week line chart */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Τάση 12 εβδομάδων</div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              {trend > 2
                ? <><TrendingUp className="w-3 h-3 text-green-500" /><span className="text-green-500">+{Math.round(trend)}</span></>
                : trend < -2
                ? <><TrendingDown className="w-3 h-3 text-red-400" /><span className="text-red-400">{Math.round(trend)}</span></>
                : <><Minus className="w-3 h-3" /><span>Σταθερό</span></>
              }
            </div>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={history} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 9, fill: '#cbd5e1' }} axisLine={false} tickLine={false} />
              <ReferenceLine y={benchmark} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth={1.5} />
              <Line type="monotone" dataKey="uph" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Tooltip
                formatter={(v: number) => [`${v} UPH`, 'Παραγωγή']}
                labelFormatter={(l: string) => history.find(h => h.week === l)?.label ?? l}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0', padding: '4px 8px' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Πρόγραμμα Εβδομάδας</div>
            <div className="text-[9px] text-slate-400">15–21 Ιουν</div>
          </div>
          {empSchedule ? (
            <>
              <div className="grid grid-cols-7 gap-1">
                {SCHEDULE_DAYS.map((day, i) => {
                  const s = classifyShift(empSchedule[i])
                  return (
                    <div key={day} className="text-center" title={s.full ?? 'Ρεπό'}>
                      <div className="text-[9px] text-slate-400 mb-1">{day}</div>
                      <div className={cn('h-9 rounded text-[10px] font-bold flex items-center justify-center', s.bg, s.text)}>
                        {s.label}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2 flex-wrap mt-2">
                {[
                  { bg: 'bg-blue-200',   label: '06–07' },
                  { bg: 'bg-sky-200',    label: '09–11' },
                  { bg: 'bg-amber-200',  label: '13' },
                  { bg: 'bg-purple-200', label: '18 Βράδυ' },
                  { bg: 'bg-red-200',    label: 'Άρρωστος' },
                  { bg: 'bg-slate-100',  label: 'Ρεπό' },
                ].map(({ bg, label }) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={cn('w-2 h-2 rounded', bg)} />
                    <span className="text-[9px] text-slate-400">{label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-slate-400 italic py-2">Δεν υπάρχουν δεδομένα προγράμματος</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <button onClick={onEdit} className="btn-primary text-xs py-2 w-full flex items-center justify-center gap-2">
            <Edit2 className="w-3.5 h-3.5" /> Επεξεργασία Στοιχείων
          </button>
          {emp.current_status === 'working' && (
            <div className="flex gap-2">
              <button
                onClick={onBreak}
                className="btn-secondary text-xs py-1.5 flex-1 flex items-center justify-center gap-1"
              >
                <Coffee className="w-3.5 h-3.5" /> Διάλειμμα
              </button>
              <button
                onClick={onSick}
                className="flex-1 bg-red-50 border border-red-200 text-red-500 text-xs font-medium py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-red-100 transition-colors"
              >
                <UserX className="w-3.5 h-3.5" /> Άρρωστος
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── TeamPage ──────────────────────────────────────────────────────────────────

export function TeamPage() {
  const employees = useAppStore(s => s.employees)
  const [tab,        setTab]        = useState<'all' | EmployeeStatus>('all')
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | 'all'>('all')
  const [showModal,  setShowModal]  = useState(false)
  const [editEmp,    setEditEmp]    = useState<Employee | null>(null)
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)

  const updateStatus = useUpdateEmployeeStatus()
  const requestBreak = useRequestBreak()

  const filtered = employees.filter(e => {
    if (tab !== 'all' && e.current_status !== tab) return false
    if (roleFilter !== 'all' && e.primary_role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return e.full_name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q)
    }
    return true
  })

  // Compute team averages per role (yesterday + quarterly)
  const { roleAvgYesterday, roleQ3Avg } = useMemo(() => {
    const byRole: Record<string, { y: number[]; q: number[] }> = {}
    employees.forEach(emp => {
      const role = emp.primary_role
      if (!byRole[role]) byRole[role] = { y: [], q: [] }
      byRole[role].y.push(getYesterdayUPH(emp))
      const hist = getProductivityHistory(emp)
      byRole[role].q.push(Math.round(hist.reduce((a, b) => a + b.uph, 0) / hist.length))
    })
    const roleAvgYesterday: Record<string, number> = {}
    const roleQ3Avg: Record<string, number> = {}
    Object.entries(byRole).forEach(([role, { y, q }]) => {
      roleAvgYesterday[role] = Math.round(y.reduce((a, b) => a + b, 0) / y.length)
      roleQ3Avg[role]        = Math.round(q.reduce((a, b) => a + b, 0) / q.length)
    })
    return { roleAvgYesterday, roleQ3Avg }
  }, [employees])

  async function handleBreak(emp: Employee, e?: React.MouseEvent) {
    e?.stopPropagation()
    try {
      await requestBreak.mutateAsync({ employee_id: emp.id })
      toast.success(`Διάλειμμα για ${emp.full_name}`)
    } catch {
      toast.error('Αποτυχία αιτήματος διαλείμματος')
    }
  }

  async function handleSick(emp: Employee, e?: React.MouseEvent) {
    e?.stopPropagation()
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
          <button
            onClick={() => { setEditEmp(null); setShowModal(true) }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Προσθήκη
          </button>
        }
      />

      <div className="p-6">
        {/* Status summary cards */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          {Object.entries(STATUS_STYLES).map(([status, style]) => {
            const count = employees.filter(e => e.current_status === status).length
            return (
              <button
                key={status}
                onClick={() => setTab(status as EmployeeStatus)}
                className={cn(
                  'rounded-xl border p-3 text-center transition-all hover:brightness-95',
                  style.bg,
                  tab === status ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                )}
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
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-semibold transition-all',
                  tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as EmployeeRole | 'all')}
            className="input w-36 text-xs"
          >
            <option value="all">Όλοι οι Ρόλοι</option>
            {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
              <option key={role} value={role}>{cfg.label}</option>
            ))}
          </select>

          <div className="relative max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Αναζήτηση ονόματος ή κωδικού…"
              className="input pl-8 text-xs"
            />
          </div>

          <div className="ml-auto text-xs text-slate-400">{filtered.length} εμφανίζονται</div>
        </div>

        {/* Table + detail panel */}
        <div className="flex gap-4 items-start">
          {/* Table */}
          <div className={cn('bg-white rounded-xl border border-slate-200 overflow-hidden min-w-0', selectedEmp ? 'flex-1' : 'w-full')}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Εργαζόμενος', 'Κωδικός', 'Ρόλος', 'Status', 'UPH χθες', 'vs Ομάδα', 'Τάση 3μ', 'Ενέργειες'].map(h => (
                    <th key={h} className="text-left text-[10px] tracking-widest text-slate-400 uppercase px-4 py-3 font-normal whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(emp => {
                  const cfg = STATUS_CONFIG[emp.current_status]
                  const yUPH = getYesterdayUPH(emp)
                  const teamAvg = roleAvgYesterday[emp.primary_role] ?? 100
                  const diffPct = Math.round(((yUPH - teamAvg) / teamAvg) * 100)
                  const hist = getProductivityHistory(emp)
                  const trend = hist[11].uph - hist[8].uph
                  const isAlert = yUPH < getEmpBaseline(emp) * 0.85
                  const isSelected = selectedEmp?.id === emp.id

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmp(isSelected ? null : emp)}
                      className={cn(
                        'hover:bg-slate-50 transition-colors cursor-pointer',
                        isSelected && 'bg-blue-50/70'
                      )}
                    >
                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 relative"
                            style={{
                              background: `${ROLE_CONFIG[emp.primary_role]?.color ?? '#6b7280'}18`,
                              color: ROLE_CONFIG[emp.primary_role]?.color ?? '#6b7280',
                            }}
                          >
                            {initials(emp.full_name)}
                            {isAlert && (
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
                            )}
                          </div>
                          <span className="font-semibold text-slate-800 truncate">{emp.full_name}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-slate-400">{emp.employee_code}</td>

                      <td className="px-4 py-3"><RoleBadge role={emp.primary_role} /></td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-2 h-2 rounded-full', cfg?.dot ?? 'bg-slate-300')} />
                          <span className="text-xs font-medium text-slate-600">{cfg?.label ?? emp.current_status}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {yUPH} <span className="font-normal text-slate-400 text-[10px]">UPH</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className={cn(
                          'text-xs font-semibold',
                          diffPct > 5 ? 'text-green-600' : diffPct < -5 ? 'text-red-500' : 'text-slate-400'
                        )}>
                          {diffPct > 0 ? '+' : ''}{diffPct}%
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {trend > 3
                          ? <TrendingUp className="w-4 h-4 text-green-500" />
                          : trend < -3
                          ? <TrendingDown className="w-4 h-4 text-red-400" />
                          : <Minus className="w-4 h-4 text-slate-300" />
                        }
                      </td>

                      {/* Actions — stopPropagation so row click doesn't fire */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditEmp(emp); setShowModal(true) }}
                            className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Επεξεργασία"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {emp.current_status === 'working' && (
                            <>
                              <button
                                onClick={e => handleBreak(emp, e)}
                                className="p-1.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                title="Διάλειμμα"
                              >
                                <Coffee className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={e => handleSick(emp, e)}
                                className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Άρρωστος"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-sm">
                      Δεν βρέθηκαν εργαζόμενοι
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Detail panel */}
          {selectedEmp && (
            <EmployeeDetailPanel
              emp={selectedEmp}
              teamAvgYesterday={roleAvgYesterday[selectedEmp.primary_role] ?? 100}
              teamQ3Avg={roleQ3Avg[selectedEmp.primary_role] ?? 100}
              onEdit={() => { setEditEmp(selectedEmp); setShowModal(true) }}
              onClose={() => setSelectedEmp(null)}
              onBreak={async () => { await handleBreak(selectedEmp) }}
              onSick={async () => { await handleSick(selectedEmp) }}
            />
          )}
        </div>
      </div>

      {showModal && (
        <EmployeeModal
          employee={editEmp}
          onClose={() => { setShowModal(false); setEditEmp(null) }}
        />
      )}
    </div>
  )
}
                                                                                                                                                                                                                                                                       