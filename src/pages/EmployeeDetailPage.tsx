// src/pages/EmployeeDetailPage.tsx — Per-employee productivity history

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Calendar, Package, Zap, TrendingUp, Clock } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { useAppStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { nameMatch, type ProdSnapshot } from '@/lib/useProductivityData'
import { ROLE_CONFIG } from '@/types'
import { cn, initials } from '@/lib/utils'

interface DayData {
  date: string        // YYYY-MM-DD
  orders: number | null
  items:  number | null
  uph:    number | null
  hours:  number | null
}

type Preset = '7d' | '30d' | 'custom'

function toDateStr(d: Date) { return d.toISOString().substring(0, 10) }

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const employees = useAppStore(s => s.employees)
  const employee  = useMemo(() => employees.find(e => e.id === id), [employees, id])

  const [preset, setPreset]       = useState<Preset>('30d')
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return toDateStr(d) })
  const [endDate, setEndDate]     = useState(() => toDateStr(new Date()))
  const [history, setHistory]     = useState<DayData[]>([])
  const [loading, setLoading]     = useState(false)

  const applyPreset = (p: Preset) => {
    setPreset(p)
    const today = new Date()
    if (p === '7d')  { const s = new Date(today); s.setDate(s.getDate() - 7);  setStartDate(toDateStr(s)); setEndDate(toDateStr(today)) }
    if (p === '30d') { const s = new Date(today); s.setDate(s.getDate() - 30); setStartDate(toDateStr(s)); setEndDate(toDateStr(today)) }
  }

  useEffect(() => {
    if (!employee) return
    setLoading(true)

    const run = async () => {
      const start = new Date(startDate + 'T00:00:00')
      const end   = new Date(endDate   + 'T23:59:59')

      const { data } = await supabase
        .from('productivity_snapshots')
        .select('payload, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })

      if (!data) { setLoading(false); return }

      // Latest snapshot per calendar day
      const byDay = new Map<string, ProdSnapshot>()
      for (const snap of data) {
        const day = snap.created_at.substring(0, 10)
        if (!byDay.has(day)) byDay.set(day, snap.payload as ProdSnapshot)
      }

      const role = employee.primary_role
      const days: DayData[] = []

      byDay.forEach((payload, date) => {
        const rows =
          role === 'picker'   ? payload.pickers_today
          : role === 'packer' ? payload.packers_today
          : role === 'operator' ? payload.operators_today
          : undefined

        const row = rows?.find(r => nameMatch(employee.full_name, r.ONOMA)) ?? null

        days.push({
          date,
          orders: row?.ORDERS ?? null,
          items:  (row as any)?.ITEMS ?? null,
          uph:    (row?.UPH != null && row.UPH > 0) ? row.UPH : null,
          hours:  row?.ORES   ?? null,
        })
      })

      days.sort((a, b) => a.date.localeCompare(b.date))
      setHistory(days)
      setLoading(false)
    }

    run()
  }, [employee, startDate, endDate])

  // ── Aggregates ───────────────────────────────────────────────────────────────
  const withData    = history.filter(d => d.uph != null)
  const avgUPH      = withData.length ? +(withData.reduce((s, d) => s + (d.uph    ?? 0), 0) / withData.length).toFixed(1) : null
  const avgOrders   = withData.length ? +(withData.reduce((s, d) => s + (d.orders ?? 0), 0) / withData.length).toFixed(0) : null
  const totalOrders = history.reduce((s, d) => s + (d.orders ?? 0), 0)
  const avgItems    = withData.some(d => d.items != null)
    ? +(withData.filter(d => d.items != null).reduce((s, d) => s + (d.items ?? 0), 0) / withData.filter(d => d.items != null).length).toFixed(0)
    : null

  const rc = employee ? ROLE_CONFIG[employee.primary_role] : null

  const chartData = withData.map(d => ({
    date:   d.date.substring(5).replace('-', '/'),
    uph:    d.uph,
    orders: d.orders,
  }))

  // ── Format date helper ───────────────────────────────────────────────────────
  const fmtDate = (s: string) =>
    new Date(s + 'T12:00:00').toLocaleDateString('el-GR', { weekday: 'short', day: '2-digit', month: 'short' })

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
               style={{ background: `${rc?.color}18`, color: rc?.color }}>
            {initials(employee.full_name)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{employee.full_name}</h1>
            <p className="text-xs font-medium" style={{ color: rc?.color }}>{rc?.label}</p>
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
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300" />
              <span className="text-xs text-slate-400">έως</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-slate-300" />
            </div>
          )}
        </div>

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: <Package className="w-4 h-4" />, label: 'Συνολικές Παραγγελίες', value: totalOrders.toLocaleString('el-GR'), sub: `${withData.length} ενεργές ημέρες` },
            { icon: <Zap       className="w-4 h-4" />, label: 'Μέσο Orders/Hour',      value: avgUPH?.toString() ?? '—',            sub: 'μέσος όρος περιόδου' },
            { icon: <TrendingUp className="w-4 h-4" />, label: 'Μέσο Παραγγελίες/Ημέρα', value: avgOrders?.toString() ?? '—',       sub: 'ανά ενεργή ημέρα' },
            { icon: <Clock     className="w-4 h-4" />, label: 'Ενεργές Ημέρες',        value: `${withData.length} / ${history.length}`, sub: 'από τις επιλεγμένες' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="mb-2" style={{ color: rc?.color }}>{k.icon}</div>
              <div className="text-2xl font-bold text-slate-800">{k.value}</div>
              <div className="text-xs font-medium text-slate-600 mt-0.5">{k.label}</div>
              <div className="text-[10px] text-slate-400">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Chart ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Παραγωγικότητα ανά Ημέρα (Orders/Hour)</h2>
            {avgUPH && <span className="text-xs text-slate-400">ΜΟ: <strong style={{ color: rc?.color }}>{avgUPH}</strong></span>}
          </div>
          {chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              {loading ? 'Φόρτωση...' : 'Δεν υπάρχουν δεδομένα για αυτό το εύρος'}
            </div>
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
                  stroke={rc?.color ?? '#3b82f6'} strokeWidth={2.5}
                  dot={{ r: 4, fill: rc?.color, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Per-day table ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Αναλυτικά ανά Ημέρα</h2>
            <span className="text-xs text-slate-400">{history.length} ημέρες στο εύρος</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Ημερομηνία', 'Παραγγελίες', 'Τεμάχια', 'Orders/Hour', 'Ώρες Εργασίας'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">Φόρτωση...</td></tr>
                )}
                {!loading && history.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">Δεν υπάρχουν δεδομένα</td></tr>
                )}
                {!loading && history.map(d => {
                  const hasData = d.uph != null
                  return (
                    <tr key={d.date} className={cn('hover:bg-slate-50/80 transition-colors', !hasData && 'opacity-40')}>
                      <td className="px-5 py-3 text-xs font-medium text-slate-700">{fmtDate(d.date)}</td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-600">{d.orders ?? '—'}</td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-500">{d.items ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-bold font-mono" style={{ color: hasData ? rc?.color : '#cbd5e1' }}>
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
                    <td className="px-5 py-3 text-xs font-bold font-mono text-slate-700">{avgOrders ?? '—'}</td>
                    <td className="px-5 py-3 text-xs font-bold font-mono text-slate-700">{avgItems ?? '—'}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-bold font-mono" style={{ color: rc?.color }}>{avgUPH ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
