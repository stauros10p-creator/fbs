import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, BarChart3,
  Crosshair, Bot, Circle, Package,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ops',       icon: Crosshair,       label: 'Ops Snapshot', highlight: true },
  { to: '/team',      icon: Users,           label: 'Team' },
  { to: '/schedule',  icon: Calendar,        label: 'Schedule' },
  { to: '/forecast',  icon: BarChart3,       label: 'Forecast' },
  { to: '/copilot',   icon: Bot,             label: 'AI Copilot' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const alerts      = useAppStore(s => s.alerts)
  const engineResult = useAppStore(s => s.engineResult)
  const unacked     = alerts.filter(a => !a.acknowledged_at).length

  const now     = new Date()
  const timeStr = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'short' })

  const risk      = engineResult?.overall_risk ?? 0
  const riskPct   = Math.round(risk * 100)
  const riskColor = risk < 0.3 ? 'text-success' : risk < 0.6 ? 'text-warning' : risk < 0.8 ? 'text-orange-400' : 'text-danger'
  const riskBar   = risk < 0.3 ? 'bg-success'   : risk < 0.6 ? 'bg-warning'   : risk < 0.8 ? 'bg-orange-400'   : 'bg-danger'

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-surface border-r border-border">

        {/* Logo / Brand */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-accent" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-100 leading-none">FBS Stavros</div>
              <div className="text-xs text-muted mt-0.5">Warehouse Copilot</div>
            </div>
          </div>
        </div>

        {/* Live clock */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-base font-semibold text-slate-100">{timeStr}</div>
            <div className="text-xs text-muted capitalize">{dateStr}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <Circle className="w-2 h-2 fill-success text-success animate-pulse2" />
            <span className="text-xs text-muted font-mono">LIVE</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label, highlight }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : highlight
                  ? 'text-info hover:bg-info/5 border border-transparent hover:border-info/20'
                  : 'text-text2 hover:text-slate-100 hover:bg-surface3 border border-transparent',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {to === '/dashboard' && unacked > 0 && (
                <span className="ml-auto bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unacked}
                </span>
              )}
              {to === '/ops' && (
                <span className="ml-auto text-[10px] font-mono text-info/60 font-semibold">NEW</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* SLA Risk meter */}
        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">SLA Risk</span>
            <span className={cn('font-mono text-sm font-bold', riskColor)}>{riskPct}%</span>
          </div>
          <div className="h-1.5 bg-surface3 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-1000', riskBar)}
              style={{ width: `${riskPct}%` }}
            />
          </div>
          <div className="text-xs text-muted mt-1.5">
            {risk < 0.3 ? 'On track' : risk < 0.6 ? 'Monitor closely' : risk < 0.8 ? 'At risk' : 'Critical — act now'}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
