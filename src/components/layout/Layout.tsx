import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', icon: '⊞', label: 'Dashboard' },
  { to: '/team',      icon: '👥', label: 'Employees' },
  { to: '/ops',       icon: '🎯', label: 'Roles & Skills' },
  { to: '/schedule',  icon: '📅', label: 'Daily Planning' },
  { to: '/forecast',  icon: '⏱', label: 'Live Allocation' },
  { to: '/breaks',    icon: '☕', label: 'Breaks', badge: true },
  { to: '/workload',  icon: '📦', label: 'Workload' },
  { to: '/reports',   icon: '📊', label: 'Reports' },
  { to: '/copilot',   icon: '🤖', label: 'AI Copilot' },
  { to: '/settings',  icon: '⚙️', label: 'Settings' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const alerts = useAppStore(s => s.alerts)
  const unacked = alerts.filter(a => !a.acknowledged_at).length

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f2f7' }}>

      {/* ── SIDEBAR ── */}
      <aside className="w-48 flex-shrink-0 flex flex-col" style={{ background: '#1e2433' }}>

        {/* Logo */}
        <div className="px-4 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue flex items-center justify-center text-white font-bold text-sm flex-shrink-0">FB</div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">Warehouse</div>
              <div className="text-white font-bold text-sm leading-tight">Copilot</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue text-white font-semibold'
                  : 'text-white/55 hover:bg-white/10 hover:text-white/90',
              )}
            >
              <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>
              <span className="flex-1">{label}</span>
              {badge && unacked > 0 && (
                <span className="bg-red text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unacked}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue to-purple flex items-center justify-center text-white font-bold text-xs flex-shrink-0">ΣΤ</div>
            <div>
              <div className="text-white font-semibold text-xs">Team Leader</div>
              <div className="text-white/40 text-[10px] flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse2"/>Online
              </div>
            </div>
          </div>
          <div className="text-white/30 text-[10px] text-center mt-3 font-semibold tracking-wide">FBS Warehouse</div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  )
}

