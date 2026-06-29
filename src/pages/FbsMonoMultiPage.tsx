import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, TrendingUp, Package, ShoppingCart, BarChart2, Activity, Calendar } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface MonoMultiRow {
  IMEROMINIA: string
  TYPOS: string
  KINISEIS: number
  MONIKESP: number
  TEMAXIA: number
}

interface MonoMultiSnapshot {
  id: number
  generated_at: string
  date_from: string
  date_to: string
  rows: MonoMultiRow[]
}

function formatDate(d: string) {
  const parts = d.split('-')
  return `${parts[2]}/${parts[1]}`
}

function fmt(n: number) {
  return n.toLocaleString('el-GR')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export function FbsMonoMultiPage() {
  const [snapshot, setSnapshot] = useState<MonoMultiSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Date range state — default: today only
  const [dateFrom, setDateFrom] = useState<string>(today())
  const [dateTo, setDateTo]     = useState<string>(today())
  const [activePreset, setActivePreset] = useState<string>('today')

  async function fetchData() {
    setRefreshing(true)
    try {
      const { data, error: err } = await supabase
        .from('mono_multi_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (err) throw err
      setSnapshot(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Preset handlers
  function applyPreset(preset: string) {
    setActivePreset(preset)
    const t = today()
    if (preset === 'today') { setDateFrom(t); setDateTo(t) }
    else if (preset === '3d') { setDateFrom(daysAgo(2)); setDateTo(t) }
    else if (preset === '7d') { setDateFrom(daysAgo(6)); setDateTo(t) }
    else if (preset === 'all' && snapshot) {
      setDateFrom(snapshot.date_from)
      setDateTo(snapshot.date_to)
    }
  }

  // Filtered rows based on selected range
  const rows = useMemo(() => {
    if (!snapshot) return []
    return snapshot.rows.filter(r => r.IMEROMINIA >= dateFrom && r.IMEROMINIA <= dateTo)
  }, [snapshot, dateFrom, dateTo])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Φόρτωση...
      </div>
    )
  }

  if (!snapshot || error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
        <p className="text-sm">Δεν υπάρχουν δεδομένα.</p>
        <p className="text-xs">Εκτελέστε το PowerShell script πρώτα.</p>
      </div>
    )
  }

  // Process filtered rows
  const dates = [...new Set(rows.map(r => r.IMEROMINIA))].sort().reverse()
  const byDate = dates.map(date => {
    const mono = rows.find(r => r.IMEROMINIA === date && r.TYPOS === 'Mono')
    const multi = rows.find(r => r.IMEROMINIA === date && r.TYPOS === 'Multi')
    const totalKiniseis = (mono?.KINISEIS ?? 0) + (multi?.KINISEIS ?? 0)
    const totalMonikesp = (mono?.MONIKESP ?? 0) + (multi?.MONIKESP ?? 0)
    const totalTemaxia  = (mono?.TEMAXIA  ?? 0) + (multi?.TEMAXIA  ?? 0)
    const monoPct  = totalKiniseis > 0 ? ((mono?.KINISEIS ?? 0) / totalKiniseis * 100).toFixed(1) : '0'
    const multiPct = totalKiniseis > 0 ? ((multi?.KINISEIS ?? 0) / totalKiniseis * 100).toFixed(1) : '0'
    return { date, mono, multi, totalKiniseis, totalMonikesp, totalTemaxia, monoPct, multiPct }
  })

  const totalMono  = rows.filter(r => r.TYPOS === 'Mono').reduce((s, r) => s + r.KINISEIS, 0)
  const totalMulti = rows.filter(r => r.TYPOS === 'Multi').reduce((s, r) => s + r.KINISEIS, 0)
  const grandTotal = totalMono + totalMulti
  const monoGrandPct  = grandTotal > 0 ? (totalMono  / grandTotal * 100).toFixed(1) : '0'
  const multiGrandPct = grandTotal > 0 ? (totalMulti / grandTotal * 100).toFixed(1) : '0'
  const totalMonikesp = rows.reduce((s, r) => s + r.MONIKESP, 0)
  const totalTemaxia  = rows.reduce((s, r) => s + r.TEMAXIA,  0)

  // Chart data
  const lineData = [...byDate].reverse().map(d => ({
    date: formatDate(d.date),
    Mono: d.mono?.KINISEIS ?? 0,
    Multi: d.multi?.KINISEIS ?? 0,
    'Σύνολο': d.totalKiniseis,
  }))

  const kiniseisDonut = [
    { name: 'Mono',  value: totalMono  },
    { name: 'Multi', value: totalMulti },
  ]
  const monokespDonut = [
    { name: 'Mono',  value: rows.filter(r => r.TYPOS === 'Mono').reduce((s, r)  => s + r.MONIKESP, 0) },
    { name: 'Multi', value: rows.filter(r => r.TYPOS === 'Multi').reduce((s, r) => s + r.MONIKESP, 0) },
  ]
  const temaxiaDonut = [
    { name: 'Mono',  value: rows.filter(r => r.TYPOS === 'Mono').reduce((s, r)  => s + r.TEMAXIA, 0) },
    { name: 'Multi', value: rows.filter(r => r.TYPOS === 'Multi').reduce((s, r) => s + r.TEMAXIA, 0) },
  ]

  const stackedData = [...byDate].reverse().map(d => {
    const total = d.totalKiniseis
    return {
      date: formatDate(d.date),
      Mono:  total > 0 ? +((d.mono?.KINISEIS  ?? 0) / total * 100).toFixed(1) : 0,
      Multi: total > 0 ? +((d.multi?.KINISEIS ?? 0) / total * 100).toFixed(1) : 0,
    }
  })

  const maxMultiPct = byDate.reduce((max, d) => +d.multiPct > +max.multiPct ? d : max, byDate[0])
  const maxMonoPct  = byDate.reduce((max, d) => +d.monoPct  > +max.monoPct  ? d : max, byDate[0])
  const multiRowsArr = rows.filter(r => r.TYPOS === 'Multi')
  const avgTemMulti  = multiRowsArr.length > 0
    ? (multiRowsArr.reduce((s, r) => s + r.TEMAXIA, 0) / multiRowsArr.length).toFixed(1)
    : '—'
  const maxMultiDay = byDate.reduce((max, d) => (d.multi?.KINISEIS ?? 0) > (max.multi?.KINISEIS ?? 0) ? d : max, byDate[0])

  const DONUT_COLORS = ['#3b82f6', '#22c55e']

  const renderDonut = (data: { name: string; value: number }[], title: string) => (
    <div className="panel flex flex-col">
      <div className="text-sm font-semibold text-slate-700 mb-3">{title}</div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
            {data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Legend iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )

  const presets = [
    { key: 'today', label: 'Σήμερα' },
    { key: '3d',    label: '3 μέρες' },
    { key: '7d',    label: '7 μέρες' },
    { key: 'all',   label: 'Όλα' },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0">
        {/* Title */}
        <div className="flex-shrink-0">
          <div className="text-xs text-slate-400 font-medium mb-0.5">FBS - Outbound</div>
          <h1 className="text-xl font-bold text-slate-800">Mono / Multi Ανάλυση</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ανανεώθηκε {new Date(snapshot.generated_at).toLocaleString('el-GR')}
          </p>
        </div>

        {/* Date Range Picker */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex-1 max-w-lg">
          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />

          {/* Presets */}
          <div className="flex gap-1">
            {presets.map(p => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                  activePreset === p.key
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200 flex-shrink-0" />

          {/* Custom date inputs */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              min={snapshot.date_from}
              max={dateTo}
              onChange={e => { setDateFrom(e.target.value); setActivePreset('custom') }}
              className="text-xs text-slate-600 bg-transparent border-0 outline-none cursor-pointer w-28"
            />
            <span className="text-slate-300 text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={snapshot.date_to}
              onChange={e => { setDateTo(e.target.value); setActivePreset('custom') }}
              className="text-xs text-slate-600 bg-transparent border-0 outline-none cursor-pointer w-28"
            />
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={fetchData}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-1.5 text-xs flex-shrink-0"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Ανανέωση
        </button>
      </div>

      {/* No data for range */}
      {rows.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          Δεν υπάρχουν δεδομένα για το επιλεγμένο εύρος.
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI Cards */}
          <div className="flex gap-4">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500 mb-3">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(grandTotal)}</div>
              <div className="text-xs text-slate-500 mt-1">Συνολικές Κινήσεις</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500 mb-3">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(totalMonikesp)}</div>
              <div className="text-xs text-slate-500 mt-1">Μοναδικές Παραγγελίες</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500 mb-3">
                <Package className="w-4 h-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(totalTemaxia)}</div>
              <div className="text-xs text-slate-500 mt-1">Συνολικά Τεμάχια</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-500 mb-3">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">{monoGrandPct}%</div>
              <div className="text-xs text-slate-500 mt-1">Ποσοστό Mono</div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-500 mb-3">
                <BarChart2 className="w-4 h-4 text-white" />
              </div>
              <div className="text-2xl font-bold text-slate-800 tabular-nums">{multiGrandPct}%</div>
              <div className="text-xs text-slate-500 mt-1">Ποσοστό Multi</div>
            </div>
          </div>

          {/* Table + Line Chart */}
          <div className="grid grid-cols-2 gap-6">
            <div className="panel overflow-auto">
              <div className="text-sm font-semibold text-slate-700 mb-3">Καθημερινή Επισκόπηση</div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left px-2 py-1.5 text-slate-500 font-medium" rowSpan={2}>Ημερομηνία</th>
                    <th className="text-center px-2 py-1 text-blue-600 font-semibold border-b border-blue-100" colSpan={4}>Mono</th>
                    <th className="text-center px-2 py-1 text-emerald-600 font-semibold border-b border-emerald-100" colSpan={4}>Multi</th>
                    <th className="text-center px-2 py-1 text-slate-600 font-semibold border-b border-slate-200" colSpan={3}>Σύνολο</th>
                  </tr>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">Κιν.</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">Μον.Παρ.</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">Τεμ.</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">%</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">Κιν.</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">Μον.Παρ.</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">Τεμ.</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">%</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">Κιν.</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">Μον.Παρ.</th>
                    <th className="px-2 py-1 text-slate-400 font-medium text-right">Τεμ.</th>
                  </tr>
                </thead>
                <tbody>
                  {byDate.map((d, i) => (
                    <tr key={d.date} className={cn('border-b border-slate-100', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                      <td className="px-2 py-1.5 text-slate-600 font-medium whitespace-nowrap">{formatDate(d.date)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmt(d.mono?.KINISEIS ?? 0)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmt(d.mono?.MONIKESP ?? 0)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmt(d.mono?.TEMAXIA ?? 0)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-blue-600 font-medium">{d.monoPct}%</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmt(d.multi?.KINISEIS ?? 0)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmt(d.multi?.MONIKESP ?? 0)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmt(d.multi?.TEMAXIA ?? 0)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-600 font-medium">{d.multiPct}%</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 font-semibold">{fmt(d.totalKiniseis)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 font-semibold">{fmt(d.totalMonikesp)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 font-semibold">{fmt(d.totalTemaxia)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-slate-300 bg-blue-50 font-semibold text-blue-700">
                    <td className="px-2 py-1.5">Σύνολο</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(totalMono)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(rows.filter(r => r.TYPOS === 'Mono').reduce((s, r) => s + r.MONIKESP, 0))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(rows.filter(r => r.TYPOS === 'Mono').reduce((s, r) => s + r.TEMAXIA, 0))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{monoGrandPct}%</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(totalMulti)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(rows.filter(r => r.TYPOS === 'Multi').reduce((s, r) => s + r.MONIKESP, 0))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(rows.filter(r => r.TYPOS === 'Multi').reduce((s, r) => s + r.TEMAXIA, 0))}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{multiGrandPct}%</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(grandTotal)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(totalMonikesp)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(totalTemaxia)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panel flex flex-col">
              <div className="text-sm font-semibold text-slate-700 mb-3">Εξέλιξη Κινήσεων</div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => v.toLocaleString('el-GR')} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend iconType="circle" iconSize={8} />
                  <Line type="monotone" dataKey="Mono"   stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Multi"  stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Σύνολο" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donuts + Stacked bar */}
          <div className="grid grid-cols-4 gap-4">
            {renderDonut(kiniseisDonut, 'Κατανομή Κινήσεων')}
            {renderDonut(monokespDonut, 'Κατανομή Μοναδικών Παραγγελιών')}
            {renderDonut(temaxiaDonut, 'Κατανομή Τεμαχίων')}
            <div className="panel flex flex-col">
              <div className="text-sm font-semibold text-slate-700 mb-3">Mono vs Multi Trend (%)</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stackedData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend iconType="circle" iconSize={8} />
                  <Bar dataKey="Mono"  stackId="a" fill="#3b82f6" />
                  <Bar dataKey="Multi" stackId="a" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Key Insights */}
          {byDate.length > 0 && (
            <div>
              <div className="text-sm font-semibold text-slate-700 mb-3">Key Insights</div>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-400 mb-1">Υψηλότερο % Multi</div>
                  <div className="text-lg font-bold text-emerald-600 tabular-nums">{maxMultiPct?.multiPct}%</div>
                  <div className="text-xs text-slate-500 mt-0.5">{maxMultiPct ? formatDate(maxMultiPct.date) : '—'}</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-400 mb-1">Υψηλότερο % Mono</div>
                  <div className="text-lg font-bold text-blue-600 tabular-nums">{maxMonoPct?.monoPct}%</div>
                  <div className="text-xs text-slate-500 mt-0.5">{maxMonoPct ? formatDate(maxMonoPct.date) : '—'}</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-400 mb-1">Μέσος Τεμ. / Multi Ημέρα</div>
                  <div className="text-lg font-bold text-violet-600 tabular-nums">{avgTemMulti}</div>
                  <div className="text-xs text-slate-500 mt-0.5">ανά ημέρα</div>
                </div>
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                  <div className="text-xs text-slate-400 mb-1">Ημέρα με Υψηλότερο Multi</div>
                  <div className="text-lg font-bold text-teal-600 tabular-nums">{fmt(maxMultiDay?.multi?.KINISEIS ?? 0)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{maxMultiDay ? formatDate(maxMultiDay.date) : '—'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
