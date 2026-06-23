import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  accent?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, accent, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('px-8 pt-8 pb-6 border-b border-border flex items-end justify-between gap-4', className)}>
      <div>
        {accent && (
          <div className="text-xs font-mono tracking-widest text-muted uppercase mb-1">{accent}</div>
        )}
        <h1 className="font-sans font-bold tracking-tight text-3xl text-slate-800 leading-none">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted mt-2">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
    </div>
  )
}
