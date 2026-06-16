import { useState, useRef } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThroughputRow {
  IMEROMINIA: string
  WRA: string
  PACKEDORDERS: number | null
  DOWNLOADEDORDERS: number | null
  DIAFORA: number | null
}

interface ThroughputData {
  generated_at: string
  date_from: string
  date_to: string
  rows: ThroughputRow[]
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

export function OpsSnapshotPage() {
  const [data, setData] = useState<ThroughputData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setError(null)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as ThroughputData
        setData(parsed)
      } catch {
        setError('Invalid JSON file.')
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // Separate hourly rows from total rows
  const hourlyRows = data?.rows.filter(r => r.WRA !== 'Synolo') ?? []
  const totalRow   = data?.rows.find(r => r.WRA === 'Synolo' && r.IMEROMINIA === 'Total')

  // Group hourly rows by date
  const byDay = hourlyRows.reduce<Record<string, ThroughputRow[]>>((acc, row) => {
    const day = row.IMEROMINIA ?? 'Unknown'
    if (!acc[day]) acc[day] = []
    acc[day].push(row)
    return acc
  }, {})

  // Per-day subtotals
  const daySubtotals: Record<string, ThroughputRow> = {}
  for (const [day, rows] of Object.entries(byDay)) {
    daySubtotals[day] = data?.rows.find(r => r.IMEROMINIA === day && r.WRA === 'Synolo') ?? {
      IMEROMINIA: day,
      WRA: 'Synolo',
      PACKEDORDERS:      rows.reduce((s, r) => s + (r.PACKEDORDERS ?? 0), 0),
      DOWNLOADEDORDERS:  rows.reduce((s, r) => s + (r.DOWNLOADEDORDERS ?? 0), 0),
      DIAFORA:           rows.reduce((s, r) => s + (r.DIAFORA ?? 0), 0),
    }
  }

  function diffColor(v: number | null) {
    if (v === null) return 'text-muted'
    if (v > 0) return 'text-green-400'
    if (v < 0) return 'text-red-400'
    return 'text-muted'
  }

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="THROUGHPUT PACKING & DOWNLOAD"
        subtitle="Hourly packed vs downloaded orders — run the PowerShell script then load the JSON"
        actions={
          data && (
            <button
              onClick={() => inputRef.current?.click()}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Load new file
            </button>
          )
        }
      />

      <div className="p-8 space-y-6">

        {/* ── No data: upload prompt ── */}
        {!data && (
          <div
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-info/50 rounded-xl p-16 text-center cursor-pointer transition-colors"
          >
            <Upload className="w-10 h-10 mx-auto mb-4 text-muted" />
            <div className="text-white font-semibold mb-1">Load JSON file</div>
            <div className="text-muted text-sm">
              Run <span className="font-mono text-info">Τρεξε Throughput Packing.bat</span> first,
              then load the JSON from <span className="font-mono text-xs">OneDrive\script\exports\</span>
            </div>
            {error && <div className="text-red-400 text-sm mt-4">{error}</div>}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={onInputChange}
        />

        {/* ── Data loaded ── */}
        {data && (
          <>
            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-muted font-mono">
              <span>📅 {data.date_from}{data.date_from !== data.date_to ? ` → ${data.date_to}` : ''}</span>
              <span className="text-border">|</span>
              <span>⏱ Generated: {data.generated_at}</span>
            </div>

            {/* KPI cards */}
            <div className="flex gap-4">
              {kpi('Packed Orders',      totalRow?.PACKEDORDERS     ?? null, 'text-green-400')}
              {kpi('Downloaded Orders',  totalRow?.DOWNLOADEDORDERS ?? null, 'text-blue')}
              {kpi('Διαφορά',            totalRow?.DIAFORA          ?? null,
                (totalRow?.DIAFORA ?? 0) >= 0 ? 'text-green-400' : 'text-red-400')}
            </div>

            {/* Table per day */}
            {Object.entries(byDay).map(([day, rows]) => {
              const sub = daySubtotals[day]
              return (
                <div key={day} className="panel p-0 overflow-hidden">
                  {/* Day header */}
                  <div className="px-5 py-3 bg-surface3/60 border-b border-border flex items-center justify-between">
                    <span className="font-bold text-white font-mono">{day}</span>
                    <div className="flex gap-6 text-xs font-mono">
                      <span className="text-muted">Packed: <span className="text-green-400 font-bold">{sub.PACKEDORDERS?.toLocaleString('el-GR')}</span></span>
                      <span className="text-muted">Downloaded: <span className="text-blue font-bold">{sub.DOWNLOADEDORDERS?.toLocaleString('el-GR')}</span></span>
                      <span className={cn('font-bold', diffColor(sub.DIAFORA))}>{(sub.DIAFORA ?? 0) >= 0 ? '+' : ''}{sub.DIAFORA?.toLocaleString('el-GR')}</span>
                    </div>
                  </div>

                  {/* Rows */}
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
                      {rows.map((row, i) => (
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
