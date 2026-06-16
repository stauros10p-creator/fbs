import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RefreshCw, ArrowLeft } from 'lucide-react'

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
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('el-GR')
}

function pct(a: number | null | undefined, b: number | null | undefined): number | null {
  if (!a || !b) return null
  return Math.round((a / b) * 100)
}

function vsChg(a: number | null | undefined, b: number | null | undefined): number | null {
  if (!a || !b) return null
  return Math.round(((a - b) / b) * 100)
}

function PctBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted text-xs">—</span>
  return (
    <span className={cn(
      'text-xs font-semibold px-2 py-0.5 rounded',
      value >= 80 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
    )}>
      {value}%
    </span>
  )
}

function VsBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted">—</span>
  const up = value >= 0
  return (
    <span className={cn('text-xs font-semibold', up ? 'text-green-500' : 'text-red-500')}>
      {up ? '↑' : '↓'}{Math.abs(value)}%
    </span>
  )
}

function ProgressBar({ value, max, color }: { value: number | null; max: number | null; color: string }) {
  const p = pct(value, max)
  if (p === null) return null
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(p, 100)}%`, background: color }} />
    </div>
  )
}

function MetricRow({ label, today, yst, lw }: { label: string; today: number | null | undefined; yst: number | null | undefined; lw: number | null | undefined }) {
  const chgYst = vsChg(today, yst)
  return (
    <div className="grid grid-cols-5 items-center py-2 border-b border-border/50 last:border-0 px-5">
      <div className="text-xs text-muted col-span-1">{label}</div>
      <div className="text-center text-sm font-semibold text-slate-800">{fmt(today)}</div>
      <div className="text-center text-xs"><VsBadge value={chgYst} /></div>
      <div className="text-center text-sm text-slate-500">{fmt(yst)}</div>
      <div className="text-center text-sm text-slate-400">{fmt(lw)}</div>
    </div>
  )
}

export function OpsOtdPage() {
  const navigate = useNavigate()
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

  const today = snapshot?.rows?.find(r => r.PERIOD === 'Today')
  const yst   = snapshot?.rows?.find(r => r.PERIOD === 'Yesterday')
  const lw    = snapshot?.rows?.find(r => r.PERIOD === 'Last Week')

  const ystSameTime = yst?.SYNOLIKA ?? null
  const ystFinal    = yst?.SYNOLOIMERAS ?? null
  const lwSameTime  = lw?.SYNOLIKA ?? null
  const lwFinal     = lw?.SYNOLOIMERAS ?? null

  const pctVsYst = pct(today?.SYNOLIKA, ystFinal ?? ystSameTime)
  const pctVsLw  = pct(today?.SYNOLIKA, lwFinal ?? lwSameTime)
  const totalVsYst = vsChg(today?.SYNOLIKA, ystSameTime)

  function estimate(): number | null {
    if (!today?.SYNOLIKA) return null
    const now = new Date()
    const elapsed = (now.getHours() * 60 + now.getMinutes()) / (24 * 60)
    if (elapsed < 0.1) return null
    return Math.round(today.SYNOLIKA / elapsed)
  }

  const categories = [
    { label: 'Multi',     todayVal: today?.POLIKES,    ystVal: yst?.POLIKES,    lwVal: lw?.POLIKES },
    { label: 'Mono',      todayVal: today?.MONIKES,    ystVal: yst?.MONIKES,    lwVal: lw?.MONIKES },
    { label: 'AutoStore', todayVal: today?.AUTOSTORE,  ystVal: yst?.AUTOSTORE,  lwVal: lw?.AUTOSTORE },
    { label: 'Ογκώδη',   todayVal: today?.OGKODH,     ystVal: yst?.OGKODH,     lwVal: lw?.OGKODH },
    { label: 'Gift',      todayVal: today?.GIFTORDERS, ystVal: yst?.GIFTORDERS, lwVal: lw?.GIFTORDERS },
  ]

  const totalRemaining = (today?.YPOLRAFI ?? 0) + (today?.YPOLSAMEDAY ?? 0)
    + (today?.YPOLAUTOSTORE ?? 0) + (today?.YPOLINTRADAY ?? 0)

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="TODAY vs YESTERDAY vs LAST WEEK"
        subtitle="Σύγκριση packed orders ανά περίοδο"
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
            <div className="text-xs text-muted font-mono">⏱ {snapshot.generated_at}</div>

            {/* Main comparison table */}
            <div className="panel p-0 overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-5 border-b border-border bg-slate-50">
                <div className="col-span-1" />
                <div className="text-center py-3 border-b-2 border-blue-500">
                  <div className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Today</div>
                  <div className="text-[11px] text-muted">{today?.HMEROMINIA ?? '—'}</div>
                </div>
                <div className="text-center py-3 flex items-center justify-center text-[11px] text-muted">vs Χθες</div>
                <div className="text-center py-3 border-b-2 border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Yesterday</div>
                  <div className="text-[11px] text-muted">{yst?.HMEROMINIA ?? '—'}</div>
                </div>
                <div className="text-center py-3 border-b-2 border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Week</div>
                  <div className="text-[11px] text-muted">{lw?.HMEROMINIA ?? '—'}</div>
                </div>
              </div>

              {/* Σύνολο */}
              <div className="grid grid-cols-5 items-start py-3 px-5 border-b border-border">
                <div className="text-xs text-muted pt-2">Σύνολο</div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-500">{fmt(today?.SYNOLIKA)}</div>
                  <div className="text-[10px] text-muted">έως τώρα</div>
                </div>
                <div className="flex items-center justify-center">
                  <VsBadge value={totalVsYst} />
                </div>
                {/* Yesterday: same-time + final */}
                <div className="text-center">
                  {ystSameTime !== null && (
                    <div>
                      <div className="text-base font-semibold text-slate-700">{fmt(ystSameTime)}</div>
                      <div className="text-[10px] text-muted">έως τώρα</div>
                    </div>
                  )}
                  {ystFinal !== null && (
                    <div className="mt-1">
                      <div className="text-sm font-medium text-slate-400">{fmt(ystFinal)}</div>
                      <div className="text-[10px] text-muted">τελικό</div>
                    </div>
                  )}
                </div>
                {/* Last Week: same-time + final */}
                <div className="text-center">
                  {lwSameTime !== null && (
                    <div>
                      <div className="text-base font-semibold text-slate-700">{fmt(lwSameTime)}</div>
                      <div className="text-[10px] text-muted">έως τώρα</div>
                    </div>
                  )}
                  {lwFinal !== null && (
                    <div className="mt-1">
                      <div className="text-sm font-medium text-slate-400">{fmt(lwFinal)}</div>
                      <div className="text-[10px] text-muted">τελικό</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div className="grid grid-cols-5 items-center py-3 px-5 border-b border-border">
                <div className="text-xs text-muted">Πρόοδος</div>
                <div className="col-span-2 space-y-2">
                  <div>
                    <div className="flex justify-between text-[11px] text-muted mb-1">
                      <span>vs χθες τελικό</span><PctBadge value={pctVsYst} />
                    </div>
                    <ProgressBar value={today?.SYNOLIKA ?? null} max={ystFinal ?? ystSameTime} color="#3b82f6" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted mb-1">
                      <span>vs περσινή εβδ.</span><PctBadge value={pctVsLw} />
                    </div>
                    <ProgressBar value={today?.SYNOLIKA ?? null} max={lwFinal ?? lwSameTime} color="#22c55e" />
                  </div>
                </div>
                <div className="text-center text-xs text-muted">—</div>
                <div className="text-center text-xs text-muted">—</div>
              </div>

              {/* Subheader for metrics */}
              <div className="grid grid-cols-5 px-5 py-1.5 bg-slate-50 border-b border-border">
                <div />
                <div className="text-center text-[10px] text-muted uppercase tracking-wider">Today</div>
                <div className="text-center text-[10px] text-muted uppercase tracking-wider">vs Χθες</div>
                <div className="text-center text-[10px] text-muted uppercase tracking-wider">Yesterday</div>
                <div className="text-center text-[10px] text-muted uppercase tracking-wider">Last Week</div>
              </div>

              <MetricRow label="Multi"     today={today?.POLIKES}    yst={yst?.POLIKES}    lw={lw?.POLIKES} />
              <MetricRow label="Mono"      today={today?.MONIKES}    yst={yst?.MONIKES}    lw={lw?.MONIKES} />
              <MetricRow label="AutoStore" today={today?.AUTOSTORE}  yst={yst?.AUTOSTORE}  lw={lw?.AUTOSTORE} />
              <MetricRow label="Ογκώδη"   today={today?.OGKODH}     yst={yst?.OGKODH}     lw={lw?.OGKODH} />
              <MetricRow label="Gift"      today={today?.GIFTORDERS} yst={yst?.GIFTORDERS} lw={lw?.GIFTORDERS} />
            </div>

            {/* Ανάλυση ρυθμού + Υπόλοιπα panels */}
            <div className="grid grid-cols-2 gap-4">
              <div className="panel">
                <div className="text-xs font-bold tracking-widest text-muted uppercase mb-3">Ανάλυση ρυθμού</div>
                {[
                  { label: 'Εκτίμηση τέλους', val: estimate() ? `~${fmt(estimate())}` : '—' },
                  { label: 'AutoStore %', val: today?.SYNOLIKA && today?.AUTOSTORE ? `${Math.round((today.AUTOSTORE / today.SYNOLIKA) * 100)}%` : '—' },
                  { label: 'Gift %', val: today?.SYNOLIKA && today?.GIFTORDERS ? `${((today.GIFTORDERS / today.SYNOLIKA) * 100).toFixed(1)}%` : '—' },
                  { label: 'Ογκώδη %', val: today?.SYNOLIKA && today?.OGKODH ? `${((today.OGKODH / today.SYNOLIKA) * 100).toFixed(1)}%` : '—' },
                  { label: 'Ράφι %', val: today?.SYNOLIKA && today?.POLIKES ? `${Math.round((today.POLIKES / today.SYNOLIKA) * 100)}%` : '—' },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0 text-sm">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold text-slate-800">{val}</span>
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="text-xs font-bold tracking-widest text-muted uppercase mb-3">Υπόλοιπα σήμερα</div>
                {[
                  { label: 'Shelf Orders', val: today?.YPOLRAFI,      urgent: false },
                  { label: 'Same Day',     val: today?.YPOLSAMEDAY,   urgent: true },
                  { label: 'AutoStore',    val: today?.YPOLAUTOSTORE, urgent: false },
                  { label: 'Intra Day',    val: today?.YPOLINTRADAY,  urgent: true },
                ].map(({ label, val, urgent }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0 text-sm">
                    <span className="text-muted">{label}</span>
                    <span className={cn('font-semibold', urgent && (val ?? 0) > 0 ? 'text-red-500' : 'text-slate-800')}>
                      {fmt(val)}{urgent && (val ?? 0) > 0 ? ' ⚠' : ''}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-2 border-t border-border text-sm font-semibold mt-1">
                  <span className="text-slate-600">Σύνολο</span>
                  <span className="text-slate-800">{fmt(totalRemaining)}</span>
                </div>
              </div>
            </div>

            {/* Category table + Remaining table */}
            <div className="grid grid-cols-2 gap-4">
              {/* Category breakdown */}
              <div className="panel p-0 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-border">
                  <span className="text-xs font-bold tracking-widest text-muted uppercase">Κατηγορία</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted uppercase tracking-wider border-b border-border">
                      <th className="text-left px-4 py-2 font-medium">Τύπος</th>
                      <th className="text-right px-4 py-2 font-medium">Today</th>
                      <th className="text-right px-4 py-2 font-medium">vs Χθες</th>
                      <th className="text-right px-4 py-2 font-medium">Χθες</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(c => {
                      const chg = vsChg(c.todayVal, c.ystVal)
                      return (
                        <tr key={c.label} className="border-b border-border/50 hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-600 font-medium">{c.label}</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">{fmt(c.todayVal)}</td>
                          <td className="px-4 py-2 text-right"><VsBadge value={chg} /></td>
                          <td className="px-4 py-2 text-right font-mono text-slate-400">{fmt(c.ystVal)}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-slate-50 border-t border-border font-semibold">
                      <td className="px-4 py-2 text-slate-700">Σύνολο</td>
                      <td className="px-4 py-2 text-right font-mono text-blue-500">{fmt(today?.SYNOLIKA)}</td>
                      <td className="px-4 py-2 text-right"><VsBadge value={totalVsYst} /></td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400">{fmt(ystSameTime)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Remaining by type */}
              <div className="panel p-0 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-border">
                  <span className="text-xs font-bold tracking-widest text-muted uppercase">Υπόλοιπα ανά τύπο</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted uppercase tracking-wider border-b border-border">
                      <th className="text-left px-4 py-2 font-medium">Τύπος</th>
                      <th className="text-right px-4 py-2 font-medium">Remaining</th>
                      <th className="text-center px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Shelf Orders', val: today?.YPOLRAFI,      threshold: 200 },
                      { label: 'Same Day',     val: today?.YPOLSAMEDAY,   threshold: 0 },
                      { label: 'AutoStore',    val: today?.YPOLAUTOSTORE, threshold: 300 },
                      { label: 'Intra Day',    val: today?.YPOLINTRADAY,  threshold: 100 },
                    ].map(({ label, val, threshold }) => {
                      const v = val ?? 0
                      const dotColor = v === 0
                        ? 'bg-green-500'
                        : v <= threshold ? 'bg-green-500'
                        : v <= threshold * 2 ? 'bg-orange-400'
                        : 'bg-red-500'
                      return (
                        <tr key={label} className="border-b border-border/50 hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-600">{label}</td>
                          <td className={cn('px-4 py-2 text-right font-mono font-semibold', v > 0 ? 'text-slate-800' : 'text-muted')}>
                            {fmt(val)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={cn('w-2.5 h-2.5 rounded-full inline-block', dotColor)} />
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-slate-50 border-t border-border font-semibold">
                      <td className="px-4 py-2 text-slate-700">Σύνολο</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-800">{fmt(totalRemaining)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
