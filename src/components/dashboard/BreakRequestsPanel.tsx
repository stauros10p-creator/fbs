import { Coffee, Check, X } from 'lucide-react'
import type { BreakRequest } from '@/types'
import { useApproveBreak, useDenyBreak } from '@/hooks'
import { useAppStore } from '@/store'
import { evaluateBreakSafety } from '@/lib/engine'
import { initials } from '@/lib/utils'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface BreakRequestsPanelProps {
  requests: BreakRequest[]
}

export function BreakRequestsPanel({ requests }: BreakRequestsPanelProps) {
  const approve = useApproveBreak()
  const deny = useDenyBreak()
  const employees = useAppStore(s => s.employees)
  const ops = useAppStore(s => s.latestOpsSnapshot)
  const forecast = useAppStore(s => s.todayForecast)

  const pending = requests.filter(r => r.status === 'pending')
  const active  = requests.filter(r => r.status === 'active')

  if (requests.length === 0) return null

  async function handleApprove(req: BreakRequest) {
    if (!req.employee) return
    const safety = evaluateBreakSafety(req.employee, employees, ops, forecast)

    if (safety.status === 'supervisor_review') {
      const ok = window.confirm(`⚠️ ${safety.message}\n\nApprove anyway?`)
      if (!ok) return
    } else if (safety.status === 'caution') {
      toast(safety.message, { icon: '⚠️' })
    }

    try {
      await approve.mutateAsync({ break_id: req.id, employee_id: req.employee_id })
      toast.success(`Break approved for ${req.employee?.full_name ?? 'employee'} — returns at ${new Date(Date.now() + 30 * 60000).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}`)
    } catch {
      toast.error('Failed to approve break')
    }
  }

  async function handleDeny(req: BreakRequest) {
    try {
      await deny.mutateAsync(req.id)
      toast.success('Break denied')
    } catch {
      toast.error('Failed to deny break')
    }
  }

  return (
    <div className="panel border-yellow/20">
      <div className="text-xs font-bold tracking-widest text-yellow uppercase mb-3 pb-2 border-b border-border flex items-center gap-2">
        <Coffee className="w-3.5 h-3.5" />
        Break Requests
        {pending.length > 0 && (
          <span className="bg-yellow text-bg text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto">
            {pending.length} pending
          </span>
        )}
      </div>

      <div className="space-y-2">
        {pending.map(req => {
          const safety = req.employee
            ? evaluateBreakSafety(req.employee, employees, ops, forecast)
            : null

          return (
            <div
              key={req.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                safety?.status === 'supervisor_review'
                  ? 'bg-red/5 border-red/20'
                  : safety?.status === 'caution'
                  ? 'bg-yellow/5 border-yellow/20'
                  : 'bg-surface3 border-border',
              )}
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-surface2 border border-border flex items-center justify-center text-xs font-bold text-green font-mono flex-shrink-0">
                {initials(req.employee?.full_name ?? '?')}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-200">{req.employee?.full_name ?? 'Unknown'}</div>
                <div className="text-xs text-muted">
                  {req.employee?.primary_role} · requested {new Date(req.requested_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                {safety && (
                  <div className={cn(
                    'text-xs mt-0.5',
                    safety.status === 'supervisor_review' ? 'text-red' : safety.status === 'caution' ? 'text-yellow' : 'text-green',
                  )}>
                    {safety.status === 'auto_approve' ? '✓ Safe to approve'
                     : safety.status === 'caution' ? '⚠ Approve with caution'
                     : '🔴 High risk — review first'}
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleApprove(req)}
                  disabled={approve.isPending}
                  className="w-8 h-8 rounded-full bg-green/10 border border-green/30 text-green hover:bg-green/20 transition-colors flex items-center justify-center"
                  title="Approve"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeny(req)}
                  disabled={deny.isPending}
                  className="w-8 h-8 rounded-full bg-red/10 border border-red/30 text-red hover:bg-red/20 transition-colors flex items-center justify-center"
                  title="Deny"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}

        {/* Active breaks */}
        {active.map(req => (
          <div key={req.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface3 border border-border opacity-60">
            <div className="w-8 h-8 rounded-full bg-yellow/10 border border-yellow/30 flex items-center justify-center text-xs font-bold text-yellow font-mono">
              {initials(req.employee?.full_name ?? '?')}
            </div>
            <div className="flex-1">
              <div className="text-sm text-muted">{req.employee?.full_name}</div>
              <div className="text-xs text-muted">
                On break · returns {new Date(req.break_end ?? '').toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <Coffee className="w-4 h-4 text-yellow" />
          </div>
        ))}
      </div>
    </div>
  )
}
