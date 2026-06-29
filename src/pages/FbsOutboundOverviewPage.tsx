import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, TrendingUp, Package, ShoppingCart, Layers, Activity } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const PORT_COLORS: Record<string, string> = {
  P1: '#3b82f6',
  P2: '#22c55e',
  P3: '#f59e0b',
  P4: '#8b5cf6',
  P5: '#ef4444',
}

const MONO_COLOR = '#3b82f6'
const MULTI_COLOR = '#22c55e'

interface DlRow {
  WRA: string | number
  SIMERA: number
  XTES: number
  PRIN2: number
  PRIN7: number
}

interface PortRow {
  ZONA: string
  P1: number
  P2: number
  P3: number
  P4: number
  P5: number
  TOTAL: number
}

interface MmRow {
  IMEROMINIA: string
  TYPOS: string
  KINISEIS: number
  MONIKESP: number
  TEMAXIA: number
}

interface PpRow {
  IMEROMINIA: string
  STATHMOS: string
  SUBORDERS: number
  ORDERS: number
  TEMAXIA: number
}

interface OverviewData {
  dlRows: DlRow[]
  portRows: PortRow[]
  mmRows: MmRow[]
  ppRows: PpRow[]
  createdAt: string | null
}

function fmt(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '—'
  return n.toLocaleString('el-GR')
}

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return ((part / total) * 100).toFixed(1) + '%'
}

export function FbsOutboundOverviewPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<OverviewData | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('—')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dlSnap, portSnap, mmSnap, ppSnap] = await Promise.all([
        supabase.from('as_download_snapshots').select('*').order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('port_monitoring_snapshots').select('*').order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('mono_multi_snapshots').select('*').order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('picking_port_snapshots').select('*').order('created_at', { ascending: false }).limit(1).single(),
      ])

      const dlRows: DlRow[] = dlSnap.data?.rows ?? []
      const portRows: PortRow[] = portSnap.data?.rows ?? []
      const mmRows: MmRow[] = mmSnap.data?.rows ?? []
      const ppRows: PpRow[] = ppSnap.data?.rows ?? []

      const createdAt = dlSnap.data?.created_at
        ?? portSnap.data?.created_at
        ?? mmSnap.data?.created_at
        ?? ppSnap.data?.created_at
        ?? null

      setData({ dlRows, portRows, mmRows, ppRows, createdAt })

      if (createdAt) {
        const d = new Date(createdAt)
        setLastUpdated(d.toLocaleString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
      }
    } catch (e) {
      console.error('FbsOutboundOverviewPage load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ─── Derived values ───────────────────────────────────────────────────────

  const totalSimera = data?.dlRows.filter(r => r.WRA !== 'Total').reduce((s, r) => s + (Number(r.SIMERA) || 0), 0) ?? 0

  const totalSuborders = data?.ppRows.reduce((s, r) => s + (Number(r.SUBORDERS) || 0), 0) ?? 0
  const totalOrders    = data?.ppRows.reduce((s, r) => s + (Number(r.ORDERS)    || 0), 0) ?? 0
  const totalTemaxia   = data?.ppRows.reduce((s, r) => s + (Number(r.TEMAXIA)   || 0), 0) ?? 0

  // Mono vs Multi totals from mm
  const monoRows  = data?.mmRows.filter(r => r.TYPOS === 'Mono')  ?? []
  const multiRows = data?.mmRows.filter(r => r.TYPOS === 'Multi') ?? []
  const monoTotal  = monoRows.reduce((s, r)  => s + (Number(r.KINISEIS) || 0), 0)
  const multiTotal = multiRows.reduce((s, r) => s + (Number(r.KINISEIS) || 0), 0)
  const mmTotal = monoTotal + multiTotal

  // Port picking aggregation
  const portMap: Record<string, { suborders: number; orders: number; temaxia: number }> = {}
  for (const r of (data?.ppRows ?? [])) {
    const key = r.STATHMOS ?? 'Unknown'
    if (!portMap[key]) portMap[key] = { suborders: 0, orders: 0, temaxia: 0 }
    portMap[key].suborders += Number(r.SUBORDERS) || 0
    portMap[key].orders    += Number(r.ORDERS)    || 0
    portMap[key].temaxia   += Number(r.TEMAXIA)   || 0
  }
  const portEntries = Object.entries(portMap).sort((a, b) => b[1].suborders - a[1].suborders)

  // Port monitoring zone totals
  const portColTotals = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 }
  for (const r of (data?.portRows ?? [])) {
    portColTotals.P1 += Number(r.P1) || 0
    portColTotals.P2 += Number(r.P2) || 0
    portColTotals.P3 += Number(r.P3) || 0
    portColTotals.P4 += Number(r.P4) || 0
    portColTotals.P5 += Number(r.P5) || 0
  }

  // Download chart: top 10 hours for LineChart
  const dlChartData = (data?.dlRows ?? []).slice(0, 10).map(r => ({
    hour: String(r.WRA),
    SIMERA: Number(r.SIMERA) || 0,
    XTES: Number(r.XTES) || 0,
  })).reverse()

  // Port bar chart data (zone rows, show top 8)
  const portChartData = (data?.portRows ?? []).slice(0, 8).map(r => ({
    zona: String(r.ZONA),
    P1: Number(r.P1) || 0,
    P2: Number(r.P2) || 0,
    P3: Number(r.P3) || 0,
    P4: Number(r.P4) || 0,
    P5: Number(r.P5) || 0,
  }))

  // Donut data
  const mmDonutData = [
    { name: 'Mono', value: monoTotal },
    { name: 'Multi', value: multiTotal },
  ]
  const ppDonutData = portEntries.slice(0, 5).map(([name, v], i) => ({
    name,
    value: v.suborders,
  }))

  const ppDonutColors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444']

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-500">Φόρτωση δεδομένων…</span>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between flex-shrink-0">
        <div>
          <div className="text-xs text-slate-400 font-medium mb-0.5">FBS - Outbound</div>
          <h1 className="text-xl font-bold text-slate-800">FBS - Outbound Reports</h1>
          <p className="text-xs text-slate-400 mt-0.5">Real-time monitoring &amp; analytics for outbound operations</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-400">
            Τελευταία ενημέρωση: {lastUpdated}
          </div>
          <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Ανανέωση
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* KPI Row */}
        <div className="flex gap-4">
          <KpiCard
            icon={<ShoppingCart className="w-4 h-4 text-blue-500" />}
            label="Σύνολο Suborders"
            value={fmt(totalSuborders)}
            color="blue"
          />
          <KpiCard
            icon={<Package className="w-4 h-4 text-emerald-500" />}
            label="Σύνολο Orders"
            value={fmt(totalOrders)}
            color="emerald"
          />
          <KpiCard
            icon={<Layers className="w-4 h-4 text-amber-500" />}
            label="Συνολικά Τεμάχια"
            value={fmt(totalTemaxia)}
            color="amber"
          />
          <KpiCard
            icon={<Activity className="w-4 h-4 text-violet-500" />}
            label="Orders AS Σήμερα"
            value={fmt(totalSimera)}
            color="violet"
          />
          <KpiCard
            icon={<TrendingUp className="w-4 h-4 text-rose-500" />}
            label="Mono %"
            value={mmTotal ? pct(monoTotal, mmTotal) : '—'}
            color="rose"
          />
        </div>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-2 gap-6">

          {/* Section 1: Download AS Throughput */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-slate-400 font-medium">1) Download AS Throughput</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">
                  {totalSimera ? `${fmt(totalSimera)} orders σήμερα` : 'Δεν υπάρχουν δεδομένα ακόμα'}
                </div>
              </div>
              <button
                onClick={() => navigate('/outbound/download-throughput')}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium"
              >
                View Details →
              </button>
            </div>

            {data?.dlRows && data.dlRows.length > 0 ? (
              <>
                {/* Mini table: top 5 rows */}
                <div className="mb-3 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        <th className="px-2 py-1.5 text-left font-medium">Ώρα</th>
                        <th className="px-2 py-1.5 text-right font-medium">Σήμερα</th>
                        <th className="px-2 py-1.5 text-right font-medium">Χθες</th>
                        <th className="px-2 py-1.5 text-right font-medium">Μεταβολή</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dlRows.slice(0, 5).map((r, i) => {
                        const change = r.XTES ? (((Number(r.SIMERA) - Number(r.XTES)) / Number(r.XTES)) * 100) : null
                        return (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-2 py-1.5 text-slate-600">{r.WRA}</td>
                            <td className="px-2 py-1.5 text-right font-medium text-slate-800">{fmt(Number(r.SIMERA))}</td>
                            <td className="px-2 py-1.5 text-right text-slate-500">{fmt(Number(r.XTES))}</td>
                            <td className={cn('px-2 py-1.5 text-right font-medium', change == null ? 'text-slate-400' : change >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                              {change == null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={dlChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="SIMERA" name="Σήμερα" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="XTES" name="Χθες" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-slate-400">
                Δεν υπάρχουν δεδομένα ακόμα
              </div>
            )}
          </div>

          {/* Section 2: Live Port Monitoring */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-slate-400 font-medium">2) Live Port Monitoring</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">
                  {data?.portRows && data.portRows.length > 0
                    ? `${fmt(data.portRows.reduce((s, r) => s + (Number(r.TOTAL) || 0), 0))} συνολικά`
                    : 'Δεν υπάρχουν δεδομένα ακόμα'}
                </div>
              </div>
              <button
                onClick={() => navigate('/outbound/live-port-monitoring')}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium"
              >
                View Details →
              </button>
            </div>

            {data?.portRows && data.portRows.length > 0 ? (
              <>
                {/* Port mini-cards */}
                <div className="flex gap-2 mb-3">
                  {(['P1', 'P2', 'P3', 'P4', 'P5'] as const).map(p => (
                    <div
                      key={p}
                      className="flex-1 rounded-lg p-2 text-center"
                      style={{ backgroundColor: PORT_COLORS[p] + '18' }}
                    >
                      <div className="text-xs font-medium mb-0.5" style={{ color: PORT_COLORS[p] }}>Port {p[1]}</div>
                      <div className="text-sm font-bold text-slate-800">{fmt(portColTotals[p])}</div>
                    </div>
                  ))}
                </div>

                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={portChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="zona" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    {(['P1', 'P2', 'P3', 'P4', 'P5'] as const).map(p => (
                      <Bar key={p} dataKey={p} name={`Port ${p[1]}`} stackId="a" fill={PORT_COLORS[p]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-slate-400">
                Δεν υπάρχουν δεδομένα ακόμα
              </div>
            )}
          </div>

          {/* Section 3: Mono vs Multi */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-slate-400 font-medium">3) Mono vs Multi</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">
                  {mmTotal ? `${fmt(mmTotal)} κινήσεις` : 'Δεν υπάρχουν δεδομένα ακόμα'}
                </div>
              </div>
              <button
                onClick={() => navigate('/outbound/mono-multi')}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium"
              >
                View Details →
              </button>
            </div>

            {mmTotal > 0 ? (
              <>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={mmDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        <Cell fill={MONO_COLOR} />
                        <Cell fill={MULTI_COLOR} />
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MONO_COLOR }} />
                        <span className="text-xs text-slate-500 font-medium">Mono</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800">{pct(monoTotal, mmTotal)}</div>
                      <div className="text-xs text-slate-400">{fmt(monoTotal)} κινήσεις</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MULTI_COLOR }} />
                        <span className="text-xs text-slate-500 font-medium">Multi</span>
                      </div>
                      <div className="text-2xl font-bold text-slate-800">{pct(multiTotal, mmTotal)}</div>
                      <div className="text-xs text-slate-400">{fmt(multiTotal)} κινήσεις</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-slate-400">
                Δεν υπάρχουν δεδομένα ακόμα
              </div>
            )}
          </div>

          {/* Section 4: Picking per Port */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-slate-400 font-medium">4) Picking per Port</div>
                <div className="text-sm font-bold text-slate-800 mt-0.5">
                  {totalSuborders ? `${fmt(totalSuborders)} suborders` : 'Δεν υπάρχουν δεδομένα ακόμα'}
                </div>
              </div>
              <button
                onClick={() => navigate('/outbound/picking-per-port')}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium"
              >
                View Details →
              </button>
            </div>

            {portEntries.length > 0 ? (
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-2">
                  {portEntries.slice(0, 5).map(([port, v], i) => (
                    <div key={port} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ppDonutColors[i] }} />
                      <span className="text-xs text-slate-500 w-16 truncate">{port}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: pct(v.suborders, totalSuborders),
                            backgroundColor: ppDonutColors[i],
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 w-10 text-right">{fmt(v.suborders)}</span>
                      <span className="text-xs text-slate-400 w-10 text-right">{pct(v.suborders, totalSuborders)}</span>
                    </div>
                  ))}
                </div>

                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie
                      data={ppDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={58}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {ppDonutData.map((_, i) => (
                        <Cell key={i} fill={ppDonutColors[i]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-slate-400">
                Δεν υπάρχουν δεδομένα ακόμα
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4 text-xs text-slate-400 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Όλα τα δεδομένα ενημερώνονται κάθε 5 λεπτά
        </div>
      </div>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  color: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose'
}

const KPI_BG: Record<string, string> = {
  blue:    'bg-blue-50 border-blue-100',
  emerald: 'bg-emerald-50 border-emerald-100',
  amber:   'bg-amber-50 border-amber-100',
  violet:  'bg-violet-50 border-violet-100',
  rose:    'bg-rose-50 border-rose-100',
}

function KpiCard({ icon, label, value, color }: KpiCardProps) {
  return (
    <div className={cn('flex-1 rounded-xl border p-4', KPI_BG[color])}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-800">{value}</div>
    </div>
  )
}
