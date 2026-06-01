import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, BarChart3,
  Crosshair, Bot, AlertTriangle, Circle,
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
  const alerts = useAppStore(s => s.alerts)
  const engineResult = useAppStore(s => s.engineResult)
  const unacked = alerts.filter(a => !a.acknowledged_at).length
  const now = new Date()
  const timeStr = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('el-GR', { weekday: 'short', day: 'numeric', month: 'short' })

  const riskScore = engineResult?.overall_risk ?? 0
  const riskColor = riskScore < 0.3 ? 'text-green' : riskScore < 0.6 ? 'text-yellow' : riskScore < 0.8 ? 'text-orange' : 'text-red'

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-surface border-r border-border">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="font-display text-xl tracking-widest text-green">WH·COPILOT</div>
          <div className="text-xs text-muted mt-1 font-mono">v1.1 MVP</div>
        </div>

        {/* Live status */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Circle className="w-2 h-2 fill-green text-green animate-pulse2" />
            <span className="text-xs text-muted font-mono">LIVE</span>
          </div>
          <div className="font-mono text-sm text-slate-200">{timeStr}</div>
          <div className="text-xs text-muted">{dateStr}</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV.map(({ to, icon: Icon, label, highlight }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-all',
                isActive
                  ? 'bg-green/10 text-green border border-green/20'
                  : highlight
                  ? 'text-cyan hover:bg-cyan/5 border border-transparent hover:border-cyan/20'
                  : 'text-muted hover:text-slate-200 hover:bg-surface2 border border-transparent',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {to === '/dashboard' && unacked > 0 && (
                <span className="ml-auto bg-red text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unacked}
                </span>
              )}
              {to === '/ops' && (
                <span className="ml-auto text-xs font-mono text-cyan/60">NEW</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Risk indicator */}
        <div className="px-5 py-4 border-t border-border">
          <div className="text-xs text-muted mb-1.5 font-semibold tracking-wider uppercase">SLA Risk</div>
          <div className={cn('font-mono text-2xl font-bold', riskColor)}>
            {Math.round(riskScore * 100)}%
          </div>
          <div className="h-1 bg-surface3 rounded-full mt-2 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                riskScore < 0.3 ? 'bg-green' : riskScore < 0.6 ? 'bg-yellow' : riskScore < 0.8 ? 'bg-orange' : 'bg-red',
              )}
              style={{ width: `${Math.round(riskScore * 100)}%` }}
            />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
