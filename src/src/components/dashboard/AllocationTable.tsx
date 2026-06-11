import { cn } from '@/lib/utils'
import { formatTTE, formatPressure, pressureColor } from '@/lib/engine'
import type { RoleCapacity, EmployeeRole } from '@/types'
import { ROLE_CONFIG } from '@/types'
import { PressureBadge } from '@/components/ui/Badge'

const STATUS_STYLES = {
  ok:       { label: 'OK',       cls: 'bg-success/10 text-success border-success/20' },
  watch:    { label: 'WATCH',    cls: 'bg-yellow/10 text-yellow border-yellow/20' },
  risk:     { label: 'RISK',     cls: 'bg-orange/10 text-orange border-orange/20' },
  critical: { label: 'CRITICAL', cls: 'bg-red/10 text-red border-red/20' },
  surplus:  { label: 'SURPLUS',  cls: 'bg-blue/10 text-blue border-blue/20' },
}

interface AllocationTableProps {
  roleCapacity: RoleCapacity[]
}

export function AllocationTable({ roleCapacity }: AllocationTableProps) {
  if (roleCapacity.length === 0) {
    return (
      <div className="panel text-center py-12 text-muted text-sm">
        Loading allocation data…
      </div>
    )
  }

  return (
    <div className="panel">
      <div className="text-xs font-bold tracking-widest text-success uppercase mb-4 pb-2 border-b border-border flex items-center gap-2">
        ▣ Role Allocation — Live Pressure View
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['Role', 'Active', 'Required', 'Gap', 'Queue', 'Cap/hr', 'TTE', 'Pressure', 'Status'].map(h => (
                <th key={h} className="text-left font-mono text-[10px] tracking-widest text-muted uppercase pb-3 pr-4 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {roleCapacity.map(rc => {
              const cfg = ROLE_CONFIG[rc.role]
              const st = STATUS_STYLES[rc.status]
              const gapColor = rc.gap < 0 ? 'text-red font-bold' : rc.gap > 0 ? 'text-blue' : 'text-muted'
              const isCritical = rc.status === 'critical'

              return (
                <tr
                  key={rc.role}
                  className={cn(
                    'transition-colors',
                    isCritical ? 'bg-red/5' : 'hover:bg-surface3/50',
                  )}
                >
                  {/* Role */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-6 rounded-full"
                        style={{ background: cfg.color }}
                      />
                      <span className={cn('font-semibold text-sm', isCritical ? 'text-orange' : 'text-slate-200')}>
                        {cfg.label}
                      </span>
                    </div>
                  </td>

                  {/* Active */}
                  <td className="py-3 pr-4 font-mono text-slate-200">{rc.active_count}</td>

                  {/* Required */}
                  <td className="py-3 pr-4 font-mono text-muted">{rc.required_count}</td>

                  {/* Gap */}
                  <td className="py-3 pr-4">
                    <span className={cn('font-mono text-sm', gapColor)}>
                      {rc.gap > 0 ? `+${rc.gap}` : rc.gap}
                    </span>
                  </td>

                  {/* Queue */}
                  <td className="py-3 pr-4">
                    {rc.queue_depth !== null ? (
                      <span className="font-mono text-info">{rc.queue_depth.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted font-mono">—</span>
                    )}
                  </td>

                  {/* Capacity/hr */}
                  <td className="py-3 pr-4">
                    {rc.effective_capacity_per_hour > 0 ? (
                      <span className="font-mono text-slate-300">
                        {rc.effective_capacity_per_hour.toLocaleString()}/hr
                      </span>
                    ) : (
                      <span className="text-muted font-mono">—</span>
                    )}
                  </td>

                  {/* TTE */}
                  <td className="py-3 pr-4">
                    <span className={cn(
                      'font-mono text-sm',
                      rc.tte_minutes !== null
                        ? rc.tte_minutes < 30 ? 'text-success'
                        : rc.tte_minutes < 60 ? 'text-yellow'
                        : rc.tte_minutes < 90 ? 'text-orange'
                        : 'text-red'
                        : 'text-muted',
                    )}>
                      {formatTTE(rc.tte_minutes)}
                    </span>
                  </td>

                  {/* Pressure */}
                  <td className="py-3 pr-4">
                    <PressureBadge pressure={rc.pressure_ratio} />
                  </td>

                  {/* Status */}
                  <td className="py-3">
                    <span className={cn(
                      'font-mono text-[10px] font-bold tracking-wide px-2 py-0.5 rounded border',
                      st.cls,
                    )}>
                      {st.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
