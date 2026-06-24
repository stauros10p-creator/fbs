// src/pages/EmployeeDetailPage.tsx — Employee profile with role tabs

import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, Minus, Package, Zap, Clock, Star } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, BarChart, Bar, Cell,
} from 'recharts'
import { useAppStore } from '@/store'
import { useProductivityData, nameMatch, type DayRow } from '@/lib/useProductivityData'
import { cn, initials } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  picker:   { label: 'Picker',   color: '#3b82f6', bg: '#eff6ff' },
  packer:   { label: 'Packer',   color: '#22c55e', bg: '#f0fdf4' },
  operator: { label: 'Operator', color: '#f59e0b', bg: '#fffbeb' },
}

type Preset = '7d' | '30d' | 'month' | 'custom'

function toStr(d: Date) { return d.toISOString().substring(0, 10) }

function firstOfMonth() {
  const d = new Date(); d.setDate(1); return toStr(d)
}

// ── Greek day name ────────────────────────────────────────────────────────────
const GR_DAYS = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο']

function grDay(dateStr: string) {
  return GR_DAYS[new Date(dateStr + 'T12:00:00').getDay()]
}

function fmtDate(s: string) {
  const d = new Date(s + 'T12:00:00')
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

// ── Star display ─────────────────────────────────────────────────────────────
function Stars({ score, color }: { score: number; color: string }) {
  const stars = score >= 80 ? 5 : score >= 65 ? 4 : score >= 50 ? 3 : score >= 35 ? 2 : 1
  return (
    <span style={{ color }}>
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const employees = useAppStore(s => s.employees)
  const employee  = useMemo(() => employees.find(e => e.id === id), [employees, id])

  const { prodSnap, loading, allMetrics } = useProductivityData()

  const [preset, setPreset]         = useState<Preset>('30d')
  const [startDate, setStartDate]   = useState(() => { const d=new Date(); d.setDate(d.getDate()-30); return toStr(d) })
  const [endDate, setEndDate]       = useState(() => toStr(new Date()))
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [roleInitialized, setRoleInitialized] = useState(false)

  const applyPreset = (p: Preset) => {
    setPreset(p)
    const today = new Date()
    if (p === '7d')   { const s=new Date(today); s.setDate(s.getDate()-7);  setStartDate(toStr(s)); setEndDate(toStr(today)) }
    if (p === '30d')  { const s=new Date(today); s.setDate(s.getDate()-30); setStartDate(toStr(s)); setEndDate(toStr(today)) }
    if (p === 'month') { setStartDate(firstOfMonth()); setEndDate(toStr(today)) }
  }

  // ── Detect which roles this employee has data for ─────────────────────────
  // Check _days, _today AND _month — a role tab appears if data exists in any of them
  const availableRoles = useMemo(() => {
    if (!employee || !prodSnap) return []
    const roles: string[] = []
    const hasName = (arr: any[] | undefined) =>
      arr?.some(r => nameMatch(employee.full_name, r.ONOMA)) ?? false
    if (hasName(prodSnap.pickers_days)   || hasName(prodSnap.pickers_today)   || hasName(prodSnap.pickers_month))   roles.push('picker')
    if (hasName(prodSnap.packers_days)   || hasName(prodSnap.packers_today)   || hasName(prodSnap.packers_month))   roles.push('packer')
    if (hasName(prodSnap.operators_days) || hasName(prodSnap.operators_today) || hasName(prodSnap.operators_month)) roles.push('operator')
    return roles
  }, [employee, prodSnap])

  // Auto-select first available role
  useMemo(() => {
    if (availableRoles.length > 0 && !roleInitialized) {
      setSelectedRole(availableRoles[0])
      setRoleInitialized(true)
    }
  }, [availableRoles, roleInitialized])

  // ── Get days for selected role ────────────────────────────────────────────
  const roleDaysSource = useMemo<DayRow[]>(() => {
    if (!prodSnap || !selectedRole) return []
    const arr = selectedRole === 'picker'   ? prodSnap.pickers_days
              : selectedRole === 'packer'   ? prodSnap.packers_days
              : selectedRole === 'operator' ? prodSnap.operators_days
              : undefined
    return (arr ?? []).filter(r =>
      nameMatch(employee?.full_name ?? '', r.ONOMA) &&
      r.DAY >= startDate && r.DAY <= endDate &&
      // exclude short/insignificant sessions and Oracle 24h artifacts
      (r.ORES >= 3 && r.ORDERS > 100 && r.ORES < 20)
    ).sort((a, b) => a.DAY.localeCompare(b.DAY))
  }, [prodSnap, selectedRole, employee, startDate, endDate])

  // ── Daily table data with "vs previous day" ───────────────────────────────
  const tableRows = useMemo(() => {
    return roleDaysSource.map((r, i) => {
      const prevUPH = i > 0 ? roleDaysSource[i - 1].UPH : null
      // compare UPH (rate), not raw orders — avoids volume-driven swings
      const vsPrev = (prevUPH != null && prevUPH > 0 && r.UPH != null)
        ? Math.round(((r.UPH - prevUPH) / prevUPH) * 100) : null
      return { ...r, vsPrev }
    }).reverse() // newest first in display
  }, [roleDaysSource])

  // ── KPIs for selected role ────────────────────────────────────────────────
  const activeDays = roleDaysSource.filter(r => r.UPH != null && r.UPH > 0)
  const totalOrders = roleDaysSource.reduce((s, r) => s + (r.ORDERS ?? 0), 0)
  const totalHours  = roleDaysSource.reduce((s, r) => s + (r.ORES   ?? 0), 0)
  const avgUPH  = totalHours > 0 ? Math.round((totalOrders / totalHours) * 10) / 10 : null
  const avgOrd  = activeDays.length > 0 ? Math.round(totalOrders / activeDays.length) : null
  const bestDay = [...roleDaysSource].sort((a,b) => (b.UPH ?? 0) - (a.UPH ?? 0))[0]
  const bestOrdDay = [...roleDaysSource].sort((a,b) => (b.ORDERS ?? 0) - (a.ORDERS ?? 0))[0]

  // Impact score from allMetrics
  const myMetrics = allMetrics.find(m => m.employee.id === id)
  const impactScore = myMetrics?.impactScore ?? 0
  const accentColor = ROLE_META[selectedRole ?? employee?.primary_role ?? 'picker']?.color ?? '#3b82f6'

  // ── Rank vs others in same role (same period) ─────────────────────────────
  const compData = useMemo(() => {
    if (!prodSnap || !selectedRole) return []
    const arr = selectedRole === 'picker'   ? prodSnap.pickers_days
              : selectedRole === 'packer'   ? prodSnap.packers_days
              : selectedRole === 'operator' ? prodSnap.operators_days
              : undefined
    if (!arr) return []

    const byEmp = new Map<string, { orders: number; hours: number }>()
    arr.filter(r => r.DAY >= startDate && r.DAY <= endDate && (r.UPH ?? 0) > 0)
       .forEach(r => {
         const k = r.ONOMA
         const ex = byEmp.get(k) ?? { orders: 0, hours: 0 }
         ex.orders += r.ORDERS ?? 0
         ex.hours  += r.ORES   ?? 0
         byEmp.set(k, ex)
       })

    return Array.from(byEmp.entries())
      .map(([onoma, v]) => ({
        name: onoma.split(' ')[0],
        fullName: onoma,
        uph: v.hours > 0 ? Math.round((v.orders / v.hours) * 10) / 10 : 0,
        isMe: nameMatch(employee?.full_name ?? '', onoma),
      }))
      .sort((a, b) => b.uph - a.uph)
      .slice(0, 5)
  }, [prodSnap, selectedRole, startDate, endDate, employee])

  const myRank = compData.findIndex(d => d.isMe) + 1

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = roleDaysSource.map(r => ({
    date:   r.DAY.substring(5).replace('-', '/'),
    uph:    r.UPH ?? null,
    orders: r.ORDERS ?? null,
  }))

  if (!employee) return (
    <div className="p-6">
      <button onClick={() => navigate('/team/employees')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-4 h-4" /> Πίσω
      </button>
      <p className="mt-4 text-slate-400">Εργαζόμενος δεν βρέθηκε.</p>
    </div>
  )

  const rm = ROLE_META[employee.primary_role] ?? ROLE_META.picker

  return (
    <div className="min-h-full bg-slate-50">

      {/* ── Back bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <button onClick={() => navigate('/team/employees')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Πίσω στους Εργαζόμενους
        </button>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Top card: identity + rating + rank ──────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-6 flex-wrap">

            {/* Left: Avatar + Name + roles */}
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
                   style={{ background: rm.bg, color: rm.color }}>
                {initials(employee.full_name)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">{employee.full_name}</h1>
                <p className="text-xs text-slate-400 mt-0.5">Main Warehouse · Operations</p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {[employee.primary_role, employee.secondary_role].filter(Boolean).map((role, i) => {
                    const m = ROLE_META[role!]
                    return m ? (
                      <span key={i} className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={{ background: m.bg, color: m.color }}>
                        {i === 0 ? '1ος Ρόλος · ' : '2ος Ρόλος · '}{m.label}
                      </span>
                    ) : null
                  })}
                </div>
              </div>
            </div>

            {/* Center: Impact + Stars */}
            <div className="text-center">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Impact Score</p>
              <div className="text-4xl font-bold text-slate-800">{impactScore}<span className="text-xl text-slate-400">/100</span></div>
              <Stars score={impactScore} color={accentColor} />
              <p className="text-xs text-slate-400 mt-1">{impactScore >= 80 ? 'High Impact' : impactScore >= 60 ? 'Valuable' : 'Developing'}</p>
            </div>

            {/* Right: Rank */}
            {myRank > 0 && (
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Κατάταξη</p>
                <div className="flex items-center justify-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  <div className="text-4xl font-bold text-slate-800">#{myRank}</div>
                </div>
                <p className="text-xs text-slate-400 mt-1">από {compData.length} {ROLE_META[selectedRole ?? '']?.label ?? ''}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Role tabs + date range ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-6 flex-wrap">
          {/* Role tabs */}
          <div className="flex gap-2">
            {loading && <span className="text-xs text-slate-400">Φόρτωση...</span>}
            {availableRoles.map(role => {
              const m = ROLE_META[role]
              const active = selectedRole === role
              return (
                <button key={role} onClick={() => setSelectedRole(role)}
                  className={cn('px-4 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                    active ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  )}
                  style={active ? { background: m.color } : {}}
                >{m.label}</button>
              )
            })}
            {!loading && availableRoles.length === 0 && (
              <span className="text-xs text-slate-400">Τρέξτε το script για δεδομένα</span>
            )}
          </div>

          <div className="w-px h-6 bg-slate-200" />

          {/* Preset buttons */}
          <div className="flex gap-1.5">
            {([['7d','7 Ημέρες'],['30d','30 Ημέρες'],['month','Αυτό το μήνα'],['custom','Προσαρμογή']] as [Preset,string][]).map(([p,l]) => (
              <button key={p} onClick={() => applyPreset(p)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  preset === p ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                )}>{l}</button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2 ml-1">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none" />
              <span className="text-xs text-slate-400">—</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none" />
            </div>
          )}
        </div>

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-4">
          {[
            { icon: <Zap className="w-4 h-4"/>,         label: 'Μέσο Orders/Hour',     value: avgUPH?.toString() ?? '—' },
            { icon: <Package className="w-4 h-4"/>,      label: 'Σύνολο Παραγγελίες',   value: totalOrders.toLocaleString('el-GR') },
            { icon: <Clock className="w-4 h-4"/>,        label: 'Σύνολο Ώρες',          value: totalHours.toFixed(1) + 'h' },
            { icon: <TrendingUp className="w-4 h-4"/>,   label: 'Μέσο Παρ./Ημέρα',      value: avgOrd?.toString() ?? '—' },
            { icon: <Star className="w-4 h-4"/>,         label: 'Ενεργές Ημέρες',        value: `${activeDays.length} / ${roleDaysSource.length}` },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="mb-2" style={{ color: accentColor }}>{k.icon}</div>
              <div className="text-2xl font-bold text-slate-800">{k.value}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* ── Main content: Table + Summary ────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-5">

          {/* Daily table — 2/3 width */}
          <div className="col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Ημερήσια Απόδοση</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['Ημερομηνία','Ημέρα','Παραγγελίες','Orders/Hour','Ώρες','vs Χθες'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tableRows.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                      {loading ? 'Φόρτωση...' : 'Δεν υπάρχουν δεδομένα'}
                    </td></tr>
                  )}
                  {tableRows.map(r => {
                    const hasData = (r.UPH ?? 0) > 0
                    return (
                      <tr key={r.DAY} className={cn('hover:bg-slate-50/80', !hasData && 'opacity-40')}>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600">{fmtDate(r.DAY)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{grDay(r.DAY)}</td>
                        <td className="px-4 py-3 text-xs font-bold font-mono text-slate-800">{r.ORDERS > 0 ? r.ORDERS.toLocaleString('el-GR') : '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold font-mono" style={{ color: hasData ? accentColor : '#cbd5e1' }}>
                            {r.UPH?.toFixed(1) ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{r.ORES > 0 ? r.ORES.toFixed(1)+'h' : '—'}</td>
                        <td className="px-4 py-3 text-xs font-semibold">
                          {r.vsPrev == null ? <span className="text-slate-300">—</span>
                          : r.vsPrev > 0 ? <span className="text-emerald-500 flex items-center gap-0.5"><TrendingUp className="w-3 h-3"/>+{r.vsPrev}%</span>
                          : r.vsPrev < 0 ? <span className="text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3"/>{r.vsPrev}%</span>
                          : <span className="text-slate-400 flex items-center gap-0.5"><Minus className="w-3 h-3"/>0%</span>
                          }
                        </td>
                      </tr>
                    )
                  })}

                  {/* Average row */}
                  {activeDays.length > 0 && (
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                      <td className="px-4 py-3 text-xs font-bold text-slate-600" colSpan={2}>Μέσος Όρος Περιόδου</td>
                      <td className="px-4 py-3 text-xs font-bold font-mono text-slate-800">{avgOrd?.toLocaleString('el-GR') ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold font-mono" style={{ color: accentColor }}>{avgUPH ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-600">
                        {activeDays.length > 0 ? (totalHours / activeDays.length).toFixed(1)+'h' : '—'}
                      </td>
                      <td className="px-4 py-3" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary panel — 1/3 width */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Σύνοψη Περιόδου</h3>
              <div className="space-y-3">
                {[
                  { label: 'Σύνολο Παραγγελίες',   value: totalOrders.toLocaleString('el-GR') },
                  { label: 'Μέσο Παρ./Ημέρα',      value: avgOrd?.toString() ?? '—' },
                  { label: 'Μέσο Orders/Hour',      value: avgUPH?.toString() ?? '—' },
                  { label: 'Σύνολο Ώρες',           value: totalHours.toFixed(1) + 'h' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-xs text-slate-500">{item.label}</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">{item.value}</span>
                  </div>
                ))}
                {bestDay && (
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-xs text-slate-500">Καλύτερη Ημέρα (UPH)</span>
                    <div className="text-right">
                      <div className="text-xs font-bold" style={{ color: accentColor }}>{bestDay.UPH?.toFixed(1)} orders/h</div>
                      <div className="text-[10px] text-slate-400">{fmtDate(bestDay.DAY)}</div>
                    </div>
                  </div>
                )}
                {bestOrdDay && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs text-slate-500">Καλύτερη Ημέρα (Παρ.)</span>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-800">{bestOrdDay.ORDERS} παρ.</div>
                      <div className="text-[10px] text-slate-400">{fmtDate(bestOrdDay.DAY)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Comparison */}
            {compData.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-1">
                  Σύγκριση ({ROLE_META[selectedRole ?? '']?.label ?? ''})
                </h3>
                <p className="text-[10px] text-slate-400 mb-4">vs άλλους {ROLE_META[selectedRole ?? '']?.label ?? ''}s</p>
                <div className="space-y-2">
                  {compData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={cn('text-[10px] font-bold w-4 text-right', d.isMe ? 'text-slate-700' : 'text-slate-400')}>
                        {i + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-[11px] font-medium truncate', d.isMe ? 'text-slate-800' : 'text-slate-500')}>
                          {d.name}
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-0.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                               style={{
                                 width: `${compData[0].uph > 0 ? (d.uph / compData[0].uph) * 100 : 0}%`,
                                 background: d.isMe ? accentColor : '#cbd5e1'
                               }} />
                        </div>
                      </div>
                      <span className={cn('text-xs font-bold font-mono flex-shrink-0', d.isMe ? 'text-slate-800' : 'text-slate-400')}>
                        {d.uph}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Chart ────────────────────────────────────────────────────────── */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">Performance Trend</h2>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: accentColor }} /> Orders/Hour
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full bg-slate-300 inline-block border-dashed" /> Παραγγελίες
                </span>
                {avgUPH && <span style={{ color: accentColor }} className="font-medium">ΜΟ: {avgUPH}</span>}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 5, right: 40, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="uph" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v: number, name: string) => [
                    name === 'uph' ? v.toFixed(1) + ' orders/h' : v.toLocaleString('el-GR') + ' παρ.',
                    name === 'uph' ? 'Orders/Hour' : 'Παραγγελίες',
                  ]}
                />
                {avgUPH != null && (
                  <ReferenceLine yAxisId="uph" y={avgUPH} stroke="#e2e8f0" strokeDasharray="4 4"
                    label={{ position: 'right', value: `ΜΟ ${avgUPH}`, fontSize: 9, fill: '#94a3b8' }} />
                )}
                <Line yAxisId="uph" type="monotone" dataKey="uph"
                  stroke={accentColor} strokeWidth={2.5}
                  dot={{ r: 3, fill: accentColor, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  connectNulls={false} />
                <Line yAxisId="ord" type="monotone" dataKey="orders"
                  stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 2"
                  dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </div>
  )
}
