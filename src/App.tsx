import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

interface OTDRow {
  PERIOD: string
  HMEROMINIA: string
  POLIKES: number | null
  MONIKES: number | null
  SYNOLIKA: number | null
  AUTOSTORE: number | null
  SYNOLOIMERAS: number | null
  OGKODH: number | null
  GIFTORDERS: number | null
  YPOLRAFI: number | null
  YPOLSAMEDAY: number | null
  YPOLAUTOSTORE: number | null
  YPOLINTRADAY: number | null
}

interface OTDSnapshot {
  id: number
  generated_at: string
  rows: OTDRow[]
  created_at: string
}

function fmt(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('el-GR')
}

function pct(a: number | null, b: number | null): number | null {
  if (!a || !b) return null
  return Math.round((a / b) * 100)
}

function PctBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted text-xs">—</span>
  const good = value >= 80
  return (
    <span className={cn(
      'text-xs font-semibold px-2 py-0.5 rounded',
      good ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
    )}>
      {value}%
    </span>
  )
}

function ProgressBar({ value, max, color = '#378ADD' }: { value: number | null; max: number | null; color?: string }) {
  const pctVal = pct(value, max)
  if (pctVal === null) return null
  const w = Math.min(pctVal, 100)
  return (
    <div>
      <div style={{ height: 7, background: 'var(--color-surface3, #1e293b)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: 7, width: `${w}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function MetricRow({ label, today, yst, lw }: { label: string; today: number | null; yst: number | null; lw: number | null }) {
  return (
    <div className="grid grid-cols-4 items-center py-2 border-b border-border/50 last:border-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-center text-sm font-semibold">{fmt(today)}</div>
      <div className="text-center text-sm text-muted/80">{fmt(yst)}</div>
      <div className="text-center text-sm text-muted/80">{fmt(lw)}</div>
    </div>
  )
}

export function OpsSnapshotPage() {
  const [snapshot, setSnapshot] = useState<OTDSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    const { data, error } = await supabase
      .from('otd_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (!error && data) setSnapshot(data as OTDSnapshot)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const today = snapshot?.rows?.find(r => r.PERIOD === 'Today') ?? null
  const yst   = snapshot?.rows?.find(r => r.PERIOD === 'Yesterday') ?? null
  const lw    = snapshot?.rows?.find(r => r.PERIOD === 'Last Week') ?? null

  // For "yesterday" comparison base, use SynoloImeras (full day) if available, else Synolika
  const ystBase = yst?.SYNOLOIMERAS ?? yst?.SYNOLIKA ?? null
  const lwBase  = lw?.SYNOLOIMERAS  ?? lw?.SYNOLIKA  ?? null

  const pctVsYst = pct(today?.SYNOLIKA ?? null, ystBase)
  const pctVsLw  = pct(today?.SYNOLIKA ?? null, lwBase)

  // End-of-day estimate: extrapolate based on current hour
  function estimate(): number | null {
    if (!today?.SYNOLIKA || !ystBase) return null
    const now = new Date()
    const elapsed = (now.getHours() * 60 + now.getMinutes()) / (24 * 60)
    if (elapsed < 0.1) return null
    return Math.round(today.SYNOLIKA / elapsed)
  }
  const est = estimate()

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="TODAY vs YESTERDAY vs LAST WEEK"
        subtitle="Packed orders comparison — run the script to refresh"
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

        {loading && <div className="text-center py-20 text-muted text-sm">Loading...</div>}

        {!loading && !snapshot && (
          <div className="text-center py-20 text-muted text-sm">
            No data yet. Run <span className="font-mono text-info">Τρεξε Throughput Packing.bat</span> to push data.
          </div>
        )}

        {!loading && snapshot && (
          <>
            {/* Timestamp */}
            <div className="text-xs text-muted font-mono">⏱ {snapshot.generated_at}</div>

            {/* ── Main comparison table ── */}
            <div className="panel p-0 overflow-hidden">

              {/* Column headers */}
              <div className="grid grid-cols-4 border-b border-border">
                <div />
                <div className="text-center py-3 border-b-2 border-blue-500">
                  <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Today</div>
                  <div className="text-[11px] text-muted">{today?.HMEROMINIA ?? '—'}</div>
                </div>
                <div className="text-center py-3 border-b-2 border-border">
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider">Yesterday</div>
                  <div className="text-[11px] text-muted">{yst?.HMEROMINIA ?? '—'}</div>
                </div>
                <div className="text-center py-3 border-b-2 border-border">
                  <div className="text-xs font-semibold text-muted uppercase tracking-wider">Last Week</div>
                  <div className="text-[11px] text-muted">{lw?.HMEROMINIA ?? '—'}</div>
                </div>
              </div>

              {/* Σύνολο row */}
              <div className="grid grid-cols-4 items-center py-3 px-5 border-b border-border">
                <div className="text-xs text-muted">Σύνολο</div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-400">{fmt(today?.SYNOLIKA ?? null)}</div>
                  <div className="text-[10px] text-muted">έως τώρα</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-semibold">{fmt(yst?.SYNOLOIMERAS ?? yst?.SYNOLIKA ?? null)}</div>
                  <div className="text-[10px] text-muted">{yst?.SYNOLOIMERAS ? 'τελικό' : 'έως τώρα'}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-semibold">{fmt(lw?.SYNOLOIMERAS ?? lw?.SYNOLIKA ?? null)}</div>
                  <div className="text-[10px] text-muted">{lw?.SYNOLOIMERAS ? 'τελικό' : 'έως τώρα'}</div>
                </div>
              </div>

              {/* Progress bars */}
              <div className="grid grid-cols-4 items-center py-3 px-5 border-b border-border gap-x-4">
                <div className="text-xs text-muted">Πρόοδος ημέρας</div>
                <div className="col-span-1 space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-muted mb-1">
                      <span>vs χθες</span>
                      <PctBadge value={pctVsYst} />
                    </div>
                    <ProgressBar value={today?.SYNOLIKA ?? null} max={ystBase} color="#378ADD" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted mb-1">
                      <span>vs περσινή εβδ.</span>
                      <PctBadge value={pctVsLw} />
                    </div>
                    <ProgressBar value={today?.SYNOLIKA ?? null} max={lwBase} color="#5DCAA5" />
                  </div>
                </div>
                <div className="text-center text-xs text-muted">—</div>
                <div className="text-center text-xs text-muted">—</div>
              </div>

              {/* Metric rows */}
              <div className="px-5">
                <MetricRow label="Πολ/κες"    today={today?.POLIKES   ?? null} yst={yst?.POLIKES   ?? null} lw={lw?.POLIKES   ?? null} />
                <MetricRow label="Μον/κες"    today={today?.MONIKES   ?? null} yst={yst?.MONIKES   ?? null} lw={lw?.MONIKES   ?? null} />
                <MetricRow label="AutoStore"  today={today?.AUTOSTORE ?? null} yst={yst?.AUTOSTORE ?? null} lw={lw?.AUTOSTORE ?? null} />
                <MetricRow label="Ογκώδη"     today={today?.OGKODH    ?? null} yst={yst?.OGKODH    ?? null} lw={lw?.OGKODH    ?? null} />
                <MetricRow label="Gift"       today={today?.GIFTORDERS ?? null} yst={yst?.GIFTORDERS ?? null} lw={lw?.GIFTORDERS ?? null} />
              </div>
            </div>

            {/* ── Bottom row ── */}
            <div className="grid grid-cols-2 gap-4">

              {/* Ανάλυση ρυθμού */}
              <div className="panel space-y-1">
                <div className="text-xs font-bold tracking-widest text-muted uppercase mb-3">Ανάλυση ρυθμού</div>
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="text-muted">Εκτίμηση τέλους ημέρας</span>
                  <span className="font-semibold">{est ? `~${fmt(est)}` : '—'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="text-muted">AutoStore %</span>
                  <span className="font-semibold">
                    {today?.SYNOLIKA && today?.AUTOSTORE
                      ? `${Math.round((today.AUTOSTORE / today.SYNOLIKA) * 100)}%` : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 text-sm">
                  <span className="text-muted">Gift %</span>
                  <span className="font-semibold">
                    {today?.SYNOLIKA && today?.GIFTORDERS
                      ? `${((today.GIFTORDERS / today.SYNOLIKA) * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Υπόλοιπα σήμερα */}
              <div className="panel space-y-1">
                <div className="text-xs font-bold tracking-widest text-muted uppercase mb-3">Υπόλοιπα σήμερα</div>
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="text-muted">Ράφι</span>
                  <span className="font-semibold">{fmt(today?.YPOLRAFI ?? null)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="text-muted">SameDay</span>
                  <span className={cn('font-semibold', (today?.YPOLSAMEDAY ?? 0) > 0 && 'text-red-400')}>
                    {fmt(today?.YPOLSAMEDAY ?? null)}
                    {(today?.YPOLSAMEDAY ?? 0) > 0 && ' ⚠'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                  <span className="text-muted">AutoStore</span>
                  <span className="font-semibold">{fmt(today?.YPOLAUTOSTORE ?? null)}</span>
                </div>
                <div className="flex justify-between items-center py-2 text-sm">
                  <span className="text-muted">IntraDay</span>
                  <span className="font-semibold">{fmt(today?.YPOLINTRADAY ?? null)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
