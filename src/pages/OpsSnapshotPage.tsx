import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { useCreateOpsSnapshot, useOpsHistory } from '@/hooks'
import { getSnapshotAge, formatTime } from '@/lib/utils'
import { formatTTE, pressureColor } from '@/lib/engine'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface FieldConfig {
  key: string
  label: string
  description: string
  color: string
  role?: string
}

const FIELDS: FieldConfig[] = [
  { key: 'pending_picking',    label: 'Pending Picking',      description: 'Orders waiting at pick stations',    color: 'text-blue',      role: 'picker' },
  { key: 'pending_packing',    label: 'Pending Packing',      description: 'Orders waiting at pack stations',    color: 'text-orange',    role: 'packer' },
  { key: 'pending_sorting',    label: 'Pending Sorting',      description: 'Items on sorting conveyor',          color: 'text-purple-400', role: 'sorter' },
  { key: 'backlog_orders',     label: 'Backlog Orders',       description: 'Carried over / not yet started',    color: 'text-yellow' },
  { key: 'remaining_due_date', label: 'Remaining Due Date',   description: 'Cutoff 19:00 — orders not dispatched', color: 'text-success' },
  { key: 'remaining_same_day', label: 'Remaining Same Day',   description: 'Cutoff 13:00 — HIGHEST PRIORITY',   color: 'text-red' },
  { key: 'remaining_intraday', label: 'Remaining Intraday',   description: 'Cutoff 24:00 — lowest priority',    color: 'text-blue' },
]

type FormValues = Record<string, number>

export function OpsSnapshotPage() {
  const latestOps = useAppStore(s => s.latestOpsSnapshot)
  const engineResult = useAppStore(s => s.engineResult)
  const forecast = useAppStore(s => s.todayForecast)
  const { data: history = [] } = useOpsHistory(5)
  const createSnapshot = useCreateOpsSnapshot()

  const [form, setForm] = useState<FormValues>({
    pending_picking:    latestOps?.pending_picking    ?? 0,
    pending_packing:    latestOps?.pending_packing    ?? 0,
    pending_sorting:    latestOps?.pending_sorting    ?? 0,
    backlog_orders:     latestOps?.backlog_orders     ?? 0,
    remaining_due_date: latestOps?.remaining_due_date ?? forecast?.due_date_orders ?? 0,
    remaining_same_day: latestOps?.remaining_same_day ?? forecast?.same_day_orders ?? 0,
    remaining_intraday: latestOps?.remaining_intraday ?? forecast?.intraday_orders ?? 0,
  })
  const [notes, setNotes] = useState(latestOps?.notes ?? '')

  useEffect(() => {
    if (latestOps) {
      setForm({
        pending_picking:    latestOps.pending_picking,
        pending_packing:    latestOps.pending_packing,
        pending_sorting:    latestOps.pending_sorting,
        backlog_orders:     latestOps.backlog_orders,
        remaining_due_date: latestOps.remaining_due_date,
        remaining_same_day: latestOps.remaining_same_day,
        remaining_intraday: latestOps.remaining_intraday,
      })
      setNotes(latestOps.notes ?? '')
    }
  }, [latestOps?.id])

  const snapshotAge = latestOps ? getSnapshotAge(latestOps.recorded_at) : null

  async function handleSave() {
    try {
      await createSnapshot.mutateAsync({ ...form, notes: notes || undefined } as Parameters<typeof createSnapshot.mutateAsync>[0])
      toast.success('Ops Snapshot saved — algorithm recomputed')
    } catch {
      toast.error('Failed to save snapshot')
    }
  }

  // Preview: show algorithm impact per queue field
  function getFieldTTE(key: string): number | null {
    if (!engineResult) return null
    const roleMap: Record<string, string> = {
      pending_picking: 'picker',
      pending_packing: 'packer',
      pending_sorting: 'sorter',
    }
    const role = roleMap[key]
    if (!role) return null
    return engineResult.role_capacity.find(r => r.role === role)?.tte_minutes ?? null
  }

  function getPressure(key: string): number | null {
    if (!engineResult) return null
    const roleMap: Record<string, string> = {
      pending_picking: 'picker',
      pending_packing: 'packer',
      pending_sorting: 'sorter',
    }
    const role = roleMap[key]
    if (!role) return null
    return engineResult.role_capacity.find(r => r.role === role)?.pressure_ratio ?? null
  }

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="OPS SNAPSHOT"
        subtitle="Enter live floor counts. Algorithm re-runs on save."
        actions={
          snapshotAge && (
            <div className={cn('text-xs font-mono', snapshotAge.isStale ? 'text-yellow' : 'text-muted')}>
              Last: {snapshotAge.label}
              {snapshotAge.isStale && ' ⚠ STALE'}
            </div>
          )
        }
      />

      <div className="p-8">
        <div className="grid grid-cols-3 gap-8">
          {/* LEFT: Input form */}
          <div className="col-span-2 space-y-3">
            {/* Queue section */}
            <div className="panel">
              <div className="text-xs font-bold tracking-widest text-info uppercase mb-4 pb-2 border-b border-border">
                ⬡ Station Queue Depths
              </div>
              <div className="space-y-1">
                {FIELDS.slice(0, 3).map(field => {
                  const tte = getFieldTTE(field.key)
                  const pressure = getPressure(field.key)
                  const isCritical = pressure !== null && pressure > 2.0

                  return (
                    <div
                      key={field.key}
                      className={cn(
                        'flex items-center gap-4 p-3 rounded-lg border',
                        isCritical ? 'bg-red/5 border-red/20' : 'border-transparent hover:bg-surface3/30',
                      )}
                    >
                      <div className="flex-1">
                        <div className={cn('text-sm font-semibold', field.color)}>{field.label}</div>
                        <div className="text-xs text-muted">{field.description}</div>
                      </div>

                      {/* TTE/Pressure preview */}
                      {tte !== null && (
                        <div className="text-right">
                          <div className={cn('font-mono text-xs', pressureColor(pressure))}>
                            {pressure !== null ? `${pressure.toFixed(2)}×` : '—'}
                          </div>
                          <div className="font-mono text-[10px] text-muted">TTE {formatTTE(tte)}</div>
                        </div>
                      )}

                      {/* Input */}
                      <input
                        type="number"
                        min={0}
                        value={form[field.key]}
                        onChange={e => setForm(prev => ({ ...prev, [field.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        className="input w-28 text-right font-mono text-lg font-bold"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* SLA remaining */}
            <div className="panel">
              <div className="text-xs font-bold tracking-widest text-muted uppercase mb-4 pb-2 border-b border-border">
                Remaining Orders by SLA Type
              </div>
              <div className="space-y-1">
                {FIELDS.slice(3).map(field => (
                  <div
                    key={field.key}
                    className="flex items-center gap-4 p-3 rounded-lg hover:bg-surface3/30"
                  >
                    <div className="flex-1">
                      <div className={cn('text-sm font-semibold', field.color)}>{field.label}</div>
                      <div className="text-xs text-muted">{field.description}</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={form[field.key]}
                      onChange={e => setForm(prev => ({ ...prev, [field.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="input w-28 text-right font-mono text-lg font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Notes + Save */}
            <div className="panel">
              <label className="label block mb-2">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. AutoStore zone B slow, engineer on-site…"
                rows={2}
                className="input resize-none mb-4"
              />

              {/* Algorithm preview */}
              {engineResult && (
                <div className="bg-success/5 border border-success/15 rounded-lg p-3 mb-4 text-xs text-success/80 leading-relaxed">
                  <strong className="text-success block mb-1">Algorithm Preview</strong>
                  Bottleneck: <span className="font-semibold text-success">
                    {engineResult.bottleneck_role ?? 'none'}
                  </span> ·
                  Overall risk: <span className={cn('font-semibold', engineResult.overall_risk > 0.6 ? 'text-red' : engineResult.overall_risk > 0.3 ? 'text-yellow' : 'text-success')}>
                    {Math.round(engineResult.overall_risk * 100)}%
                  </span> ·
                  {engineResult.suggestions.length} reallocation{engineResult.suggestions.length !== 1 ? 's' : ''} suggested
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={createSnapshot.isPending}
                className="btn-primary w-full py-3 text-sm"
              >
                {createSnapshot.isPending ? 'Saving…' : '💾 Save Snapshot & Re-run Algorithm'}
              </button>
            </div>
          </div>

          {/* RIGHT: History */}
          <div className="space-y-4">
            <div className="panel">
              <div className="text-xs font-bold tracking-widest text-muted uppercase mb-4 pb-2 border-b border-border">
                Snapshot History
              </div>
              <div className="space-y-3">
                {history.map((snap, i) => {
                  const age = getSnapshotAge(snap.recorded_at)
                  return (
                    <div
                      key={snap.id}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer hover:border-border2 transition-colors',
                        i === 0 ? 'border-info/25 bg-info/5' : 'border-border bg-surface3/30',
                      )}
                      onClick={() => setForm({
                        pending_picking: snap.pending_picking,
                        pending_packing: snap.pending_packing,
                        pending_sorting: snap.pending_sorting,
                        backlog_orders: snap.backlog_orders,
                        remaining_due_date: snap.remaining_due_date,
                        remaining_same_day: snap.remaining_same_day,
                        remaining_intraday: snap.remaining_intraday,
                      })}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs text-slate-300">
                          {formatTime(snap.recorded_at)}
                        </span>
                        {i === 0 && (
                          <span className="text-[9px] font-bold font-mono text-info tracking-wider">LATEST</span>
                        )}
                        {age.isStale && i === 0 && (
                          <span className="text-[9px] font-bold font-mono text-yellow tracking-wider">STALE</span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                        <div><span className="text-muted">PK:</span> <span className="text-blue">{snap.pending_picking}</span></div>
                        <div><span className="text-muted">PA:</span> <span className="text-orange">{snap.pending_packing}</span></div>
                        <div><span className="text-muted">SO:</span> <span className="text-purple-400">{snap.pending_sorting}</span></div>
                      </div>
                      {snap.notes && (
                        <div className="text-xs text-muted mt-1.5 truncate">{snap.notes}</div>
                      )}
                    </div>
                  )
                })}
                {history.length === 0 && (
                  <div className="text-center py-6 text-muted text-xs">No snapshots yet today</div>
                )}
              </div>
            </div>

            {/* Tips */}
            <div className="panel bg-surface3/50">
              <div className="text-xs font-bold tracking-widest text-muted uppercase mb-3">Tips</div>
              <ul className="space-y-2 text-xs text-muted">
                <li>• Take a snapshot every 30–60 min during peak hours</li>
                <li>• Pending Packing drives SLA risk — update first</li>
                <li>• Click any history entry to load its values</li>
                <li>• System alerts if snapshot is &gt;90 min old</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
