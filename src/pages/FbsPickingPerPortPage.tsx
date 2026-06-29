import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, Layers, ShoppingBag, Package, TrendingUp, BarChart2, Calendar } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface PickingPortRow {
  IMEROMINIA: string
  STATHMOS: string
  SUBORDERS: number
  ORDERS: number
  TEMAXIA: number
}

interface PickingPortSnapshot {
  id: number
  generated_at: string
  date_from: string
  date_to: string
  rows: PickingPortRow[]
}

interface PortMonitoringRow {
  ORA: string | number  // hour 0-23
  STATHMOS: string
  SUBORDERS: number
}

interface PortMonitoringSnapshot {
  id: number
  generated_at: string
  rows: PortMonitoringRow[]
}

const PORTS = ['Port 1', 'Port 2', 'Port 3', 'Port 4', 'Port 5']
const PORT_COLORS: Record<string, string> = {
  'Port 1': '#3b82f6',
  'Port 2': '#22c55e',
  'Port 3': '#f59e0b',
  'Port 4': '#8b5cf6',
  'Port 5': '#ef4444',
}

function fmt(n: number) {
  return n.toLocaleString('el-GR')
}

function fmtPct(part: number, total: number) {
  if (total === 0) return '—'
  return (part / total * 100).toFixed(1) + '%'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { key: 'today', label: 'Σήμερα' },
  { key: '3d',    label: '3 μέρες' },
  { key: '7d',    label: '7 μέρες' },
  { key: 'all',   label: 'Όλα' },
]

export function FbsPickingPerPortPage() {
  const [snapshot, setSnapshot] = useState<PickingPortSnapshot | null>(null)
  const [portData, setPortData] = useState<PortMonitoringSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dateFrom, setDateFrom] = useState<string>(today())
  const [dateTo, setDateTo]     = useState<string>(today())
  const [activePreset, setActivePreset] = useState<string>('today')

  function applyPreset(preset: string, snap?: PickingPortSnapshot | null) {
    const s = snap ?? snapshot
    setActivePreset(preset)
    const t = today()
    if (preset === 'today') { setDateFrom(t); setDateTo(t) }
    else if (preset === '3d') { setDateFrom(daysAgo(2)); setDateTo(t) }
    else if (preset === '7d') { setDateFrom(daysAgo(6)); setDateTo(t) }
    else if (preset === 'all' && s) { setDateFrom(s.date_from); setDateTo(s.date_to) }
  }

  async function fetchData() {
    setRefreshing(true)
    try {
      const { data, error } = await supabase
        .from('picking_port_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (!error && data) {
        setSnapshot(data)
        applyPreset(activePreset, data)
      }

      const { data: pm } = await supabase
        .from('port_monitoring_snapshots')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (pm) setPortData(pm)
    } catch (_) {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Filtered rows based on date range
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

  if (!snapshot) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400">
        <p className="text-sm">Δεν υπάρχουν δεδομένα.</p>
        <p className="text-xs">Εκτελέστε το PowerShell script πρώτα.</p>
      </div>
    )
  }

  // Port summary
  const portSummary = PORTS.map(port => {
    const portRows = rows.filter(r => r.STATHMOS === port)
    const suborders = portRows.reduce((s, r) => s + r.SUBORDERS, 0)
    const orders = portRows.reduce((s, r) => s + r.ORDERS, 0)
    const temaxia = portRows.reduce((s, r) => s + r.TEMAXIA, 0)
    return { port, suborders, orders, temaxia, color: PORT_COLORS[port] }
  })

  const totalSuborders = portSummary.reduce((s, p) => s + p.suborders, 0)
  const totalOrders = portSummary.reduce((s, p) => s + p.orders, 0)
  const totalTemaxia = portSummary.reduce((s, p) => s + p.temaxia, 0)
  const avgSubPerOrder = totalOrders > 0 ? (totalSuborders / totalOrders).toFixed(2) : '—'
  const avgTemPerOrder = totalOrders > 0 ? (totalTemaxia / totalOrders).toFixed(2) : '—'

  // Hourly chart data from port_monitoring
  let hourlyData: Record<string, any>[] = []
  if (portData?.rows?.length) {
    const hoursMap: Record<string, Record<string, number>> = {}
    portData.rows.forEach(r => {
      const h = String(r.ORA).padStart(2, '0') + ':00'
      if (!hoursMap[h]) hoursMap[h] = {}
      hoursMap[h][r.STATHMOS] = (hoursMap[h][r.STATHMOS] ?? 0) + r.SUBORDERS
    })
    hourlyData = Object.entries(hoursMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, ports]) => ({ hour, ...ports }))
  }

  // Time zone table
  const timeZones = [
    { label: '00:00–06:00', hours: [0, 1, 2, 3, 4, 5] },
    { label: '06:00–12:00', hours: [6, 7, 8, 9, 10, 11] },
    { label: '12:00–18:00', hours: [12, 13, 14, 15, 16, 17] },
    { label: '18:00–24:00', hours: [18, 19, 20, 21, 22, 23] },
  ]

  const tzSummary = portData?.rows?.length
    ? timeZones.map(tz => {
        const portTotals: Record<string, number> = {}
        PORTS.forEach(p => { portTotals[p] = 0 })
        let zoneTotalSub = 0
        portData.rows.forEach(r => {
          const h = +r.ORA
          if (tz.hours.includes(h)) {
            portTotals[r.STATHMOS] = (portTotals[r.STATHMOS] ?? 0) + r.SUBORDERS
            zoneTotalSub += r.SUBORDERS
          }
        })
        return { label: tz.label, portTotals, zoneTotalSub }
      })
    : null

  // Donut data
  const subDonut = portSummary.map(p => ({ name: p.port, value: p.suborders, color: p.color }))
  const temDonut = portSummary.map(p => ({ name: p.port, value: p.temaxia, color: p.color }))

  // Grouped bar for Suborders vs Orders
  const groupedBarData = portSummary.map(p => ({
    port: p.port.replace('Port ', 'P'),
    Suborders: p.suborders,
    Orders: p.orders,
    fill: p.color,
  }))

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between flex-shrink-0">
        <div>
          <div className="text-xs text-slate-400 font-medium mb-0.5">FBS - Outbound</div>
          <h1 className="text-xl font-bold text-slate-800">Picking ανά Port</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Δεδομένα: {snapshot.date_from} — {snapshot.date_to} · Ανανεώθηκε {new Date(snapshot.generated_at).toLocaleString('el-GR')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date range picker */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <div className="flex items-center gap-1">
              {PRESETS.map(p => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium transition-colors',
                    activePreset === p.key
                      ? 'bg-blue-500 text-white'
                      : 'text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="w-px h-4 bg-slate-200" />
            <input
              type="date"
              value={dateFrom}
              min={snapshot.date_from}
              max={dateTo}
              onChange={e => { setDateFrom(e.target.value); setActivePreset('') }}
              className="text-xs text-slate-600 bg-transparent border-none outline-none cursor-pointer"
            />
            <span className="text-xs text-slate-400">—</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={snapshot.date_to}
              onChange={e => { setDateTo(e.target.value); setActivePreset('') }}
              className="text-xs text-slate-600 bg-transparent border-none outline-none cursor-pointer"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Ανανέωση
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="flex gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500 mb-3">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(totalSuborders)}</div>
            <div className="text-xs text-slate-500 mt-1">Σύνολο Suborders</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500 mb-3">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{fmt(totalOrders)}</div>
            <div className="text-xs text-slate-500 mt-1">Σύνολο Orders</div>
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
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{avgSubPerOrder}</div>
            <div className="text-xs text-slate-500 mt-1">Μέσος Sub/Order</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-500 mb-3">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{avgTemPerOrder}</div>
            <div className="text-xs text-slate-500 mt-1">Μέσος Τεμ/Order</div>
          </div>
        </div>

        {/* Table + Hourly Chart */}
        <div className="grid grid-cols-2 gap-6">
          {/* Port Summary Table */}
          <div className="panel overflow-auto">
            <div className="text-sm font-semibold text-slate-700 mb-3">Σύνοψη Picking ανά Port</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-2 py-1.5 text-slate-500 font-medium">Port</th>
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">Suborders</th>
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">%</th>
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">Orders</th>
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">%</th>
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">Τεμάχια</th>
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">%</th>
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">Sub/Ord</th>
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">Τεμ/Ord</th>
                </tr>
              </thead>
              <tbody>
                {portSummary.map((p, i) => (
                  <tr key={p.port} className={cn('border-b border-slate-100', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                    <td className="px-2 py-1.5 text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        {p.port}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmt(p.suborders)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{fmtPct(p.suborders, totalSuborders)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmt(p.orders)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{fmtPct(p.orders, totalOrders)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{fmt(p.temaxia)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">{fmtPct(p.temaxia, totalTemaxia)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{p.orders > 0 ? (p.suborders / p.orders).toFixed(2) : '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{p.orders > 0 ? (p.temaxia / p.orders).toFixed(2) : '—'}</td>
                  </tr>
                ))}
                {/* Totals */}
                <tr className="border-t-2 border-slate-300 bg-blue-50 font-semibold text-blue-700">
                  <td className="px-2 py-1.5">Σύνολο</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt(totalSuborders)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">100%</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt(totalOrders)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">100%</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt(totalTemaxia)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">100%</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{avgSubPerOrder}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{avgTemPerOrder}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Hourly bar chart */}
          <div className="panel flex flex-col">
            <div className="text-sm font-semibold text-slate-700 mb-3">Suborders ανά Ώρα και Port</div>
            {hourlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} />
                  {PORTS.map(p => (
                    <Bar key={p} dataKey={p} stackId="a" fill={PORT_COLORS[p]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                <p className="text-sm">Δεδομένα ωριαίας παρακολούθησης μη διαθέσιμα.</p>
                <p className="text-xs">Εκτελέστε το script για live data.</p>
              </div>
            )}
          </div>
        </div>

        {/* Middle row: 3 charts */}
        <div className="grid grid-cols-3 gap-4">
          {/* Donut: Suborders */}
          <div className="panel flex flex-col">
            <div className="text-sm font-semibold text-slate-700 mb-3">Κατανομή Suborders ανά Port</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={subDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {subDonut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Donut: Temaxia */}
          <div className="panel flex flex-col">
            <div className="text-sm font-semibold text-slate-700 mb-3">Τεμάχια ανά Port</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={temDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={3}>
                  {temDonut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend iconType="circle" iconSize={8} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Grouped Bar: Suborders vs Orders */}
          <div className="panel flex flex-col">
            <div className="text-sm font-semibold text-slate-700 mb-3">Suborders vs Orders ανά Port</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={groupedBarData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="port" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="Suborders" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Orders" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time Zone Table */}
        {tzSummary ? (
          <div className="panel overflow-auto">
            <div className="text-sm font-semibold text-slate-700 mb-3">Αναλυτική Ανάλυση ανά Ζώνη Ώρας</div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-2 py-1.5 text-slate-500 font-medium">Ζώνη</th>
                  {PORTS.map(p => (
                    <th key={p} className="text-right px-2 py-1.5 font-medium" style={{ color: PORT_COLORS[p] }}>{p}</th>
                  ))}
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">Σύνολο</th>
                  <th className="text-right px-2 py-1.5 text-slate-500 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {tzSummary.map((tz, i) => {
                  const grandTzTotal = tzSummary.reduce((s, z) => s + z.zoneTotalSub, 0)
                  return (
                    <tr key={tz.label} className={cn('border-b border-slate-100', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                      <td className="px-2 py-1.5 text-slate-600 font-medium whitespace-nowrap">{tz.label}</td>
                      {PORTS.map(p => (
                        <td key={p} className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                          {fmt(tz.portTotals[p] ?? 0)}
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 font-semibold">{fmt(tz.zoneTotalSub)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{fmtPct(tz.zoneTotalSub, grandTzTotal)}</td>
                    </tr>
                  )
                })}
                {/* Totals */}
                <tr className="border-t-2 border-slate-300 bg-blue-50 font-semibold text-blue-700">
                  <td className="px-2 py-1.5">Σύνολο</td>
                  {PORTS.map(p => (
                    <td key={p} className="px-2 py-1.5 text-right tabular-nums">
                      {fmt(tzSummary.reduce((s, tz) => s + (tz.portTotals[p] ?? 0), 0))}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {fmt(tzSummary.reduce((s, tz) => s + tz.zoneTotalSub, 0))}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="panel">
            <div className="text-sm font-semibold text-slate-700 mb-2">Αναλυτική Ανάλυση ανά Ζώνη Ώρας</div>
            <p className="text-xs text-slate-400">Εκτελέστε το script για live data ωριαίας παρακολούθησης.</p>
          </div>
        )}
      </div>
    </div>
  )
}
