import { Link } from 'react-router-dom'
import { useAppStore } from '@/store'
import { getSnapshotAge } from '@/lib/utils'
import { formatTTE } from '@/lib/engine'
import { cn } from '@/lib/utils'

export function OpsSnapshotPanel() {
  const ops = useAppStore(s => s.latestOpsSnapshot)
  const engineResult = useAppStore(s => s.engineResult)

  if (!ops) {
    return (
      <div className="panel border-info/20 bg-info/5">
        <div className="text-xs font-bold tracking-widest text-info uppercase mb-3 pb-2 border-b border-border">
          ⬡ Ops Snapshot
        </div>
        <p className="text-sm text-muted mb-4">No snapshot recorded yet today.</p>
        <Link to="/ops" className="btn-primary block text-center">Record First Snapshot →</Link>
      </div>
    )
  }

  const age = getSnapshotAge(ops.recorded_at)
  const pickerRC = engineResult?.role_capacity.find(r => r.role === 'picker')
  const packerRC = engineResult?.role_capacity.find(r => r.role === 'packer')
  const sorterRC = engineResult?.role_capacity.find(r => r.role === 'sorter')

  const total = ops.remaining_due_date + ops.remaining_same_day + ops.remaining_intraday || 1

  return (
    <div className={cn('panel', age.isStale ? 'border-yellow/30 bg-yellow/5' : 'border-info/20 bg-info/5')}>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <div className="text-xs font-bold tracking-widest text-info uppercase">⬡ Ops Snapshot</div>
        <div className={cn('text-xs font-mono', age.isStale ? 'text-yellow' : 'text-muted')}>
          {age.label}
        </div>
      </div>

      {/* Queue depths */}
      <div className="space-y-2 mb-4">
        {[
          { label: 'Pending Picking', value: ops.pending_picking, tte: pickerRC?.tte_minutes, color: 'text-blue' },
          { label: 'Pending Packing', value: ops.pending_packing, tte: packerRC?.tte_minutes, color: packerRC?.status === 'critical' ? 'text-red' : packerRC?.status === 'risk' ? 'text-orange' : 'text-info', critical: packerRC?.status === 'critical' },
          { label: 'Pending Sorting', value: ops.pending_sorting, tte: sorterRC?.tte_minutes, color: 'text-purple-400' },
        ].map(({ label, value, tte, color, critical }) => (
          <div
            key={label}
            className={cn(
              'flex items-center justify-between py-2 px-2 -mx-2 rounded',
              critical ? 'bg-red/10' : 'hover:bg-surface3/30',
            )}
          >
            <span className="text-xs text-muted">{label}</span>
            <div className="text-right">
              <div className={cn('font-mono text-sm font-bold', color)}>{value.toLocaleString()}</div>
              {tte !== null && tte !== undefined && (
                <div className={cn('font-mono text-[10px]', tte < 30 ? 'text-success' : tte < 60 ? 'text-yellow' : 'text-red')}>
                  TTE {formatTTE(tte)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* SLA progress bars */}
      <div className="space-y-2.5 mb-4">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Remaining by SLA</div>
        {[
          { label: 'Due Date → 19:00', value: ops.remaining_due_date, color: 'bg-success' },
          { label: 'Same Day → 13:00', value: ops.remaining_same_day, color: 'bg-orange', urgent: true },
          { label: 'Intraday → 24:00', value: ops.remaining_intraday, color: 'bg-blue' },
        ].map(({ label, value, color, urgent }) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1">
              <span className={cn('text-muted', urgent && 'text-orange/80')}>{label}</span>
              <span className="font-mono text-slate-300">{value.toLocaleString()}</span>
            </div>
            <div className="h-1 bg-surface3 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', color)}
                style={{ width: `${Math.min(100, (value / total) * 100 * 3)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <Link to="/ops" className="btn-secondary block text-center">
        + Update Snapshot
      </Link>
    </div>
  )
}
