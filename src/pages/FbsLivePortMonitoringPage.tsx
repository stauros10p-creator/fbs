import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  RefreshCw, AlertCircle, Layers, Trophy, Zap,
  Activity, TrendingUp,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

interface PortRow {
  ZONA: string
  P1: number
  P2: number
  P3: number
  P4: number
  P5: number
  TOTAL: number
}

interface PortSnapshot {
  id: number
  generated_at: string
  rows: PortRow[]
}

const PORT_COLORS: Record<string, string> = {
  'Port 1': '#3b82f6',
  'Port 2': '#22c55e',
  'Port 3': '#f59e0b',
  'Port 4': '#8b5cf6',
  'Port 5': '#ef4444',
}

const PORT_KEYS = ['P1','P2','P3','P4','P5'] as const
const PORT_LABELS = ['Port 1','Port 2','Port 3','Port 4','Port 5']

const ALERT_ITEMS = [
  { color: 'bg-emerald-500', text: 'Όλα τα ports λειτουργούν κανονικά' },
  { color: 'bg-amber-400',  text: 'Παρακολούθηση φορτίου σε εξέλιξη' },
  { color: 'bg-blue-500',   text: 'Δεδομένα ανανεώνονται κάθε 30 δευτ.' },
]

export function FbsLivePortMonitoringPage() {
  const [snapshot, setSnapshot] = useState<PortSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    const { data, error } = await supabase
      .from('port_monitoring_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!error && data) {
      setSnapshot(data as PortSnapshot)
      setLastUpdated(new Date().toLocaleTimeString('el-GR'))
    } else {
      setSnapshot(null)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), 30_000)
    return () => clearInterval(timer)
  }, [load])

  // Derived
  const rows = snapshot?.rows ?? []
  const lastRow = rows.length > 0 ? rows[rows.length - 1] : null

  const portTotals = PORT_KEYS.map((key, i) => ({
    label: PORT_LABELS[i],
    key,
    total: rows.reduce((s, r) => s + (r[key] ?? 0), 0),
    current: lastRow?.[key] ?? 0,
  }))

  const grandTotal = rows.reduce((s, r) => s + (r.TOTAL ?? 0), 0)
  const activePorts = portTotals.filter(p => p.total > 0).length
  const topPort = [...portTotals].sort((a, b) => b.total - a.total)[0]
  const hoursWithData = rows.filter(r => r.TOTAL > 0).length
  const avgPerHour = hoursWithData > 0 ? Math.round(grandTotal / hoursWithData) : 0

  // Chart data
  const chartData = rows.map(r => ({
    zona: r.ZONA,
    'Port 1': r.P1,
    'Port 2': r.P2,
    'Port 3': r.P3,
    'Port 4': r.P4,
    'Port 5': r.P5,
  }))

  // Donut data
  const donutData = portTotals
    .filter(p => p.total > 0)
    .map(p => ({ name: p.label, value: p.total }))

  // Current hour index (last row)
  const currentRowIndex = rows.length - 1

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Φόρτωση...</div>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between flex-shrink-0">
          <div>
            <div className="text-xs text-slate-400 font-medium mb-0.5">FBS - Outbound</div>
            <h1 className="text-xl font-bold text-slate-800">Live Port Monitoring</h1>
            <p className="text-xs text-slate-400 mt-0.5">Παρακολούθηση suborders ανά port σε πραγματικό χρόνο</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
          <AlertCircle className="w-8 h-8" />
          <p className="text-sm font-medium">Δεν υπάρχουν δεδομένα.</p>
          <p className="text-xs text-slate-400">Εκτελέστε το PowerShell script για να φορτωθούν δεδομένα.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between flex-shrink-0">
        <div>
          <div className="text-xs text-slate-400 font-medium mb-0.5">FBS - Outbound</div>
          <h1 className="text-xl font-bold text-slate-800">Live Port Monitoring</h1>
          <p className="text-xs text-slate-400 mt-0.5">Παρακολούθηση suborders ανά port σε πραγματικό χρόνο</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 font-medium">
            <Activity className="w-3 h-3" />
            Live · ανανέωση κάθε 30"
          </div>
          {lastUpdated && <span className="text-xs text-slate-400">Ενημερώθηκε: {lastUpdated}</span>}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Ανανέωση
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500">
                <Layers className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{grandTotal.toLocaleString('el-GR')}</div>
            <div className="text-xs text-slate-500 mt-1">Σύνολο Suborders</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{grandTotal.toLocaleString('el-GR')}</div>
            <div className="text-xs text-slate-500 mt-1">Συνολικά Orders</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500">
                <Zap className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{activePorts}</div>
            <div className="text-xs text-slate-500 mt-1">Ενεργά Ports</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-500">
                <Trophy className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{topPort?.label ?? '—'}</div>
            <div className="text-xs text-slate-500 mt-1">Top Port</div>
            {topPort && (
              <div className="text-xs text-orange-500 font-medium mt-1">
                {topPort.total.toLocaleString('el-GR')} suborders
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-teal-500">
                <Activity className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{avgPerHour.toLocaleString('el-GR')}</div>
            <div className="text-xs text-slate-500 mt-1">Μέσος Όρος Sub/Ώρα</div>
          </div>
        </div>

        {/* Per-Port Summary Cards */}
        <div className="grid grid-cols-5 gap-4">
          {portTotals.map((port) => {
            const color = PORT_COLORS[port.label]
            const pctOfTotal = grandTotal > 0 ? ((port.total / grandTotal) * 100).toFixed(1) : '0'
            return (
              <div key={port.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-sm font-semibold text-slate-700">{port.label}</span>
                </div>
                <div className="text-xl font-bold text-slate-800 tabular-nums">{port.total.toLocaleString('el-GR')}</div>
                <div className="text-xs text-slate-400 mt-0.5">Σύνολο suborders</div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Τρέχουσα ώρα</div>
                    <div className="text-base font-bold tabular-nums" style={{ color }}>{port.current.toLocaleString('el-GR')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">% Συνόλου</div>
                    <div className="text-base font-bold text-slate-600 tabular-nums">{pctOfTotal}%</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pctOfTotal}%`, background: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Table + Chart */}
        <div className="grid grid-cols-2 gap-6">
          {/* Hourly Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Ωριαία Κατανομή ανά Port</h2>
            </div>
            <div className="overflow-y-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Ζώνη Ώρας</th>
                    {PORT_LABELS.map(l => (
                      <th key={l} className="text-right py-2 px-3 text-xs font-semibold text-slate-500">{l.replace('Port ', 'P')}</th>
                    ))}
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Σύνολο</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, idx) => {
                    const rowPct = grandTotal > 0 ? ((r.TOTAL / grandTotal) * 100).toFixed(1) : '0'
                    const isCurrent = idx === currentRowIndex
                    return (
                      <tr
                        key={r.ZONA}
                        className={cn('transition-colors', isCurrent ? 'bg-blue-50' : 'hover:bg-slate-50')}
                      >
                        <td className={cn('py-2 px-3 font-medium text-xs', isCurrent ? 'text-blue-700' : 'text-slate-700')}>
                          {r.ZONA}
                          {isCurrent && <span className="ml-1 text-blue-500 text-xs">●</span>}
                        </td>
                        {PORT_KEYS.map((k, ki) => (
                          <td key={k} className="py-2 px-3 text-right tabular-nums text-slate-600 text-xs">
                            <span style={{ color: r[k] > 0 ? PORT_COLORS[PORT_LABELS[ki]] : undefined }}>
                              {r[k].toLocaleString('el-GR')}
                            </span>
                          </td>
                        ))}
                        <td className={cn('py-2 px-3 text-right tabular-nums font-semibold text-xs', isCurrent ? 'text-blue-700' : 'text-slate-800')}>
                          {r.TOTAL.toLocaleString('el-GR')}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-slate-400 text-xs">{rowPct}%</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-200">
                  <tr>
                    <td className="py-2 px-3 font-bold text-slate-700 text-xs">ΣΥΝΟΛΟ</td>
                    {PORT_KEYS.map((k, ki) => (
                      <td key={k} className="py-2 px-3 text-right tabular-nums font-bold text-xs" style={{ color: PORT_COLORS[PORT_LABELS[ki]] }}>
                        {rows.reduce((s, r) => s + (r[k] ?? 0), 0).toLocaleString('el-GR')}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-800 text-xs">{grandTotal.toLocaleString('el-GR')}</td>
                    <td className="py-2 px-3 text-right text-slate-400 text-xs">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Stacked Bar Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Suborders ανά Ώρα &amp; Port</h2>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="zona"
                  tick={{ fontSize: 9 }}
                  tickFormatter={(v: string) => v.split('-')[0]}
                  interval={1}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => v.toLocaleString('el-GR')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {PORT_LABELS.map(label => (
                  <Bar key={label} dataKey={label} stackId="ports" fill={PORT_COLORS[label]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-3 gap-6">
          {/* Donut */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Κατανομή Suborders ανά Port</h2>
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.name} fill={PORT_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => v.toLocaleString('el-GR')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Port Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Port</h2>
            {topPort ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
                  style={{ background: PORT_COLORS[topPort.label] + '20' }}
                >
                  <Trophy className="w-8 h-8" style={{ color: PORT_COLORS[topPort.label] }} />
                </div>
                <div className="text-3xl font-bold text-slate-800" style={{ color: PORT_COLORS[topPort.label] }}>
                  {topPort.label}
                </div>
                <div className="text-2xl font-bold text-slate-800 tabular-nums">
                  {topPort.total.toLocaleString('el-GR')}
                </div>
                <div className="text-xs text-slate-400">suborders</div>
                <div className="mt-3 px-4 py-1.5 rounded-full text-sm font-semibold" style={{ background: PORT_COLORS[topPort.label] + '15', color: PORT_COLORS[topPort.label] }}>
                  {grandTotal > 0 ? ((topPort.total / grandTotal) * 100).toFixed(1) : 0}% του συνόλου
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Δεν υπάρχουν δεδομένα</div>
            )}
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Ειδοποιήσεις</h2>
            <div className="space-y-3">
              {ALERT_ITEMS.map((alert, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5', alert.color)} />
                  <span className="text-sm text-slate-600">{alert.text}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-400">
                Τελευταία ανανέωση: {lastUpdated || '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
