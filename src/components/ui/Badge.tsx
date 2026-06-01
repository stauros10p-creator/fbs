import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'blue' | 'orange' | 'red' | 'yellow' | 'cyan' | 'purple' | 'muted'
  className?: string
}

const VARIANTS = {
  green:  'bg-green/10 text-green border-green/20',
  blue:   'bg-blue/10 text-blue border-blue/20',
  orange: 'bg-orange/10 text-orange border-orange/20',
  red:    'bg-red/10 text-red border-red/20',
  yellow: 'bg-yellow/10 text-yellow border-yellow/20',
  cyan:   'bg-cyan/10 text-cyan border-cyan/20',
  purple: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  muted:  'bg-muted/10 text-muted border-muted/20',
}

export function Badge({ children, variant = 'muted', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center font-mono text-[10px] font-bold tracking-wide px-2 py-0.5 rounded border',
      VARIANTS[variant],
      className,
    )}>
      {children}
    </span>
  )
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    operator: 'green', picker: 'blue', packer: 'orange',
    validator: 'purple', sorter: 'yellow', transporter: 'cyan',
  }
  const labels: Record<string, string> = {
    operator: 'OP', picker: 'PK', packer: 'PA',
    validator: 'VA', sorter: 'SO', transporter: 'TR',
  }
  return <Badge variant={map[role] ?? 'muted'}>{labels[role] ?? role.toUpperCase().slice(0, 2)}</Badge>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    working: 'green', break: 'yellow', sick: 'red',
    vacation: 'blue', off: 'muted', redeployed: 'cyan',
  }
  return <Badge variant={map[status] ?? 'muted'}>{status}</Badge>
}

export function PressureBadge({ pressure }: { pressure: number | null }) {
  if (pressure === null) return <span className="text-muted font-mono text-xs">—</span>
  const variant = pressure < 0.5 ? 'green' : pressure < 1.0 ? 'yellow' : pressure < 1.5 ? 'orange' : 'red'
  return <Badge variant={variant}>{pressure.toFixed(2)}×</Badge>
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    info: 'blue', warning: 'yellow', critical: 'red',
  }
  return <Badge variant={map[severity] ?? 'muted'}>{severity}</Badge>
}
