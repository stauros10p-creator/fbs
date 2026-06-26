import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, PackageOpen, RotateCcw, BarChart2,
  CalendarDays, Users, ChevronDown, ChevronRight,
  ShieldCheck, Trophy, Flame, Activity, ListFilter, LogOut,
} from 'lucide-react'
import { logout, getAuthUser } from '@/pages/LoginPage'

const FBS_OUTBOUND_SUB = [
  { to: '/outbound/overview',             label: 'Overview'                    },
  { to: '/outbound/download-throughput',  label: 'AS - Download Throughput'    },
  { to: '/outbound/live-port-monitoring', label: 'AS - Live Port Monitoring', live: true },
  { to: '/outbound/mono-multi',           label: 'AS - Mono Multi per Day'     },
  { to: '/outbound/picking-per-port',     label: 'AS - Picking per Port'       },
]

const EMPLOYEES_SUB = [
  { to: '/team',                Icon: LayoutDashboard, label: 'Overview',         end: true  },
  { to: '/team/employees',      Icon: ListFilter,      label: 'Shift Management', end: false },
  { to: '/team/top-performers', Icon: Trophy,          label: 'Top Performers',   end: false },
  { to: '/team/impact',         Icon: Flame,           label: 'Impact Score',     end: false },
  { to: '/team/heatmap',        Icon: Activity,        label: 'Heatmap',          end: false },
]

function CollapsibleNav({
  icon: Icon, label, children, isActive = false,
}: {
  icon: React.ElementType; label: string; children: React.ReactNode; isActive?: boolean
}) {
  const [open, setOpen] = useState(isActive)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
          isActive ? 'bg-blue-600/20 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white/90',
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 opacity-50" /> : <ChevronRight className="w-3.5 h-3.5 opacity-50" />}
      </button>
      {open && (
        <div className="ml-3 mt-0.5 border-l border-white/10 pl-2 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  )
}

function SubLink({ to, label, live }: { to: string; label: string; live?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all',
        isActive ? 'bg-blue-600 text-white' : 'text-white/50 hover:bg-white/8 hover:text-white/85',
      )}
    >
      <span className="flex-1">{label}</span>
      {live && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />}
    </NavLink>
  )
}

function SubIconLink({ to, icon: Icon, label, end: endProp }: {
  to: string; icon: React.ElementType; label: string; end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={endProp}
      className={({ isActive }) => cn(
        'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all',
        isActive ? 'bg-blue-600 text-white' : 'text-white/50 hover:bg-white/8 hover:text-white/85',
      )}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </NavLink>
  )
}

function NavItem({ to, icon: Icon, label, end: endProp }: {
  to: string; icon: React.ElementType; label: string; end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={endProp}
      className={({ isActive }) => cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
        isActive ? 'bg-blue-600 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white/90',
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{label}</span>
    </NavLink>
  )
}

function Divider() {
  return <div className="h-px bg-white/6 mx-1 my-1.5" />
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const authUser = getAuthUser()
  const initials = authUser?.displayName ? authUser.displayName.substring(0, 2).toUpperCase() : '??'
  const isOutbound = location.pathname.startsWith('/outbound')
  const isEmployees = location.pathname.startsWith('/team')

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="w-56 flex-shrink-0 flex flex-col bg-[#0f1117] border-r border-white/5">

        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">WC</div>
            <div>
              <div className="text-white font-bold text-sm">Warehouse</div>
              <div className="text-white/50 text-[11px]">Copilot</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" end />
          <Divider />

          {/* FBS Outbound */}
          <CollapsibleNav icon={Package} label="FBS - Outbound" isActive={isOutbound}>
            {FBS_OUTBOUND_SUB.map(s => <SubLink key={s.to} {...s} />)}
          </CollapsibleNav>

          {/* FBS Inbound */}
          <CollapsibleNav icon={PackageOpen} label="FBS - Inbound" isActive={false}>
            <div className="px-2.5 py-2 text-white/25 text-xs italic">Σύντομα...</div>
          </CollapsibleNav>

          {/* FBS Return Reports */}
          <CollapsibleNav icon={RotateCcw} label="FBS - Return Reports" isActive={false}>
            <div className="px-2.5 py-2 text-white/25 text-xs italic">Σύντομα...</div>
          </CollapsibleNav>

          <Divider />
          <NavItem to="/ops" icon={BarChart2} label="Operations Analytics" />
          <NavItem to="/forecast" icon={CalendarDays} label="Forecast" />
          <Divider />

          {/* Employees */}
          <CollapsibleNav icon={Users} label="Employees" isActive={isEmployees}>
            {EMPLOYEES_SUB.map(s => <SubIconLink key={s.to} to={s.to} icon={s.Icon} label={s.label} end={s.end} />)}
          </CollapsibleNav>

          <NavItem to="/schedule" icon={ShieldCheck} label="SLA Monitor" />
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/8">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold text-xs truncate">{authUser?.displayName ?? 'User'}</div>
              <div className="text-white/40 text-[10px]">Senior Supervisor</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-white/25 text-[10px] mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Athens Warehouse
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 text-white/30 hover:text-white/60 text-[11px] transition-colors">
            <LogOut className="w-3 h-3" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
