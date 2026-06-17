import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RefreshCw, ArrowLeft } from 'lucide-react'
import { HistoryPicker } from '@/components/ui/HistoryPicker'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface InboundRow {
  WRA: string
  INBOUNDQTY: number | null
  PUTAWAYQTY: number | null
}

interface Snapshot {
  id: number
  generated_at: string
  date_from: string
  date_to: string
  rows: InboundRow[]
}

function diffColor(v: number | null) {
  if (v === null) return 'text-muted'
  if (v < 0) return 'text-red-500'   // more put away than received (unusual)
  if (v > 0) return 'text-orange-500' // backlog waiting to be put away
  return 'text-muted'
}

export function OpsInboundPage() {
  const navigate = useNavigate()
  const [snapshot, setSnapshot]     = useState<Snapshot | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [historyDate, setHistoryDate] = useState('')

  async function load(showRefresh = false, date = historyDate) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    let q = supabase.from('inbound_snapshots').select('*').order('created_at', { ascending: false }).limit(1)
    if (date) {
      q = q.gte('generated_at', date + ' 00:00:00').lte('generated_at', date + ' 23:59:59')
    }
    const { data, error } = await q.single()
    if (!error && data) {
      setSnapshot(data as Snapshot)
    } else {
      setSnapshot(null)
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load(false, historyDate) }, [historyDate])

  const rows = snapshot?.rows ?? []
  const hourlyRows = rows.filter(r => r.WRA !== 'Synolo')
  const totalRow   = rows.find(r => r.WRA === 'Synolo')

  const chartData = hourlyRows.map(r => ({
    hour:    r.WRA,
    Inbound: r.INBOUNDQTY ?? 0,
    Putaway: r.PUTAWAYQTY ?? 0,
  }))

  const totalInbound = totalRow?.INBOUNDQTY ?? null
  const totalPutaway = totalRow?.PUTAWAYQTY ?? null
  const gap = totalInbound !== null && totalPutaway !== null ? totalInbound - totalPutaway : null

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="THROUGHPUT ΠΑΡΑΛΑΒΏΝ & PUTAWAY"
        subtitle="Ανά ώρα παραλαβές (Inbound) και τοποθέτηση (Putaway)"
        actions={
          <div className="flex items-center gap-2">
            <HistoryPicker value={historyDate} onChange={setHistoryDate} />
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
            {historyDate ? `Δεν υπάρχει snapshot για ${historyDate}` : 'No data. Run the script first.'}
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
                { label: 'Παραλαβές (Inbound)', val: totalInbound, color: 'text-orange-500' },
                { label: 'Putaway', val: totalPutaway, color: 'text-purple-500' },
                { label: 'Εκκρεμεί Putaway', val: gap, color: diffColor(gap) },
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
                <div className="text-sm font-semibold text-slate-700 mb-4">Ανά ώρα — Inbound vs Putaway</div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ef" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={52} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e6ef' }}
                      formatter={(val: number, name: string) => [val.toLocaleString('el-GR'), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Inbound" stroke="#f97316" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Putaway" stroke="#a855f7" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Hourly table */}
            {hourlyRows.length > 0 && (
              <div className="panel p-0 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-border flex items-center justify-between">
                  <span className="font-bold text-slate-800 font-mono">{snapshot.date_from}</span>
                  <div className="flex gap-6 text-xs font-mono">
                    <span className="text-muted">Inbound: <span className="text-orange-500 font-bold">{totalInbound?.toLocaleString('el-GR') ?? '—'}</span></span>
                    <span className="text-muted">Putaway: <span className="text-purple-500 font-bold">{totalPutaway?.toLocaleString('el-GR') ?? '—'}</span></span>
                    {gap !== null && (
                      <span className={cn('font-bold', diffColor(gap))}>
                        Εκκρεμεί: {gap.toLocaleString('el-GR')}
                      </span>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted uppercase tracking-wider border-b border-border bg-slate-50/50">
                      <th className="text-left px-5 py-2 font-medium">Ώρα</th>
                      <th className="text-right px-5 py-2 font-medium">Inbound (τεμ.)</th>
                      <th className="text-right px-5 py-2 font-medium">Putaway (τεμ.)</th>
                      <th className="text-right px-5 py-2 font-medium">Εκκρεμεί</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hourlyRows.map((row, i) => {
                      const rowGap = (row.INBOUNDQTY ?? 0) - (row.PUTAWAYQTY ?? 0)
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-slate-50">
                          <td className="px-5 py-2 font-mono text-slate-700">{row.WRA}</td>
                          <td className="px-5 py-2 text-right font-mono text-orange-500">
                            {row.INBOUNDQTY !== null ? row.INBOUNDQTY.toLocaleString('el-GR') : '—'}
                          </td>
                          <td className="px-5 py-2 text-right font-mono text-purple-500">
                            {row.PUTAWAYQTY !== null ? row.PUTAWAYQTY.toLocaleString('el-GR') : '—'}
                          </td>
                          <td className={cn('px-5 py-2 text-right font-mono font-semibold', diffColor(rowGap))}>
                            {rowGap !== 0 ? rowGap.toLocaleString('el-GR') : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
