import { useState } from 'react'
import { useAppStore } from '@/store'
import { Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  Bell, ChevronDown, ChevronLeft, ChevronRight,
  ShoppingCart, Package, Clock, ShieldCheck, Users,
  ArrowUpRight, CalendarDays, ClipboardList, UserMinus, BarChart2, TrendingUp,
} from 'lucide-react'

// ── Mock "yesterday" data ─────────────────────────────────────────────────────
const HOURLY_DATA = [
  { t: '00:00', orders: 120,  units: 890,  labor: 240 },
  { t: '04:00', orders: 280,  units: 1080, labor: 380 },
  { t: '08:00', orders: 680,  units: 1320, labor: 520 },
  { t: '12:00', orders: 1180, units: 1450, labor: 680 },
  { t: '16:00', orders: 1240, units: 1380, labor: 720 },
  { t: '20:00', orders: 980,  units: 1100, labor: 580 },
  { t: '24:00', orders: 420,  units: 760,  labor: 320 },
]

const SLA_DATA = [
  { name: 'On Time', value: 12344, color: '#22c55e' },
  { name: 'Delayed', value: 356,   color: '#f59e0b' },
  { name: 'Failed',  value: 142,   color: '#ef4444' },
]

const YESTERDAY_ORDERS = [
  { type: 'Due Date (έως 19:00)',  color: '#3b82f6', orders: 7842,  units: 58210, pct: 60.9 },
  { type: 'Same Day (έως 13:00)',  color: '#22c55e', orders: 2856,  units: 21340, pct: 22.2 },
  { type: 'Intra Day (έως 00:00)', color: '#f59e0b', orders: 1645,  units: 12345, pct: 12.8 },
  { type: 'Ογκώδεις Παραγγελίες', color: '#f97316', orders: 499,   units: 4319,  pct: 4.1  },
]

const TOP_PERFORMERS = [
  { rank: 1, name: 'Maria Papadopoulou', role: 'Picker', units: 1250, medal: '🥇' },
  { rank: 2, name: 'Giorgos Ioannou',    role: 'Packer', units: 1180, medal: '🥈' },
  { rank: 3, name: 'Nikos Dimitriadis',  role: 'Sorter', units: 1050, medal: '🥉' },
  { rank: 4, name: 'Eleni Vasiliou',     role: 'Picker', units: 980,  medal: ''   },
  { rank: 5, name: 'Kostas Angelou',     role: 'Packer', units: 910,  medal: ''   },
]

// ── Mini calendar ─────────────────────────────────────────────────────────────
const MONTH_EL = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος']
const DAYS_EL  = ['Δευ','Τρι','Τετ','Πεμ','Παρ','Σαβ','Κυρ']
const BUSY_DAYS = [3, 10, 18, 24]
const DIFFICULT_DAY = 30

function MiniCalendar({ year, month }: { year: number; month: number }) {
  const firstDay = new Date(year, month, 1).getDay()
  const offset   = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const isToday = (d: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="grid grid-cols-7 gap-y-0.5 text-center text-xs mt-2">
      {DAYS_EL.map(d => (
        <div key={d} className="text-slate-400 font-medium pb-1.5 text-[10px]">{d}</div>
      ))}
      {cells.map((d, i) => {
        if (!d) return <div key={i} />
        const isT    = isToday(d)
        const isBusy = BUSY_DAYS.includes(d)
        const isDiff = d === DIFFICULT_DAY
        return (
          <div
            key={i}
            className={[
              'w-7 h-7 mx-auto flex items-center justify-center rounded-full text-xs font-medium cursor-pointer transition-colors',
              isDiff ? 'bg-red-500 text-white' : '',
              isT && !isDiff ? 'bg-blue-600 text-white' : '',
              isBusy && !isT && !isDiff ? 'bg-blue-50 text-blue-600 font-semibold' : '',
              !isT && !isBusy && !isDiff ? 'text-slate-600 hover:bg-slate-100' : '',
            ].join(' ')}
          >
            {d}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function DashboardPage() {
  const employees = useAppStore(s => s.employees)
  const alerts    = useAppStore(s => s.alerts)

  const [calYear,  setCalYear]  = useState(2026)
  const [calMonth, setCalMonth] = useState(5)

  const activeEmployees = employees.filter(e =>
    e.current_status === 'working' || e.current_status === 'redeployed'
  ).length || 128

  const unacked = alerts.filter(a => !a.acknowledged_at).length

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Welcome back, Stavros! 👋</h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's what's happening in your warehouse today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            1 Ιουνίου 2026
          </button>
          <button className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            All Shifts
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
          <div className="relative">
            <button className="w-9 h-9 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Bell className="w-4 h-4 text-slate-600" />
            </button>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {unacked > 0 ? unacked : 3}
            </span>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* KPI ROW */}
        <div className="grid grid-cols-5 gap-4">
          {([
            { Icon: ShoppingCart, label: 'Total Orders',     value: '12,842',                delta: '18.6%', color: 'text-blue-600',    bg: 'bg-blue-50'    },
            { Icon: Package,      label: 'Units Processed',  value: '96,214',                delta: '21.3%', color: 'text-green-600',   bg: 'bg-green-50'   },
            { Icon: Clock,        label: 'Labor Hours',       value: '1,245h',                delta: '17.8%', color: 'text-purple-600',  bg: 'bg-purple-50'  },
            { Icon: ShieldCheck,  label: 'SLA Success',       value: '96.2%',                 delta: '2.1pp', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { Icon: Users,        label: 'Active Employees',  value: String(activeEmployees), delta: '5',     color: 'text-orange-600',  bg: 'bg-orange-50'  },
          ] as const).map(({ Icon, label, value, delta, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 font-medium">{label}</div>
                <div className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  <span className="text-xs text-green-600 font-semibold">↑{delta}</span>
                  <span className="text-xs text-slate-400">vs yesterday</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MID ROW */}
        <div className="grid grid-cols-12 gap-4">

          {/* Yesterday Overview */}
          <div className="col-span-5 bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Yesterday Overview</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={HOURLY_DATA} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 1500]} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="orders" name="Orders"      stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="units"  name="Units"       stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="labor"  name="Labor Hours" stroke="#a78bfa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* SLA Monitor */}
          <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">SLA Monitor</h3>
            <div className="relative flex justify-center">
              <PieChart width={140} height={140}>
                <Pie data={SLA_DATA} cx={70} cy={70} innerRadius={44} outerRadius={65}
                  startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                  {SLA_DATA.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-xl font-bold text-slate-800">96.2%</div>
                <div className="text-[10px] text-slate-400">SLA Success</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {SLA_DATA.map(({ name, value, color }) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-slate-600">{name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{value.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <Link to="/schedule" className="mt-3 block text-center text-xs text-blue-600 font-medium hover:underline">
              View SLA Monitor →
            </Link>
          </div>

          {/* Calendar */}
          <div className="col-span-4 bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-slate-800">
                Ημερολόγιο ({MONTH_EL[calMonth]} {calYear})
              </h3>
              <div className="flex items-center gap-1">
                <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 transition-colors">
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
            <MiniCalendar year={calYear} month={calMonth} />
            <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
              <span className="text-amber-500 text-sm flex-shrink-0 mt-0.5">⚠</span>
              <div>
                <div className="text-xs font-semibold text-amber-800">Επόμενη δύσκολη μέρα</div>
                <div className="text-xs text-amber-700 font-medium">Τρίτη 30 Ιουνίου 2026</div>
                <div className="text-xs text-amber-600 mt-0.5">Αναμενόμενος υψηλός όγκος παραγγελιών +28% από τον μέσο όρο</div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div className="grid grid-cols-12 gap-4">

          {/* Yesterday Orders */}
          <div className="col-span-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Yesterday Orders</h3>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Κατηγορία</th>
                  <th className="text-right px-3 py-2.5 text-slate-500 font-medium">Παραγγελίες</th>
                  <th className="text-right px-3 py-2.5 text-slate-500 font-medium">Μονάδες</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {YESTERDAY_ORDERS.map(row => (
                  <tr key={row.type} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                        <span className="text-slate-700 leading-tight">{row.type}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold text-slate-800">{row.orders.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right font-mono text-slate-600">{row.units.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">{row.pct}%</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-800">Σύνολο</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-slate-800">12,842</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-slate-800">96,214</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">100%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Labor Utilization */}
          <div className="col-span-3 bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Labor Utilization (Yesterday)</h3>
            <div className="text-center mb-5">
              <div className="text-4xl font-bold text-slate-800">92%</div>
              <div className="text-sm text-slate-500 mt-1">Utilization Rate</div>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              {[
                { label: 'Working', value: '1,145h', color: 'text-green-600' },
                { label: 'Idle',    value: '100h',   color: 'text-yellow-500' },
                { label: 'Break',   value: '68h',    color: 'text-purple-600' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
                  <div className={`text-sm font-bold ${color}`}>{value}</div>
                </div>
              ))}
            </div>
            <div className="h-2.5 rounded-full overflow-hidden flex">
              <div className="bg-green-500" style={{ width: '84%' }} />
              <div className="bg-yellow-400" style={{ width: '8%' }} />
              <div className="bg-purple-400" style={{ width: '5%' }} />
              <div className="bg-slate-200 flex-1" />
            </div>
            <Link to="/team" className="mt-4 block text-center text-xs text-blue-600 font-medium hover:underline">
              View Labor Planning →
            </Link>
          </div>

          {/* Top Performers */}
          <div className="col-span-5 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Top Performers Yesterday</h3>
              <Link to="/team" className="text-xs text-blue-600 font-medium hover:underline">View all</Link>
            </div>
            <div className="divide-y divide-slate-50">
              {TOP_PERFORMERS.map(({ rank, name, role, units, medal }) => (
                <div key={rank} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-5 text-sm text-center flex-shrink-0">
                    {medal || <span className="text-xs text-slate-400 font-medium">{rank}</span>}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
                  </div>
                  <span className="text-xs text-slate-500 w-14 text-center flex-shrink-0">{role}</span>
                  <span className="text-sm font-bold text-slate-800 font-mono w-24 text-right flex-shrink-0">
                    {units.toLocaleString()} units
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER ROW */}
        <div className="grid grid-cols-2 gap-4">

          {/* AI Recommendation */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-slate-500 font-medium mb-1">AI Recommendation</div>
                <div className="text-sm font-bold text-blue-600 mb-2">
                  Αύξησε την ομάδα packing κατά 3 άτομα στο 2ο μισό της βάρδιας
                </div>
                <div className="text-xs text-slate-600 leading-relaxed mb-4">
                  Με βάση τον όγκο παραγγελιών και την απόδοση, προτείνουμε ενίσχυση στην ομάδα packing για αποφυγή καθυστερήσεων.
                </div>
                <div className="flex items-center gap-3">
                  <button className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Εφαρμογή Πρότασης
                  </button>
                  <Link to="/copilot" className="text-xs text-blue-600 font-medium hover:underline">
                    Δες όλες τις προτάσεις →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { Icon: ClipboardList, label: 'Δημιουργία Πλάνου',       to: '/staff-plan',      color: 'text-blue-600',   bg: 'bg-blue-50'   },
                { Icon: Users,         label: 'Ανακατανομή Προσωπικού',  to: '/team',            color: 'text-green-600',  bg: 'bg-green-50'  },
                { Icon: UserMinus,     label: 'Δηλώσεις Απουσιών',       to: '/team',            color: 'text-orange-600', bg: 'bg-orange-50' },
                { Icon: BarChart2,     label: 'Αναφορές',                 to: '/hourly-forecast', color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(({ Icon, label, to, color, bg }) => (
                <Link key={label} to={to} className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all text-center">
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <span className="text-xs text-slate-600 font-medium leading-tight">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
