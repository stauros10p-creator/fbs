import { useState, useMemo, useEffect } from 'react'
import {
  Search, Plus, Coffee, UserX, X, TrendingUp, TrendingDown,
  Minus, Edit2, AlertTriangle, Upload, Zap,
} from 'lucide-react'
import { SCHEDULE_DAYS, classifyShift } from '@/lib/schedule'
import { useWeekShifts } from '@/hooks'
import { ScheduleImportModal } from '@/components/team/ScheduleImportModal'
import type { Shift } from '@/types'
import { useAppStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { PageHeader } from '@/components/ui/PageHeader'
import { RoleBadge } from '@/components/ui/Badge'
import { ROLE_CONFIG, STATUS_CONFIG, SKILL_LABELS } from '@/types'
import type { Employee, EmployeeRole, EmployeeStatus } from '@/types'
import { initials, cn } from '@/lib/utils'
import { useUpdateEmployeeStatus, useRequestBreak } from '@/hooks'
import { EmployeeModal } from '@/components/team/EmployeeModal'
import toast from 'react-hot-toast'

// ── Productivity types ────────────────────────────────────────────────────────
interface ProdRow      { ONOMA: string; ORDERS: number; ORES: number; UPH: number }
interface ProdMonthRow { ONOMA: string; UPH_AVG: number; ORDERS_AVG: number }
interface ProdSnapshot {
  pickers_today:          ProdRow[]
  pickers_month:          ProdMonthRow[]
  packers_today:          ProdRow[]
  packers_month:          ProdMonthRow[]
  team_avg_pickers_today: number | null
  team_avg_pickers_month: number | null
  team_avg_packers_today: number | null
  team_avg_packers_month: number | null
}

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
    const noise = (seededVal(seed, i) - 0.5) * 0.2
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

// ── Greek name normalization ──────────────────────────────────────────────────
function normGreek(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
// Oracle format: "Firstname Lastname" → match on surname (last word) only
// App format: "LASTNAME FIRSTNAME" → surname is first part
function nameMatch(empName: string, oracleNoma: string): boolean {
  const parts = oracleNoma.trim().split(/\s+/)
  const surname = parts[parts.length - 1]
  return surname.length > 3 && normGreek(empName).includes(normGreek(surname))
}

// ── EmployeeDetailPanel ───────────────────────────────────────────────────────
function EmployeeDetailPanel({
  emp, weekShifts, prodSnap, onEdit, onClose, onBreak, onSick,
}: {
  emp: Employee
  weekShifts: Record<string, (Shift | null)[]> | undefined
  prodSnap: ProdSnapshot | null
  onEdit: () => void
  onClose: () => void
  onBreak: () => Promise<void>
  onSick: () => Promise<void>
}) {
  const empShifts = weekShifts?.[emp.id] ?? null
  const cfg       = STATUS_CONFIG[emp.current_status]

  const isPicker = emp.primary_role === 'picker' || emp.secondary_role === 'picker'
  const isPacker = emp.primary_role === 'packer' || emp.secondary_role === 'packer'

  const todayRows = isPicker ? prodSnap?.pickers_today : isPacker ? prodSnap?.packers_today : []
  const monthRows = isPicker ? prodSnap?.pickers_month : isPacker ? prodSnap?.packers_month : []
  const teamToday = isPicker ? prodSnap?.team_avg_pickers_today : isPacker ? prodSnap?.team_avg_packers_today : null
  const teamMonth = isPicker ? prodSnap?.team_avg_pickers_month : isPacker ? prodSnap?.team_avg_packers_month : null

  const todayRow = todayRows?.find(r => nameMatch(emp.full_name, r.ONOMA)) ?? null
  const monthRow = monthRows?.find(r => nameMatch(emp.full_name, r.ONOMA)) ?? null

  const liveUPH  = todayRow?.UPH ?? null
  const monthUPH = monthRow?.UPH_AVG ?? null
  const hasProd  = (isPicker || isPacker) && prodSnap !== null

  const diffVsTeamToday = liveUPH && teamToday
    ? Math.round(((liveUPH - teamToday) / teamToday) * 100) : null
  const diffVsTeamMonth = monthUPH && teamMonth
    ? Math.round(((monthUPH - teamMonth) / teamMonth) * 100) : null

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

        {/* Live WMS Productivity */}
        {hasProd && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3 h-3 text-amber-500" />
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Παραγωγικότητα WMS (Orders/h)</div>
            </div>

            {/* Today live */}
            <div className="mb-2">
              <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Σήμερα live</div>
              {todayRow ? (
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                    <div className="text-xl font-bold font-mono text-amber-600">{liveUPH}</div>
                    <div className="text-[9px] text-slate-400">Orders/h</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold font-mono text-slate-500">{todayRow.ORDERS}</div>
                    <div className="text-[9px] text-slate-400">Παραγγελίες</div>
                  </div>
                  <div className={cn('rounded-lg p-2 text-center', diffVsTeamToday == null ? 'bg-slate-50' : diffVsTeamToday >= 0 ? 'bg-green-50' : 'bg-red-50')}>
                    {diffVsTeamToday != null ? (
                      <>
                        <div className={cn('text-xl font-bold font-mono', diffVsTeamToday >= 0 ? 'text-green-600' : 'text-red-500')}>
                          {diffVsTeamToday > 0 ? '+' : ''}{diffVsTeamToday}%
                        </div>
                        <div className="text-[9px] text-slate-400">vs Ομάδα ({teamToday})</div>
                      </>
                    ) : (
                      <>
                        <div className="text-lg font-bold font-mono text-slate-400">—</div>
                        <div className="text-[9px] text-slate-400">vs Ομάδα</div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-2 text-center bg-slate-50 rounded-lg">
                  Δεν εργάστηκε σήμερα ακόμα
                </div>
              )}
            </div>

            {/* Month avg */}
            <div>
              <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Μέσος Όρος 30 ημερών</div>
              {monthRow ? (
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                    <div className="text-xl font-bold font-mono text-blue-600">{monthUPH}</div>
                    <div className="text-[9px] text-slate-400">Orders/h</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold font-mono text-slate-500">{monthRow.ORDERS_AVG}</div>
                    <div className="text-[9px] text-slate-400">Παρ./ημέρα</div>
                  </div>
                  <div className={cn('rounded-lg p-2 text-center', diffVsTeamMonth == null ? 'bg-slate-50' : diffVsTeamMonth >= 0 ? 'bg-green-50' : 'bg-red-50')}>
                    {diffVsTeamMonth != null ? (
                      <>
                        <div className={cn('text-xl font-bold font-mono', diffVsTeamMonth >= 0 ? 'text-green-600' : 'text-red-500')}>
                          {diffVsTeamMonth > 0 ? '+' : ''}{diffVsTeamMonth}%
                        </div>
                        <div className="text-[9px] text-slate-400">vs Ομάδα ({teamMonth})</div>
                      </>
                    ) : (
                      <>
                        <div className="text-lg font-bold font-mono text-slate-400">—</div>
                        <div className="text-[9px] text-slate-400">vs Ομάδα</div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic py-2 text-center bg-slate-50 rounded-lg">
                  Δεν υπάρχουν δεδομένα μήνα
                </div>
              )}
            </div>
          </div>
        )}

        {/* Weekly schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">Πρόγραμμα Εβδομάδας</div>
            <div className="text-[9px] text-slate-400">15–21 Ιουν</div>
          </div>
          {empShifts ? (
            <>
              <div className="grid grid-cols-7 gap-1">
                {SCHEDULE_DAYS.map((day, i) => {
                  const shift = empShifts[i]
                  const shiftStr = shift
                    ? `${shift.start_time.slice(0, 5)}-${shift.end_time.slice(0, 5)}`
                    : (emp.current_status === 'sick' ? 'sick' : null)
                  const s = classifyShift(shiftStr)
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
            <div className="text-xs text-slate-400 italic py-3 text-center">Δεν έχει γίνει import πρόγραμμα αυτή την εβδομάδα</div>
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
  const [showImport, setShowImport] = useState(false)
  const [editEmp,    setEditEmp]    = useState<Employee | null>(null)
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const { data: weekShifts } = useWeekShifts()
  const [prodSnap, setProdSnap] = useState<ProdSnapshot | null>(null)

  useEffect(() => {
    supabase.from('productivity_snapshots')
      .select('*').order('generated_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data?.payload) setProdSnap(data.payload as ProdSnapshot) })
  }, [])

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

  // Compute team averages per role (for list display)
  const roleAvgYesterday = useMemo(() => {
    const byRole: Record<string, number[]> = {}
    employees.forEach(emp => {
      const role = emp.primary_role
      if (!byRole[role]) byRole[role] = []
      byRole[role].push(getYesterdayUPH(emp))
    })
    const result: Record<string, number> = {}
    Object.entries(byRole).forEach(([role, vals]) => {
      result[role] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    })
    return result
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Upload className="w-4 h-4" /> Import Πρόγραμμα
            </button>
            <button
              onClick={() => { setEditEmp(null); setShowModal(true) }}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Προσθήκη
            </button>
          </div>
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
              weekShifts={weekShifts}
              prodSnap={prodSnap}
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
      {showImport && (
        <ScheduleImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}
