import { X, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Alert } from '@/types'
import { useAcknowledgeAlert } from '@/hooks'

const SEVERITY_STYLES = {
  info:     { bar: 'bg-blue',    bg: 'bg-blue/5',    border: 'border-blue/20',    text: 'text-blue',    icon: Info },
  warning:  { bar: 'bg-yellow',  bg: 'bg-yellow/5',  border: 'border-yellow/20',  text: 'text-yellow',  icon: AlertTriangle },
  critical: { bar: 'bg-red',     bg: 'bg-red/5',     border: 'border-red/20',     text: 'text-red',     icon: AlertCircle },
}

export function AlertItem({ alert }: { alert: Alert }) {
  const acknowledge = useAcknowledgeAlert()
  const style = SEVERITY_STYLES[alert.severity]
  const Icon = style.icon

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3 rounded-lg border relative overflow-hidden',
      style.bg, style.border,
    )}>
      <div className={cn('absolute left-0 inset-y-0 w-1', style.bar)} />
      <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', style.text)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 leading-snug">{alert.message}</p>
        <p className="text-xs text-muted mt-0.5">
          {new Date(alert.created_at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <button
        onClick={() => acknowledge.mutate(alert.id)}
        className="text-muted hover:text-slate-200 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function AlertList({ alerts }: { alerts: Alert[] }) {
  const unacked = alerts.filter(a => !a.acknowledged_at)
  if (unacked.length === 0) {
    return (
      <div className="text-center py-6 text-muted text-sm">
        <div className="text-2xl mb-2">✓</div>
        No active alerts
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {unacked.map(alert => (
        <AlertItem key={alert.id} alert={alert} />
      ))}
    </div>
  )
}
