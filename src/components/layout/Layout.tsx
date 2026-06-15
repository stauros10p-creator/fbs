import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Truck, Users, BarChart2, CalendarDays,
  ShieldCheck, FileBarChart, Bell, Cpu, Settings,
  Package, ChevronDown, ChevronRight,
} from 'lucide-react'

const OUTBOUND_NAV = [
  { to: '/dashboard',       Icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/ops',             Icon: Truck,           label: 'Operations'   },
  { to: '/team',            Icon: Users,           label: 'Employees'    },
  { to: '/forecast',        Icon: BarChart2,       label: 'Forecast'     },
  { to: '/staff-plan',      Icon: CalendarDays,    label: 'Planning'     },
  { to: '/schedule',        Icon: ShieldCheck,     label: 'SLA Monitor'  },
  { to: '/hourly-forecast', Icon: FileBarChart,    label: 'Reports'      },
  { to: '/copilot',         Icon: Bell,            label: 'Alerts', badge: true },
  { to: '/copilot',         Icon: Cpu,             label: 'Algorithms'   },
  { to: '/copilot',         Icon: Settings,        label: 'Settings'     },
]

const INBOUND_NAV: { to: string; Icon: any; label: string; badge?: boolean }[] = [
  // θα προστεθούν σύντομα
]

function NavSection({
  title,
  icon: Icon,
  items,
  unacked,
  defaultOpen = true,
}: {
  title: string
  icon: any
  items: typeof OUTBOUND_NAV
  unacked: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-white/40 hover:text-white/70 transition-colors"
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left text-[10px] font-bold tracking-widest uppercase">{title}</span>
        {open
          ? <ChevronDown className="w-3 h-3" />
          : <ChevronRight className="w-3 h-3" />
        }
      </button>

      {/* Nav items */}
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

export function Layout({ children }: { children: React.ReactNode }) {
  const alerts  = useAppStore(s => s.alerts)
  const unacked = alerts.filter(a => !a.acknowledged_at).length

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
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          <NavSection
            title="Outbound"
            icon={Package}
            items={OUTBOUND_NAV}
            unacked={unacked}
            defaultOpen={true}
          />

          <div className="border-t border-white/10 my-1" />

          <NavSection
            title="Inbound"
            icon={Truck}
            items={INBOUND_NAV}
            unacked={unacked}
            defaultOpen={true}
          />
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              SP
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold text-xs truncate">Stavros</div>
              <div className="text-white/45 text-[10px] truncate">Warehouse shift supervisor</div>
            </div>
          </div>
          <div className="text-white/30 text-[10px] mt-2.5 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
            Main Warehouse Athens, GR
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {children}
      </main>
    </div>
  )
}
