// src/pages/EmployeeDetailPage.tsx — Per-employee productivity history (role-agnostic)

import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Package, Zap, TrendingUp, Clock } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { useAppStore } from '@/store'
import { useProductivityData, nameMatch, type DayRow } from '@/lib/useProductivityData'
import { cn, initials } from '@/lib/utils'

interface DayEntry {
  date:   string        // YYYY-MM-DD
  role:   string        // 'picker' | 'packer' | 'operator'
  orders: number
  items:  number
  uph:    number | null
  hours:  number
}

type Preset = '7d' | '30d' | 'custom'

function toDateStr(d: Date) { return d.toISOString().substring(0, 10) }

const ROLE_COLORS: Record<string, string> = {
  picker:   '#3b82f6',
  packer:   '#22c55e',
  operator: '#f59e0b',
}
const ROLE_LABELS: Record<string, string> = {
  picker:   'Picker',
  packer:   'Packer',
  operator: 'Operator',
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const employees = useAppStore(s => s.employees)
  const employee  = useMemo(() => employees.find(e => e.id === id), [employees, id])

  const { prodSnap, loading } = useProductivityData()

  const [preset, setPreset]       = useState<Preset>('30d')
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return toDateStr(d) })
  const [endDate, setEndDate]     = useState(() => toDateStr(new Date()))

  const applyPreset = (p: Preset) => {
    setPreset(p)
    const today = new Date()
    if (p === '7d')  { const s = new Date(today); s.setDate(s.getDate() - 7);  setStartDate(toDateStr(s)); setEndDate(toDateStr(today)) }
    if (p === '30d') { const s = new Date(today); s.setDate(s.getDate() - 30); setStartDate(toDateStr(s)); setEndDate(toDateStr(today)) }
  }

  // ── Collect all days for this employee from ALL role arrays ──────────────────
  const allEntries = useMemo<DayEntry[]>(() => {
    if (!employee || !prodSnap) return []

    const entries: DayEntry[] = []

    const collect = (rows: DayRow[] | undefined, role: string) => {
      rows?.forEach(r => {
        if (nameMatch(employee.full_name, r.ONOMA)) {
          if (r.DAY >= startDate && r.DAY <= endDate) {
            entries.push({
              date:   r.DAY,
              role,
              orders: r.ORDERS ?? 0,
              items:  r.ITEMS  ?? 0,
              uph:    (r.UPH != null && r.UPH > 0) ? r.UPH : null,
              hours:  r.ORES   ?? 0,
            })
          }
        }
      })
    }

    collect(prodSnap.pickers_days,   'picker')
    collect(prodSnap.packers_days,   'packer')
    collect(prodSnap.operators_days, 'operator')

    // Sort by date desc
    return entries.sort((a, b) => b.date.localeCompare(a.date))
  }, [employee, prodSnap, startDate, endDate])

  // ── Per-day aggregates (sum orders/items/hours across roles for same day) ───
  const byDay = useMemo(() => {
    const map = new Map<string, { orders: number; items: number; hours: number; uph: number | null; roles: string[] }>()
    for (const e of allEntries) {
      const existing = map.get(e.date)
      if (existing) {
        existing.orders += e.orders
        existing.items  += e.items
        existing.hours  += e.hours
        if (!existing.roles.includes(e.role)) existing.roles.push(e.role)
      } else {
        map.set(e.date, { orders: e.orders, items: e.items, hours: e.hours, uph: e.uph, roles: [e.role] })
      }
    }
    // Recompute UPH from totals
    map.forEach((v, _k) => {
      v.uph = v.hours > 0 ? Math.round((v.orders / v.hours) * 10) / 10 : null
    })
    return Array.from(map.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [allEntries])

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const withData    = byDay.filter(d => d.uph != null && d.orders > 0)
  const totalOrders = byDay.reduce((s, d) => s + d.orders, 0)
  const avgUPH      = withData.length ? +(withData.reduce((s, d) => s + (d.uph ?? 0), 0) / withData.length).toFixed(1) : null
  const avgOrders   = withData.length ? Math.round(withData.reduce((s, d) => s + d.orders, 0) / withData.length) : null
  const avgItems    = withData.length ? Math.round(withData.reduce((s, d) => s + d.items, 0) / withData.length) : null

  const chartData = withData.map(d => ({
    date:   d.date.substring(5).replace('-', '/'),
    uph:    d.uph,
    orders: d.orders,
  }))

  const fmtDate = (s: string) =>
    new Date(s + 'T12:00:00').toLocaleDateString('el-GR', { weekday: 'short', day: '2-digit', month: 'short' })

  // Primary color — use primary role if known, else first found role
  const primaryRole = employee?.primary_role ?? (withData[0]?.roles[0] ?? 'picker')
  const accentColor = ROLE_COLORS[primaryRole] ?? '#3b82f6'

  if (!employee) return (
    <div className="p-6 space-y-3">
      <button onClick={() => navigate('/team/employees')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="w-4 h-4" /> Πίσω στους Εργαζομένους
      </button>
      <p className="text-slate-400">Εργαζόμενος δεν βρέθηκε.</p>
    </div>
  )

  return (
    <div className="min-h-full bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/team/employees')} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
               style={{ background: `${accentColor}18`, color: accentColor }}>
            {initials(employee.full_name)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{employee.full_name}</h1>
            <p className="text-xs font-medium" style={{ color: accentColor }}>{ROLE_LABELS[primaryRole]}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── Date range ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            {([['7d', '7 Ημέρες'], ['30d', '30 Ημέρες'], ['custom', 'Προσαρμογή']] as [Preset, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  preset === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >{label}</button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value) }}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300" />
              <span className="text-xs text-slate-400">έως</span>
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value) }}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300" />
            </div>
          )}
        </div>

        {loading && <div className="text-center py-10 text-slate-400 text-sm">Φόρτωση...</div>}

        {!loading && allEntries.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            Δεν βρέθηκαν δεδομένα για αυτό το εύρος.<br/>
            <span className="text-xs">Τρέξτε το script για να φορτωθούν τα ιστορικά.</span>
          </div>
        )}

        {!loading && allEntries.length > 0 && (
          <>
            {/* ── KPI Cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: <Package className="w-4 h-4" />,    label: 'Συνολικές Παραγγελίες',    value: totalOrders.toLocaleString('el-GR'), sub: `${withData.length} ενεργές ημέρες` },
                { icon: <Zap className="w-4 h-4" />,        label: 'Μέσο Orders/Hour',          value: avgUPH?.toString() ?? '—',           sub: 'μέσος όρος περιόδου' },
                { icon: <TrendingUp className="w-4 h-4" />, label: 'Μέσο Παραγγελίες/Ημέρα',   value: avgOrders?.toString() ?? '—',        sub: 'ανά ενεργή ημέρα' },
                { icon: <Clock className="w-4 h-4" />,      label: 'Ενεργές Ημέρες',            value: `${withData.length} / ${byDay.length}`, sub: 'από τις επιλεγμένες' },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="mb-2" style={{ color: accentColor }}>{k.icon}</div>
                  <div className="text-2xl font-bold text-slate-800">{k.value}</div>
                  <div className="text-xs font-medium text-slate-600 mt-0.5">{k.label}</div>
                  <div className="text-[10px] text-slate-400">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* ── Chart ─────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-700">Παραγωγικότητα ανά Ημέρα (Orders/Hour)</h2>
                {avgUPH && <span className="text-xs text-slate-400">ΜΟ: <strong style={{ color: accentColor }}>{avgUPH}</strong></span>}
              </div>
              {chartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Δεν υπάρχουν δεδομένα</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 0, left: -15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(v: number) => [v.toFixed(1), 'Orders/Hour']}
                    />
                    {avgUPH != null && (
                      <ReferenceLine y={avgUPH} stroke="#e2e8f0" strokeDasharray="4 4"
                        label={{ position: 'right', value: `ΜΟ ${avgUPH}`, fontSize: 9, fill: '#94a3b8' }} />
                    )}
                    <Line
                      type="monotone" dataKey="uph"
                      stroke={accentColor} strokeWidth={2.5}
                      dot={{ r: 4, fill: accentColor, strokeWidth: 0 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── Per-day table ──────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Αναλυτικά ανά Ημέρα</h2>
                <span className="text-xs text-slate-400">{byDay.length} ημέρες στο εύρος</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {['Ημερομηνία', 'Ρόλος', 'Παραγγελίες', 'Τεμάχια', 'Orders/Hour', 'Ώρες'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {byDay.slice().reverse().map(d => {
                      const hasData = d.uph != null && d.orders > 0
                      const roleColor = ROLE_COLORS[d.roles[0]] ?? '#94a3b8'
                      const roleLabel = d.roles.map(r => ROLE_LABELS[r] ?? r).join('+')
                      return (
                        <tr key={d.date} className={cn('hover:bg-slate-50/80 transition-colors', !hasData && 'opacity-40')}>
                          <td className="px-5 py-3 text-xs font-medium text-slate-700">{fmtDate(d.date)}</td>
                          <td className="px-5 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                                  style={{ background: `${roleColor}18`, color: roleColor }}>
                              {roleLabel}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs font-mono text-slate-600">{d.orders > 0 ? d.orders : '—'}</td>
                          <td className="px-5 py-3 text-xs font-mono text-slate-500">{d.items > 0 ? d.items : '—'}</td>
                          <td className="px-5 py-3">
                            <span className="text-xs font-bold font-mono" style={{ color: hasData ? accentColor : '#cbd5e1' }}>
                              {d.uph?.toFixed(1) ?? '—'}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">
                            {d.hours ? `${d.hours.toFixed(1)}h` : '—'}
                          </td>
                        </tr>
                      )
                    })}

                    {/* Average row */}
                    {withData.length > 0 && (
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td className="px-5 py-3 text-xs font-bold text-slate-600">Μέσος Όρος</td>
                        <td className="px-5 py-3"></td>
                        <td className="px-5 py-3 text-xs font-bold font-mono text-slate-700">{avgOrders ?? '—'}</td>
                        <td className="px-5 py-3 text-xs font-bold font-mono text-slate-700">{avgItems ?? '—'}</td>
                        <td className="px-5 py-3">
                          <span className="text-xs font-bold font-mono" style={{ color: accentColor }}>{avgUPH ?? '—'}</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">—</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
