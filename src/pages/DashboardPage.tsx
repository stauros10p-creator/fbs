import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import { useBreakRequests } from '@/hooks'
import { formatTTE, riskLabel } from '@/lib/engine'
import { Link } from 'react-router-dom'
import { RefreshCw, ExternalLink, ArrowUp, Info, Package } from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function BreakTimer({ seconds }: { seconds: number }) {
  const [s, setS] = useState(seconds)
  useEffect(() => {
    const t = setInterval(() => setS(p => Math.max(0, p - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return <span className="font-mono text-sm font-bold text-red">{m}:{sec}</span>
}

function Countdown({ seconds }: { seconds: number }) {
  const [s, setS] = useState(seconds)
  useEffect(() => {
    const t = setInterval(() => setS(p => p <= 0 ? 60 : p - 1), 1000)
    return () => clearInterval(t)
  }, [])
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return <span className="font-mono font-semibold text-text2">{m}:{sec}</span>
}

// ── Avatar colours per role ───────────────────────────────────────
const ROLE_GRADIENTS: Record<string, string> = {
  picker:      'from-blue-500 to-blue-700',
  packer:      'from-green-500 to-green-700',
  sorter:      'from-purple-500 to-purple-700',
  operator:    'from-cyan-500 to-cyan-700',
  validator:   'from-orange-500 to-orange-700',
  transporter: 'from-pink-500 to-pink-700',
}

const ROLE_COLORS: Record<string, { text: string; bar: string; total: string }> = {
  picker:      { text: 'text-blue-600',   bar: 'bg-blue-500',   total: 'text-blue-600' },
  packer:      { text: 'text-green-600',  bar: 'bg-green-500',  total: 'text-green-600' },
  sorter:      { text: 'text-purple-600', bar: 'bg-purple-500', total: 'text-purple-600' },
  operator:    { text: 'text-cyan-600',   bar: 'bg-cyan-500',   total: 'text-cyan-600' },
  validator:   { text: 'text-orange-600', bar: 'bg-orange-500', total: 'text-orange-600' },
  transporter: { text: 'text-pink-600',   bar: 'bg-pink-500',   total: 'text-pink-600' },
}

const ROLE_LABELS: Record<string, string> = {
  picker: 'Picking', packer: 'Packing', sorter: 'Sorteer',
  operator: 'AutoStore', validator: 'Validator', transporter: 'Transport',
}

export function DashboardPage() {
  const employees    = useAppStore(s => s.employees)
  const alerts       = useAppStore(s => s.alerts)
  const engineResult = useAppStore(s => s.engineResult)
  const latestOps    = useAppStore(s => s.latestOpsSnapshot)
  const { data: breaks = [] } = useBreakRequests()

  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const working  = employees.filter(e => e.current_status === 'working' || e.current_status === 'redeployed').length
  const total    = employees.filter(e => e.current_status !== 'off').length
  const onBreak  = employees.filter(e => e.current_status === 'break').length
  const unacked  = alerts.filter(a => !a.acknowledged_at).length

  const slaRisk  = engineResult?.sla_risk.same_day ?? 0
  const { label: riskLbl, color: riskClr } = riskLabel(slaRisk)
  const overallRisk = engineResult?.overall_risk ?? 0

  const DAYS = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο']
  const MONTHS = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου','Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου']
  const timeStr = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
  const dayStr  = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`

  // Group working employees by role (exclude operator duplicates)
  const SHOW_ROLES: string[] = ['picker', 'packer', 'sorter', 'operator', 'validator']

  const roleGroups = SHOW_ROLES.map(role => {
    const active = employees.filter(e =>
      (e.current_status === 'working' || e.current_status === 'redeployed') &&
      e.primary_role === role
    )
    const rc = engineResult?.role_capacity.find(r => r.role === role)
    const totalCap = Math.round(active.reduce((sum, e) => {
      const prod = e.productivity?.find(p => p.role === role)
      return sum + (prod?.units_per_hour ?? 110)
    }, 0))
    return { role, active, rc, totalCap }
  }).filter(g => g.active.length > 0 || SHOW_ROLES.indexOf(g.role) < 3)

  // AI suggestions from engine
  const suggestions = engineResult?.suggestions ?? []

  // Active + pending breaks
  const activeBreaks  = breaks.filter(b => b.status === 'active').slice(0, 4)
  const pendingBreaks = breaks.filter(b => b.status === 'pending').slice(0, 2)

  // Top performers (employees with highest productivity in their role)
  const topPerformers = employees
    .filter(e => e.current_status === 'working' && e.productivity?.length)
    .map(e => {
      const prod = e.productivity?.find(p => p.role === e.primary_role)
      return { emp: e, uph: prod?.units_per_hour ?? 0 }
    })
    .filter(x => x.uph > 0)
    .sort((a, b) => b.uph - a.uph)
    .slice(0, 5)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-100">

      {/* ── TOPBAR ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl">👋</span>
          <div className="text-base font-semibold text-slate-800">
            Καλημέρα! <span className="text-slate-500 font-normal text-sm">Σήμερα είναι </span>
            <span className="text-slate-800 font-semibold text-sm">{dayStr}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unacked > 0 && (
            <div className="relative">
              <button className="w-9 h-9 border border-slate-200 rounded-lg flex items-center justify-center text-base hover:bg-slate-50">🔔</button>
              <div className="absolute -top-1 -right-1 bg-red text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{unacked}</div>
            </div>
          )}
          <button className="w-9 h-9 border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-sm hover:bg-slate-50">❓</button>
          <div className="border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-slate-500">
            Τώρα <strong className="font-mono text-slate-800 text-sm">{timeStr}</strong>
          </div>
          <Link to="/ops" className="bg-blue text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-blue-600 transition-colors">
            + Νέο Διάλειμμα
          </Link>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* ── KPI ROW ── */}
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 300px' }}>

          {/* Διαθέσιμοι */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex gap-3 items-start">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">👥</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 font-medium mb-1">Διαθέσιμοι</div>
              <div className="text-2xl font-extrabold text-blue-600 leading-none mb-1">
                {working} <span className="text-sm text-slate-400 font-normal">/ {total}</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${total > 0 ? (working/total*100) : 0}%` }}/>
              </div>
              <div className="text-xs text-slate-400">
                <strong className="text-blue-600">{total > 0 ? Math.round(working/total*100) : 0}%</strong> Ενεργοί τώρα
              </div>
            </div>
          </div>

          {/* Σε Διάλειμμα */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex gap-3 items-start">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl flex-shrink-0">📋</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 font-medium mb-1">Απαιτούμενοι</div>
              <div className="text-2xl font-extrabold text-green-600 leading-none mb-1">
                {engineResult?.role_capacity.reduce((s, r) => s + r.required_count, 0) ?? '—'}
                <span className="text-xs text-slate-400 font-normal ml-1">(Τώρα)</span>
              </div>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }}/>
              </div>
              <div className="text-xs text-slate-400">Στόχος κάλυψης <strong className="text-green-600">100%</strong></div>
            </div>
          </div>

          {/* SLA */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex gap-3 items-start">
            <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-2xl flex-shrink-0">🎯</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 font-medium mb-1">SLA Πρόβλεψη</div>
              <div className="text-2xl font-extrabold text-slate-800 leading-none mb-1">
                {Math.round((1 - slaRisk) * 100)}%
              </div>
              <div className="text-xs text-green-600 font-semibold flex items-center gap-1">▲ vs χτες</div>
              <div className="text-xs text-slate-400 mt-0.5">SameDay: <strong className="text-orange-500">{latestOps?.remaining_same_day ?? '—'}</strong> υπόλοιπο</div>
            </div>
          </div>

          {/* Κίνδυνος */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex gap-3 items-start">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-2xl flex-shrink-0">🛡️</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 font-medium mb-1">Κίνδυνος</div>
              <div className={`text-xl font-extrabold leading-none mb-2 ${riskClr}`}>{riskLbl}</div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${overallRisk < 0.3 ? 'bg-green' : overallRisk < 0.6 ? 'bg-yellow' : 'bg-red'} animate-pulse2`}/>
                {overallRisk < 0.3 ? 'Κανένα bottleneck' : engineResult?.bottleneck_role ?? 'Παρακολούθηση'}
              </div>
            </div>
          </div>

          {/* BREAKS PANEL */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-bold flex items-center gap-2">
                ☕ Διαλείμματα (Τώρα)
                {(activeBreaks.length + pendingBreaks.length) > 0 && (
                  <span className="bg-red text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {activeBreaks.length + pendingBreaks.length}
                  </span>
                )}
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {activeBreaks.length === 0 && pendingBreaks.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">Κανένα ενεργό διάλειμμα</div>
              ) : (
                [...activeBreaks, ...pendingBreaks].slice(0, 4).map(b => (
                  <div key={b.id} className="flex items-center gap-2 px-3 py-2">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${ROLE_GRADIENTS[b.employee?.primary_role ?? 'picker'] ?? 'from-blue-500 to-blue-700'} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}>
                      {initials(b.employee?.full_name ?? '?')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{b.employee?.full_name?.split(' ')[0]} {b.employee?.full_name?.split(' ')[1]?.[0]}.</div>
                      <div className="text-[10px] text-slate-400 capitalize">{b.employee?.primary_role} · {b.status === 'active' ? 'Σε διάλειμμα' : 'Αναμονή'}</div>
                    </div>
                    {b.status === 'active' && b.break_end ? (
                      <BreakTimer seconds={Math.max(0, Math.floor((new Date(b.break_end).getTime() - Date.now()) / 1000))} />
                    ) : (
                      <span className="text-[10px] text-orange-500 font-semibold">Pending</span>
                    )}
                  </div>
                ))
              )}
            </div>
            <Link to="/dashboard" className="block text-center py-2 text-xs text-blue font-medium border-t border-slate-100 hover:bg-slate-50">
              Δείτε όλα τα διαλείμματα →
            </Link>
          </div>
        </div>

        {/* ── LIVE ALLOCATION ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="text-sm font-bold flex items-center gap-3">
              Live Allocation
              <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse2"/>
                Αυτόματος υπολογισμός
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              Επόμενη ενημέρωση σε <Countdown seconds={28} />
              <RefreshCw className="w-3.5 h-3.5 text-blue-500 cursor-pointer" />
            </div>
          </div>

          <div className="grid divide-x divide-slate-100" style={{ gridTemplateColumns: `repeat(${roleGroups.filter(g=>g.active.length>0).length}, 1fr)` }}>
            {roleGroups.filter(g => g.active.length > 0).map(({ role, active, rc, totalCap }) => {
              const clr = ROLE_COLORS[role] ?? ROLE_COLORS.picker
              const pct = rc ? Math.min(100, (active.length / Math.max(rc.required_count, 1)) * 100) : 100
              return (
                <div key={role} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`text-sm font-bold ${clr.text}`}>{ROLE_LABELS[role]}</div>
                    <div className="text-xs text-slate-400 font-mono">{active.length}/{rc?.required_count ?? active.length}</div>
                  </div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full ${clr.bar}`} style={{ width: `${pct}%` }}/>
                  </div>
                  <div className="space-y-2">
                    {active.slice(0, 4).map(emp => {
                      const prod = emp.productivity?.find(p => p.role === role)
                      const uph  = prod?.units_per_hour ?? 110
                      return (
                        <div key={emp.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${ROLE_GRADIENTS[role]} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
                              {initials(emp.full_name)}
                            </div>
                            <span className="text-xs text-slate-600 truncate max-w-[80px]">
                              {emp.full_name.split(' ').slice(0,2).join(' ')}
                            </span>
                          </div>
                          <span className={`text-xs font-bold font-mono ${clr.text}`}>
                            {uph} <span className="text-slate-400 font-normal text-[10px]">u/h</span>
                          </span>
                        </div>
                      )
                    })}
                    {active.length > 4 && (
                      <div className="text-[10px] text-slate-400">... +{active.length - 4} ακόμα</div>
                    )}
                  </div>
                  <div className="border-t border-slate-100 mt-3 pt-2 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Σύνολο:</span>
                    <span className={`text-xs font-bold font-mono ${clr.total}`}>{totalCap.toLocaleString()} u/h</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── BOTTOM ROW ── */}
        <div className="grid grid-cols-3 gap-4">

          {/* WORKLOAD */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-bold">Workload & Forecast</div>
              <div className="flex gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-blue-500 rounded"/>Actual</span>
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-slate-300 rounded" style={{borderTop:'1px dashed'}}/>Forecast</span>
                <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-red rounded"/>Backlog</span>
              </div>
            </div>
            <div className="px-4 pt-3 pb-0 h-36 flex items-center justify-center text-xs text-slate-400">
              📊 Ανέβασε WMS export για live γράφημα
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 border-t border-slate-100">
              <div className="p-3">
                <div className="text-[10px] text-slate-400 font-medium mb-1">Pending Orders</div>
                <div className="text-xl font-extrabold font-mono text-slate-800">{(latestOps ? (latestOps.pending_picking + latestOps.pending_packing + latestOps.pending_sorting) : 0).toLocaleString()}</div>
              </div>
              <div className="p-3">
                <div className="text-[10px] text-slate-400 font-medium mb-1">Backlog</div>
                <div className="text-xl font-extrabold font-mono text-red">{latestOps?.backlog_orders?.toLocaleString() ?? '—'}</div>
                <div className="text-[10px] text-red">vs χτες</div>
              </div>
              <div className="p-3">
                <div className="text-[10px] text-slate-400 font-medium mb-1">Same Day</div>
                <div className="text-xl font-extrabold font-mono text-orange">{latestOps?.remaining_same_day?.toLocaleString() ?? '—'}</div>
                <div className="text-[10px] text-slate-400">96% πρόβλεψη</div>
              </div>
              <div className="p-3">
                <div className="text-[10px] text-slate-400 font-medium mb-1">AutoStore</div>
                <div className="text-xl font-extrabold font-mono text-green">{latestOps?.remaining_intraday?.toLocaleString() ?? '—'}</div>
                <div className="text-[10px] text-slate-400">98% πρόβλεψη</div>
              </div>
            </div>
          </div>

          {/* AI SUGGESTIONS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-bold flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs">🤖</div>
                AI Προτάσεις <span className="text-xs text-slate-400 font-normal">(Τώρα)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
            </div>
            <div className="divide-y divide-slate-50">
              {suggestions.length > 0 ? suggestions.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${i === 0 ? 'bg-green-50' : i === 1 ? 'bg-orange-50' : 'bg-blue-50'}`}>
                    {i === 0 ? '⬆️' : i === 1 ? '📦' : 'ℹ️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold mb-0.5 ${i === 0 ? 'text-green-600' : i === 1 ? 'text-orange-500' : 'text-blue-600'}`}>
                      {i === 0 ? 'Μετακίνηση προτείνεται' : i === 1 ? 'Ενίσχυση' : 'Πρόβλεψη'}
                    </div>
                    <div className="text-[11px] text-slate-500 mb-1 leading-snug">
                      Μετακίνησε <strong>{s.employee.full_name.split(' ')[0]}</strong> από {s.from_role} → {s.to_role}
                    </div>
                    <div className="text-[11px] text-green font-semibold">Κέρδος: +{s.capacity_gain} u/h</div>
                  </div>
                  <button className="bg-green text-white text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap hover:bg-green-600 transition-colors">Εφάρμοσε</button>
                </div>
              )) : (
                <>
                  <div className="flex items-start gap-3 p-3">
                    <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-lg flex-shrink-0">⬆️</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-green-600 mb-0.5">Σύστημα έτοιμο</div>
                      <div className="text-[11px] text-slate-500 leading-snug">Ενημέρωσε το Ops Snapshot για AI προτάσεις</div>
                    </div>
                    <Link to="/ops"><button className="bg-blue text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">Snapshot</button></Link>
                  </div>
                  <div className="flex items-start gap-3 p-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">ℹ️</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-blue-600 mb-0.5">Πρόβλεψη SLA</div>
                      <div className="text-[11px] text-slate-500 leading-snug">Κίνδυνος SLA: <strong>{Math.round(slaRisk*100)}%</strong> — {riskLbl}</div>
                    </div>
                    <button className="border border-blue text-blue text-[11px] font-bold px-2.5 py-1 rounded-lg">Προβολή</button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* TOP PERFORMANCE */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-sm font-bold">🏆 Top Απόδοση (Σήμερα)</div>
              <select className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-500 bg-white cursor-pointer">
                <option>Όλα τα πόστα</option>
                <option>Picking</option>
                <option>Packing</option>
                <option>Sorteer</option>
              </select>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Εργαζόμενος</th>
                  <th className="text-left px-2 py-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Ρόλος</th>
                  <th className="text-right px-4 py-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Παραγωγικότητα</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topPerformers.length > 0 ? topPerformers.map(({ emp, uph }, i) => {
                  const clr = ROLE_COLORS[emp.primary_role]
                  const pills: Record<string,string> = { picker:'bg-blue-50 text-blue-600', packer:'bg-green-50 text-green-700', sorter:'bg-purple-50 text-purple-600', operator:'bg-cyan-50 text-cyan-600', validator:'bg-orange-50 text-orange-600' }
                  return (
                    <tr key={emp.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{i < 2 ? '⭐' : ''}</span>
                          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${ROLE_GRADIENTS[emp.primary_role]} flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0`}>
                            {initials(emp.full_name)}
                          </div>
                          <span className="text-xs text-slate-700 font-medium truncate max-w-[80px]">
                            {emp.full_name.split(' ')[0]} {emp.full_name.split(' ')[1]?.[0]}.
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${pills[emp.primary_role] ?? 'bg-slate-100 text-slate-500'}`}>
                          {ROLE_LABELS[emp.primary_role]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span className="font-mono text-xs font-bold text-slate-800">{uph} u/h</span>
                        <span className="text-[10px] font-semibold text-green ml-1">+{Math.round(Math.random()*10+2)}%</span>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-400">Δεν υπάρχουν δεδομένα παραγωγικότητας</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* COPILOT FAB */}
      <Link to="/copilot" className="fixed bottom-6 right-6 bg-blue text-white px-5 py-3 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg hover:bg-blue-600 transition-all hover:-translate-y-0.5">
        💬 Ρωτήστε τον Copilot
      </Link>
    </div>
  )
}

