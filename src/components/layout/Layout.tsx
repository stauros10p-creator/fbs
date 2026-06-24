import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Truck, Users, CalendarDays,
  ShieldCheck, FileBarChart, Bell, Cpu, Settings,
  Package, ChevronDown, ChevronRight, PackageOpen, GitCompareArrows, RotateCcw, LogOut,
  Activity, Trophy, Flame, BarChart2, ListFilter,
} from 'lucide-react'
import { logout, getAuthUser } from '@/pages/LoginPage'

// ── Employees submenu ────────────────────────────────────────────────────────
const EMPLOYEES_SUB = [
  { to: '/team',                  Icon: LayoutDashboard, label: 'Overview'          },
  { to: '/team/employees',        Icon: ListFilter,      label: 'Shift Management'  },
  { to: '/team/top-performers',   Icon: Trophy,          label: 'Top Performers'    },
  { to: '/team/impact',           Icon: Flame,           label: 'Impact Score'      },
  { to: '/team/heatmap',          Icon: Activity,        label: 'Heatmap'           },
]

const OUTBOUND_NAV = [
  { to: '/dashboard',       Icon: LayoutDashboard, label: 'Dashboard'            },
  { to: '/ops',             Icon: Truck,           label: 'Operations - Reports' },
  { to: '/forecast',        Icon: CalendarDays,    label: 'Schedule'             },
  { to: '/schedule',        Icon: ShieldCheck,     label: 'SLA Monitor'          },
  { to: '/hourly-forecast', Icon: FileBarChart,    label: 'Reports'              },
  { to: '/copilot',         Icon: Bell,            label: 'Alerts', badge: true  },
  { to: '/copilot',         Icon: Cpu,             label: 'Algorithms'           },
  { to: '/copilot',         Icon: Settings,        label: 'Settings'             },
]

const INBOUND_NAV: { to: string; Icon: any; label: string; badge?: boolean }[] = [
  { to: '/ops/inbound',    Icon: PackageOpen,      label: 'Παραλαβές & Putaway'     },
  { to: '/ops/afixeis',    Icon: GitCompareArrows, label: 'Αφίξεις vs Παραλαβές'   },
  { to: '/ops/epistrofes', Icon: RotateCcw,        label: 'Επιστροφές'              },
]

// ── Employees nav item with expandable submenu ────────────────────────────────
function EmployeesNav() {
  const location = useLocation()
  const isEmployeesActive = location.pathname.startsWith('/team')
  const [open, setOpen] = useState(isEmployeesActive)

  return (
    <div>
      {/* Main employees row */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ml-1',
          isEmployeesActive
            ? 'bg-blue-600/80 text-white'
            : 'text-white/55 hover:bg-white/8 hover:text-white/90',
        )}
      >
        <Users className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">Employees</span>
        {open
          ? <ChevronDown  className="w-3.5 h-3.5 opacity-60" />
          : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
      </button>

      {/* Submenu */}
      {open && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
          {EMPLOYEES_SUB.map(({ to, Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/team'}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-white/50 hover:bg-white/8 hover:text-white/85',
              )}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Generic nav section ───────────────────────────────────────────────────────
function NavSection({
  title, icon: Icon, items, unacked, defaultOpen = true,
}: {
  title: string; icon: any
  items: typeof OUTBOUND_NAV
  unacked: number; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-white/40 hover:text-white/70 transition-colors"
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left text-[10px] font-bold tracking-widest uppercase">{title}</span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {open && (
        <div className="space-y-0.5 mb-2">
          {items.length === 0 ? (
            <div className="px-3 py-2 text-white/25 text-xs italic">Σύντομα...</div>
          ) : (
            items.map(({ to, Icon: ItemIcon, label, badge }, i) => (
              <NavLink
                key={`${to}-${i}`}
                to={to}
                end={to === '/dashboard'}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ml-1',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-white/55 hover:bg-white/8 hover:text-white/90',
                )}
              >
                <ItemIcon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {badge && unacked > 0 && (
                  <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {unacked}
                  </span>
                )}
              </NavLink>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────
export function Layout({ children }: { children: React.ReactNode }) {
  const alerts   = useAppStore(s => s.alerts)
  const unacked  = alerts.filter(a => !a.acknowledged_at).length
  const authUser = getAuthUser()
  const initials = authUser?.displayName
    ? authUser.displayName.substring(0, 2).toUpperCase()
    : '??'

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* ── SIDEBAR ── */}
      <aside className="w-52 flex-shrink-0 flex flex-col bg-slate-900">

        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              WC
            </div>
            <div className="leading-tight">
              <div className="text-white font-bold text-sm">Warehouse</div>
              <div className="text-white/60 text-[11px] font-medium">Copilot</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">

          {/* Outbound section header */}
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-white/30 flex items-center gap-2">
            <Package className="w-3.5 h-3.5" /> Outbound
          </div>

          {/* Outbound items (Dashboard, Ops — then Employees with submenu, then rest) */}
          {OUTBOUND_NAV.slice(0, 2).map(({ to, Icon, label, badge }, i) => (
            <NavLink
              key={`out-${i}`}
              to={to}
              end={to === '/dashboard'}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ml-1',
                isActive ? 'bg-blue-600 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white/90',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && unacked > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unacked}
                </span>
              )}
            </NavLink>
          ))}

          {/* Employees with expandable submenu */}
          <EmployeesNav />

          {/* Rest of outbound */}
          {OUTBOUND_NAV.slice(2).map(({ to, Icon, label, badge }, i) => (
            <NavLink
              key={`out2-${i}`}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ml-1',
                isActive ? 'bg-blue-600 text-white' : 'text-white/55 hover:bg-white/8 hover:text-white/90',
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge && unacked > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unacked}
                </span>
              )}
            </NavLink>
          ))}

          <div className="border-t border-white/10 my-2" />

          {/* Inbound */}
          <NavSection title="Inbound" icon={Truck} items={INBOUND_NAV} unacked={unacked} defaultOpen={true} />
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold text-xs truncate">{authUser?.displayName ?? 'User'}</div>
              <div className="text-white/45 text-[10px] truncate">Warehouse Copilot</div>
            </div>
          </div>
          <div className="text-white/30 text-[10px] mt-2.5 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
            Main Warehouse Athens, GR
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full flex items-center gap-2 text-white/30 hover:text-white/70 text-[11px] transition-colors"
          >
            <LogOut className="w-3 h-3" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {children}
      </main>
    </div>
  )
}
