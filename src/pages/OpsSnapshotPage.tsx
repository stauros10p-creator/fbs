import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

interface ThroughputRow {
  IMEROMINIA: string
  WRA: string
  PACKEDORDERS: number | null
  DOWNLOADEDORDERS: number | null
  DIAFORA: number | null
}

interface Snapshot {
  id: number
  date_from: string
  date_to: string
  generated_at: string
  rows: ThroughputRow[]
  created_at: string
}

function kpi(label: string, value: number | null, color: string) {
  return (
    <div className="panel flex-1 text-center">
      <div className="text-xs text-muted uppercase tracking-widest mb-1">{label}</div>
      <div className={cn('text-3xl font-bold font-mono', color)}>
        {value !== null ? value.toLocaleString('el-GR') : '—'}
      </div>
    </div>
  )
}

function diffColor(v: number | null) {
  if (v === null) return 'text-muted'
  if (v > 0) return 'text-green-400'
  if (v < 0) return 'text-red-400'
  return 'text-muted'
}

export function OpsSnapshotPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    const { data, error } = await supabase
      .from('throughput_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!error && data) setSnapshot(data as Snapshot)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const rows = snapshot?.rows ?? []
  const hourlyRows = rows.filter(r => r.WRA !== 'Synolo')
  const totalRow   = rows.find(r => r.WRA === 'Synolo' && r.IMEROMINIA === 'Total')

  const byDay = hourlyRows.reduce<Record<string, ThroughputRow[]>>((acc, row) => {
    const day = row.IMEROMINIA ?? 'Unknown'
    if (!acc[day]) acc[day] = []
    acc[day].push(row)
    return acc
  }, {})

  const daySubtotals: Record<string, ThroughputRow> = {}
  for (const [day, dayRows] of Object.entries(byDay)) {
    daySubtotals[day] = rows.find(r => r.IMEROMINIA === day && r.WRA === 'Synolo') ?? {
      IMEROMINIA: day,
      WRA: 'Synolo',
      PACKEDORDERS:     dayRows.reduce((s, r) => s + (r.PACKEDORDERS ?? 0), 0),
      DOWNLOADEDORDERS: dayRows.reduce((s, r) => s + (r.DOWNLOADEDORDERS ?? 0), 0),
      DIAFORA:          dayRows.reduce((s, r) => s + (r.DIAFORA ?? 0), 0),
    }
  }

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="THROUGHPUT PACKING & DOWNLOAD"
        subtitle="Hourly packed vs downloaded orders from Aberon WMS"
        actions={
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        }
      />

      <div className="p-8 space-y-6">

        {loading && (
          <div className="text-center py-20 text-muted text-sm">Loading...</div>
        )}

        {!loading && !snapshot && (
          <div className="text-center py-20 text-muted text-sm">
            No data yet. Run <span className="font-mono text-info">Τρεξε Throughput Packing.bat</span> to push data.
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

            {/* KPI cards */}
            <div className="flex gap-4">
              {kpi('Packed Orders',     totalRow?.PACKEDORDERS     ?? null, 'text-green-400')}
              {kpi('Downloaded Orders', totalRow?.DOWNLOADEDORDERS ?? null, 'text-blue')}
              {kpi('Διαφορά',           totalRow?.DIAFORA          ?? null,
                (totalRow?.DIAFORA ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}
            </div>

            {/* Table per day */}
            {Object.entries(byDay).map(([day, dayRows]) => {
              const sub = daySubtotals[day]
              return (
                <div key={day} className="panel p-0 overflow-hidden">
                  <div className="px-5 py-3 bg-surface3/60 border-b border-border flex items-center justify-between">
                    <span className="font-bold text-white font-mono">{day}</span>
                    <div className="flex gap-6 text-xs font-mono">
                      <span className="text-muted">Packed: <span className="text-green-400 font-bold">{sub.PACKEDORDERS?.toLocaleString('el-GR')}</span></span>
                      <span className="text-muted">Downloaded: <span className="text-blue font-bold">{sub.DOWNLOADEDORDERS?.toLocaleString('el-GR')}</span></span>
                      <span className={cn('font-bold', diffColor(sub.DIAFORA))}>
                        {(sub.DIAFORA ?? 0) >= 0 ? '+' : ''}{sub.DIAFORA?.toLocaleString('el-GR')}
                      </span>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted uppercase tracking-wider border-b border-border">
                        <th className="text-left px-5 py-2 font-medium">Ώρα</th>
                        <th className="text-right px-5 py-2 font-medium">Packed</th>
                        <th className="text-right px-5 py-2 font-medium">Downloaded</th>
                        <th className="text-right px-5 py-2 font-medium">Διαφορά</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-surface3/30">
                          <td className="px-5 py-2 font-mono text-white/80">{row.WRA}</td>
                          <td className="px-5 py-2 text-right font-mono text-green-400">
                            {row.PACKEDORDERS !== null ? row.PACKEDORDERS.toLocaleString('el-GR') : '—'}
                          </td>
                          <td className="px-5 py-2 text-right font-mono text-blue">
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
