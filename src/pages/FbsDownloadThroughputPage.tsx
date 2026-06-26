import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  RefreshCw, Download, TrendingUp, TrendingDown,
  Clock, BarChart2, AlertCircle, Hash,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

interface AsDownloadRow {
  WRA: string
  SIMERA: number
  XTES: number
  PRIN2: number
  PRIN7: number
}

interface AsDownloadSnapshot {
  id: number
  generated_at: string
  rows: AsDownloadRow[]
}

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444']
const TIME_BLOCKS = [
  { label: '00–06', hours: ['00','01','02','03','04','05'] },
  { label: '06–12', hours: ['06','07','08','09','10','11'] },
  { label: '12–18', hours: ['12','13','14','15','16','17'] },
  { label: '18–24', hours: ['18','19','20','21','22','23'] },
]

function pct(a: number, b: number) {
  if (b === 0) return null
  return ((a - b) / b) * 100
}

function fmtPct(v: number | null) {
  if (v === null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

function PctBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>
  const pos = value >= 0
  return (
    <span className={cn('flex items-center gap-0.5 font-medium', pos ? 'text-emerald-600' : 'text-red-500')}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {fmtPct(value)}
    </span>
  )
}

export function FbsDownloadThroughputPage() {
  const [snapshot, setSnapshot] = useState<AsDownloadSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    const { data, error } = await supabase
      .from('as_download_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!error && data) {
      setSnapshot(data as AsDownloadSnapshot)
      setLastUpdated(new Date().toLocaleTimeString('el-GR'))
    } else {
      setSnapshot(null)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const hourRows = snapshot?.rows.filter(r => r.WRA !== 'Total') ?? []
  const totalRow = snapshot?.rows.find(r => r.WRA === 'Total')

  const totalSimera = totalRow?.SIMERA ?? 0
  const totalXtes = totalRow?.XTES ?? 0
  const nonZeroHours = hourRows.filter(r => r.SIMERA > 0)
  const avgPerHour = nonZeroHours.length > 0 ? Math.round(totalSimera / nonZeroHours.length) : 0
  const maxVal = hourRows.length > 0 ? Math.max(...hourRows.map(r => r.SIMERA)) : 0
  const minVal = nonZeroHours.length > 0 ? Math.min(...nonZeroHours.map(r => r.SIMERA)) : 0
  const zeroHours = hourRows.filter(r => r.SIMERA === 0).length
  const pctVsXtes = pct(totalSimera, totalXtes)

  const chartData = hourRows.map(r => ({
    hour: r.WRA,
    'Σήμερα': r.SIMERA,
    'Χτες': r.XTES,
    '2 Ημ. πριν': r.PRIN2,
    '1 Εβδ. πριν': r.PRIN7,
  }))

  const donutData = TIME_BLOCKS.map(block => ({
    name: block.label,
    value: hourRows
      .filter(r => block.hours.includes(r.WRA))
      .reduce((s, r) => s + r.SIMERA, 0),
  })).filter(d => d.value > 0)

  const top5 = [...hourRows]
    .sort((a, b) => b.SIMERA - a.SIMERA)
    .slice(0, 5)

  const peakHour = hourRows.reduce((best, r) => r.SIMERA > best.SIMERA ? r : best, hourRows[0] ?? { WRA: '—', SIMERA: 0 })
  const block0612 = hourRows.filter(r => ['06','07','08','09','10','11'].includes(r.WRA)).reduce((s, r) => s + r.SIMERA, 0)
  const pct0612 = totalSimera > 0 ? ((block0612 / totalSimera) * 100).toFixed(1) : '0'

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
            <h1 className="text-xl font-bold text-slate-800">Download Throughput</h1>
            <p className="text-xs text-slate-400 mt-0.5">Ανάλυση ωριαίας απόδοσης download orders</p>
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
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between flex-shrink-0">
        <div>
          <div className="text-xs text-slate-400 font-medium mb-0.5">FBS - Outbound</div>
          <h1 className="text-xl font-bold text-slate-800">Download Throughput</h1>
          <p className="text-xs text-slate-400 mt-0.5">Ανάλυση ωριαίας απόδοσης download orders</p>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500">
                <Download className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{totalSimera.toLocaleString('el-GR')}</div>
            <div className="text-xs text-slate-500 mt-1">Σύνολο Download Orders</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500">
                <BarChart2 className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{avgPerHour.toLocaleString('el-GR')}</div>
            <div className="text-xs text-slate-500 mt-1">Μέσος Όρος / Ώρα</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-violet-500">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{maxVal.toLocaleString('el-GR')}</div>
            <div className="text-xs text-slate-500 mt-1">Μέγιστη Ωριαία Τιμή</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-orange-500">
                <TrendingDown className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{minVal.toLocaleString('el-GR')}</div>
            <div className="text-xs text-slate-500 mt-1">Ελάχιστη Ωριαία Τιμή</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-500">
                <Clock className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{zeroHours}</div>
            <div className="text-xs text-slate-500 mt-1">Ώρες με Μηδενικό Download</div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-rose-500">
                <Hash className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 tabular-nums">{fmtPct(pctVsXtes)}</div>
            <div className="text-xs text-slate-500 mt-1">Μεταβολή vs Χτες</div>
            {pctVsXtes !== null && (
              <div className={cn('flex items-center gap-1 text-xs mt-2 font-medium', pctVsXtes >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                {pctVsXtes >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="text-slate-400 font-normal">vs προηγ. ημέρα</span>
              </div>
            )}
          </div>
        </div>

        {/* Table + Chart */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Ωριαία Κατανομή</h2>
            </div>
            <div className="overflow-y-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-4 text-xs font-semibold text-slate-500">Ώρα</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-slate-500">Σήμερα</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-slate-500">Χτες</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-slate-500">2 Ημ. πριν</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-slate-500">1 Εβδ. πριν</th>
                    <th className="text-right py-2 px-4 text-xs font-semibold text-slate-500">vs Χτες</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hourRows.map(r => (
                    <tr key={r.WRA} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-4 font-medium text-slate-700">{r.WRA}:00</td>
                      <td className="py-2 px-4 text-right tabular-nums text-slate-800 font-semibold">{r.SIMERA.toLocaleString('el-GR')}</td>
                      <td className="py-2 px-4 text-right tabular-nums text-slate-500">{r.XTES.toLocaleString('el-GR')}</td>
                      <td className="py-2 px-4 text-right tabular-nums text-slate-400">{r.PRIN2.toLocaleString('el-GR')}</td>
                      <td className="py-2 px-4 text-right tabular-nums text-slate-400">{r.PRIN7.toLocaleString('el-GR')}</td>
                      <td className="py-2 px-4 text-right"><PctBadge value={pct(r.SIMERA, r.XTES)} /></td>
                    </tr>
                  ))}
                </tbody>
                {totalRow && (
                  <tfoot className="bg-slate-100 border-t-2 border-slate-200">
                    <tr>
                      <td className="py-2 px-4 font-bold text-slate-700 text-xs">ΣΥΝΟΛΟ</td>
                      <td className="py-2 px-4 text-right tabular-nums font-bold text-slate-800">{totalRow.SIMERA.toLocaleString('el-GR')}</td>
                      <td className="py-2 px-4 text-right tabular-nums font-bold text-slate-600">{totalRow.XTES.toLocaleString('el-GR')}</td>
                      <td className="py-2 px-4 text-right tabular-nums font-bold text-slate-500">{totalRow.PRIN2.toLocaleString('el-GR')}</td>
                      <td className="py-2 px-4 text-right tabular-nums font-bold text-slate-500">{totalRow.PRIN7.toLocaleString('el-GR')}</td>
                      <td className="py-2 px-4 text-right"><PctBadge value={pctVsXtes} /></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Ωριαία Τάση Download Orders</h2>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(v: string) => `${v}:00`} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => v.toLocaleString('el-GR')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Σήμερα" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="Χτες" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="2 Ημ. πριν" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="1 Εβδ. πριν" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Κατανομή ανά Χρονικό Μπλοκ</h2>
            <ResponsiveContainer width="100%" height={200}>
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
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => v.toLocaleString('el-GR')} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Top 5 Ώρες</h2>
            </div>
            <div className="p-4 space-y-3">
              {top5.map((r, i) => (
                <div key={r.WRA} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="text-sm font-medium text-slate-700 w-12 flex-shrink-0">{r.WRA}:00</div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: maxVal > 0 ? `${(r.SIMERA / maxVal) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-800 tabular-nums w-16 text-right">
                    {r.SIMERA.toLocaleString('el-GR')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Σύνοψη Περιόδου</h2>
            <div className="space-y-3">
              {[
                { label: 'Σύνολο Orders', value: totalSimera.toLocaleString('el-GR') },
                { label: 'Μέσος Όρος / Ώρα', value: avgPerHour.toLocaleString('el-GR') },
                { label: 'Μέγιστη Ωριαία', value: maxVal.toLocaleString('el-GR') },
                { label: 'Ελάχιστη Ωριαία (>0)', value: minVal > 0 ? minVal.toLocaleString('el-GR') : '—' },
                { label: 'Συνολικές Ώρες', value: '24' },
                { label: 'Ώρες με δεδομένα', value: nonZeroHours.length.toString() },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Insights</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="text-xs text-blue-600 font-medium mb-1">Peak Hour</div>
              <div className="text-xl font-bold text-blue-800 tabular-nums">{peakHour?.WRA ?? '—'}:00</div>
              <div className="text-xs text-blue-500 mt-1">{peakHour?.SIMERA?.toLocaleString('el-GR') ?? 0} orders</div>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
              <div className="text-xs text-emerald-600 font-medium mb-1">06:00–12:00 μερίδιο</div>
              <div className="text-xl font-bold text-emerald-800 tabular-nums">{pct0612}%</div>
              <div className="text-xs text-emerald-500 mt-1">{block0612.toLocaleString('el-GR')} orders</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="text-xs text-slate-500 font-medium mb-1">Ώρες χωρίς Download</div>
              <div className="text-xl font-bold text-slate-700 tabular-nums">{zeroHours}</div>
              <div className="text-xs text-slate-400 mt-1">από 24 ώρες</div>
            </div>
            <div className={cn('rounded-lg p-4 border', pctVsXtes !== null && pctVsXtes >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100')}>
              <div className={cn('text-xs font-medium mb-1', pctVsXtes !== null && pctVsXtes >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                Μεταβολή vs Χτες
              </div>
              <div className={cn('text-xl font-bold tabular-nums', pctVsXtes !== null && pctVsXtes >= 0 ? 'text-emerald-800' : 'text-red-700')}>
                {fmtPct(pctVsXtes)}
              </div>
              <div className={cn('text-xs mt-1', pctVsXtes !== null && pctVsXtes >= 0 ? 'text-emerald-500' : 'text-red-400')}>
                {totalXtes.toLocaleString('el-GR')} χθες
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
