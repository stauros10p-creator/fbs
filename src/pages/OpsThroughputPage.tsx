import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RefreshCw, ArrowLeft } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface ThroughputRow {
  IMEROMINIA: string
  WRA: string
  PACKEDORDERS: number | null
  DOWNLOADEDORDERS: number | null
  DIAFORA: number | null
}

interface Snapshot {
  id: number
  generated_at: string
  date_from: string
  date_to: string
  rows: ThroughputRow[]
}

function diffColor(v: number | null) {
  if (v === null) return 'text-muted'
  if (v > 0) return 'text-green-500'
  if (v < 0) return 'text-red-500'
  return 'text-muted'
}

export function OpsThroughputPage() {
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDay, setSelectedDay] = useState<string>('')

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    const { data, error } = await supabase
      .from('throughput_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (!error && data) {
      const snap = data as Snapshot
      setSnapshot(snap)
      const days = [...new Set(snap.rows.filter(r => r.WRA !== 'Synolo').map(r => r.IMEROMINIA))]
      if (days.length > 0) setSelectedDay(days[0])
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const rows = snapshot?.rows ?? []
  const hourlyRows = rows.filter(r => r.WRA !== 'Synolo')
  const totalRow = rows.find(r => r.WRA === 'Synolo' && r.IMEROMINIA === 'Total')

  const byDay = hourlyRows.reduce<Record<string, ThroughputRow[]>>((acc, row) => {
    const day = row.IMEROMINIA ?? 'Unknown'
    if (!acc[day]) acc[day] = []
    acc[day].push(row)
    return acc
  }, {})

  const days = Object.keys(byDay)

  const daySubtotals: Record<string, ThroughputRow> = {}
  for (const [day, dayRows] of Object.entries(byDay)) {
    daySubtotals[day] = rows.find(r => r.IMEROMINIA === day && r.WRA === 'Synolo') ?? {
      IMEROMINIA: day, WRA: 'Synolo',
      PACKEDORDERS: dayRows.reduce((s, r) => s + (r.PACKEDORDERS ?? 0), 0),
      DOWNLOADEDORDERS: dayRows.reduce((s, r) => s + (r.DOWNLOADEDORDERS ?? 0), 0),
      DIAFORA: dayRows.reduce((s, r) => s + (r.DIAFORA ?? 0), 0),
    }
  }

  const chartDay = selectedDay || days[0] || ''
  const chartRows = byDay[chartDay] ?? []
  const chartData = chartRows.map(r => ({
    hour: r.WRA,
    Packed: r.PACKEDORDERS ?? 0,
    Downloaded: r.DOWNLOADEDORDERS ?? 0,
  }))
  const chartSub = daySubtotals[chartDay]

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="THROUGHPUT PACKING & DOWNLOAD"
        subtitle="Hourly packed vs downloaded orders"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/ops')} className="btn-secondary text-xs flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Πίσω
            </button>
            <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary text-xs flex items-center gap-1.5">
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} /> Refresh
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {loading && <div className="text-center py-20 text-muted text-sm">Loading...</div>}

        {!loading && !snapshot && (
          <div className="text-center py-20 text-muted text-sm">
            No data. Run <span className="font-mono text-info">Τρεξε Throughput Packing.bat</span> first.
          </div>
        )}

        {!loading && snapshot && (
          <>
            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-muted font-mono">
              <span>📅 {snapshot.date_from}{snapshot.date_from !== snapshot.date_to ? ` → ${snapshot.date_to}` : ''}</span>
              <span className="text-border">|</span>
              <span>⏱ {snapshot.generated_at}</span>
            </div>

            {/* KPIs */}
            <div className="flex gap-4">
              {[
                { label: 'Packed Orders', val: totalRow?.PACKEDORDERS, color: 'text-green-500' },
                { label: 'Downloaded Orders', val: totalRow?.DOWNLOADEDORDERS, color: 'text-blue-500' },
                { label: 'Διαφορά', val: totalRow?.DIAFORA, color: (totalRow?.DIAFORA ?? 0) >= 0 ? 'text-green-500' : 'text-red-500' },
              ].map(k => (
                <div key={k.label} className="panel flex-1 text-center">
                  <div className="text-xs text-muted uppercase tracking-widest mb-1">{k.label}</div>
                  <div className={cn('text-3xl font-bold font-mono', k.color)}>
                    {k.val !== null && k.val !== undefined ? k.val.toLocaleString('el-GR') : '—'}
                  </div>
                </div>
              ))}
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="panel">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-slate-700">
                    Packing Throughput
                    {chartDay && <span className="ml-2 text-xs font-normal text-muted">({chartDay})</span>}
                  </div>
                  {days.length > 1 && (
                    <select
                      value={selectedDay}
                      onChange={e => setSelectedDay(e.target.value)}
                      className="input w-auto text-xs py-1"
                    >
                      {days.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                </div>

                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ef" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={48} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e6ef' }}
                      formatter={(val: number, name: string) => [val.toLocaleString('el-GR'), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Downloaded" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Packed" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>

                {/* Chart summary row */}
                <div className="flex gap-6 mt-3 pt-3 border-t border-border">
                  <div className="text-center flex-1">
                    <div className="text-xs text-muted mb-0.5">Total Downloaded</div>
                    <div className="text-lg font-bold font-mono text-blue-500">
                      {chartSub?.DOWNLOADEDORDERS?.toLocaleString('el-GR') ?? '—'}
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-xs text-muted mb-0.5">Total Packed</div>
                    <div className="text-lg font-bold font-mono text-green-500">
                      {chartSub?.PACKEDORDERS?.toLocaleString('el-GR') ?? '—'}
                    </div>
                  </div>
                  <div className="text-center flex-1">
                    <div className="text-xs text-muted mb-0.5">Gap</div>
                    <div className={cn('text-lg font-bold font-mono', diffColor(chartSub?.DIAFORA ?? null))}>
                      {chartSub?.DIAFORA !== undefined
                        ? `${(chartSub.DIAFORA ?? 0) >= 0 ? '+' : ''}${chartSub.DIAFORA?.toLocaleString('el-GR')}`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hourly tables per day */}
            {Object.entries(byDay).map(([day, dayRows]) => {
              const sub = daySubtotals[day]
              return (
                <div key={day} className="panel p-0 overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-border flex items-center justify-between">
                    <span className="font-bold text-slate-800 font-mono">{day}</span>
                    <div className="flex gap-6 text-xs font-mono">
                      <span className="text-muted">Packed: <span className="text-green-500 font-bold">{sub.PACKEDORDERS?.toLocaleString('el-GR')}</span></span>
                      <span className="text-muted">Downloaded: <span className="text-blue-500 font-bold">{sub.DOWNLOADEDORDERS?.toLocaleString('el-GR')}</span></span>
                      <span className={cn('font-bold', diffColor(sub.DIAFORA))}>
                        {(sub.DIAFORA ?? 0) >= 0 ? '+' : ''}{sub.DIAFORA?.toLocaleString('el-GR')}
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted uppercase tracking-wider border-b border-border bg-slate-50/50">
                        <th className="text-left px-5 py-2 font-medium">Ώρα</th>
                        <th className="text-right px-5 py-2 font-medium">Packed</th>
                        <th className="text-right px-5 py-2 font-medium">Downloaded</th>
                        <th className="text-right px-5 py-2 font-medium">Διαφορά</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-slate-50">
                          <td className="px-5 py-2 font-mono text-slate-700">{row.WRA}</td>
                          <td className="px-5 py-2 text-right font-mono text-green-600">
                            {row.PACKEDORDERS !== null ? row.PACKEDORDERS.toLocaleString('el-GR') : '—'}
                          </td>
                          <td className="px-5 py-2 text-right font-mono text-blue-600">
                            {row.DOWNLOADEDORDERS !== null ? row.DOWNLOADEDORDERS.toLocaleString('el-GR') : '—'}
                          </td>
                          <td className={cn('px-5 py-2 text-right font-mono font-semibold', diffColor(row.DIAFORA))}>
                            {row.DIAFORA !== null
                              ? `${row.DIAFORA >= 0 ? '+' : ''}${row.DIAFORA.toLocaleString('el-GR')}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
