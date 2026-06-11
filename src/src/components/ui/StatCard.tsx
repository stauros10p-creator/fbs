import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  className?: string
  urgent?: boolean
}

export function StatCard({ label, value, sub, color = 'text-success', className, urgent }: StatCardProps) {
  return (
    <div className={cn(
      'bg-surface2 border border-border rounded-lg p-4 flex flex-col gap-1',
      urgent && 'border-red/30 bg-red/5',
      className,
    )}>
      <div className="text-xs text-muted uppercase tracking-wider font-semibold">{label}</div>
      <div className={cn('font-mono text-2xl font-bold leading-tight', color)}>{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  )
}
