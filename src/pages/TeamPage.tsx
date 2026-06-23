// src/pages/TeamPage.tsx — Employee Analytics Dashboard

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Package, Zap, TrendingUp, TrendingDown, Minus,
  ChevronRight, Award, BarChart2, Star, ArrowUpRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useProductivityData, getRating } from '@/lib/useProductivityData'
import { useAppStore } from '@/store'
import { ROLE_CONFIG } from '@/types'
import { cn, initials } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number | null) => n == null ? '—' : n.toLocaleString('el-GR')
const fmtUPH = (n: number | null) => n == null ? '—' : n.toFixed(1)
const trendColor = (t: number | null) =>
  t == null ? 'text-slate-400' : t > 0 ? 'text-emerald-500' : t < 0 ? 'text-red-500' : 'text-slate-400'
const trendBg = (t: number | null) =>
  t == null ? 'bg-slate-50' : t > 0 ? 'bg-emerald-50' : t < 0 ? 'bg-red-50' : 'bg-slate-50'

function Stars({ n, color }: { n: number; color: string }) {
  return (
    <span style={{ color }}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  )
}

function TrendBadge({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-300 text-xs">—</span>
  return (
    <span className={cn('text-xs font-semibold', trendColor(v))}>
      {v > 0 ? '▲ +' : v < 0 ? '▼ ' : '– '}{v}%
    </span>
  )
}

// ── Role config for analytics ─────────────────────────────────────────────────
const ROLE_DISPLAY = [
  { key: 'operator', label: 'Operators',          icon: '⚙️', color: '#22c55e' },
  { key: 'picker',   label: 'Pickers (Ράφι)',     icon: '📦', color: '#3b82f6' },
  { key: 'packer',   label: 'Packers',            icon: '🎁', color: '#f97316' },
  { key: 'sorter',   label: 'Palletizers/Sorters', icon: '🔄', color: '#eab308' },
] as const

// ── Main Component ────────────────────────────────────────────────────────────
export function TeamPage() {
  const navigate  = useNavigate()
  const { prodSnap, employees, allMetrics, withData, totalOrdersToday, meanUPH } = useProductivityData()
  const [tableSort, setTableSort] = useState<'uph' | 'orders' | 'trend' | 'impact'>('uph')

  // ── Aggregates ──────────────────────────────────────────────────────────────
  const activeEmployees = employees.filter(e => e.current_status === 'working').length

  const roleStats = useMemo(() => {
    return ROLE_DISPLAY.map(rd => {
      const roleEmps = employees.filter(e => e.primary_role === rd.key)
      const roleMetrics = allMetrics.filter(m => m.employee.primary_role === rd.key && m.hasData)
      const avgUPH = roleMetrics.length
        ? Math.round(roleMetrics.reduce((s, m) => s + (m.todayUPH ?? 0), 0) / roleMetrics.filter(m => m.todayUPH).length * 10) / 10
        : null
      const monthAvgUPH = roleMetrics.length
        ? Math.round(roleMetrics.reduce((s, m) => s + (m.monthUPH ?? 0), 0) / roleMetrics.filter(m => m.monthUPH).length * 10) / 10
        : null
      const trendVsMonth = (avgUPH && monthAvgUPH && monthAvgUPH > 0)
        ? Math.round(((avgUPH - monthAvgUPH) / monthAvgUPH) * 100) : null
      return { ...rd, count: roleEmps.length, avgUPH, trendVsMonth }
    })
  }, [employees, allMetrics])

  // ── Top Performers ──────────────────────────────────────────────────────────
  const topPerformers = useMemo(() =>
    [...withData]
      .filter(m => m.todayUPH)
      .sort((a, b) => (b.todayUPH ?? 0) - (a.todayUPH ?? 0))
      .slice(0, 8),
    [withData]
  )

  // ── Performance Trend ───────────────────────────────────────────────────────
  const trendList = useMemo(() =>
    [...allMetrics]
      .filter(m => m.trend != null)
      .sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))
      .slice(0, 10),
    [allMetrics]
  )

  // ── Sorted employee table ───────────────────────────────────────────────────
  const sortedEmployees = useMemo(() => {
    const sorted = [...allMetrics]
    if (tableSort === 'uph')    sorted.sort((a, b) => (b.todayUPH ?? -1) - (a.todayUPH ?? -1))
    if (tableSort === 'orders') sorted.sort((a, b) => (b.ordersToday ?? -1) - (a.ordersToday ?? -1))
    if (tableSort === 'trend')  sorted.sort((a, b) => (b.trend ?? -999) - (a.trend ?? -999))
    if (tableSort === 'impact') sorted.sort((a, b) => b.impactScore - a.impactScore)
    return sorted
  }, [allMetrics, tableSort])

  // ── Bar chart data ──────────────────────────────────────────────────────────
  const barData = topPerformers.slice(0, 8).map(m => ({
    name: m.employee.full_name.split(' ')[0],
    uph:  m.todayUPH ?? 0,
    role: m.employee.primary_role,
  }))

  const today = new Date().toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-full bg-slate-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Απόδοση Εργαζομένων</h1>
            <p className="text-xs text-slate-400 mt-0.5">Ανάλυση απόδοσης ανά εργαζόμενο</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg font-mono">{today}</span>
            <button
              onClick={() => navigate('/team/employees')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Users className="w-4 h-4" /> Διαχείριση
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {/* Total employees */}
          <button
            onClick={() => navigate('/team/employees')}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{employees.length}</div>
            <div className="text-xs text-slate-400 mt-1">Συνολικοί Εργαζόμενοι</div>
            <div className="text-xs text-emerald-500 mt-1 font-medium">{activeEmployees} εργάζονται</div>
          </button>

          {/* Total orders */}
          <button
            onClick={() => navigate('/ops')}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-orange-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-orange-500" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-orange-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{fmt(totalOrdersToday)}</div>
            <div className="text-xs text-slate-400 mt-1">Παραγγελίες σήμερα</div>
            <div className="text-xs text-slate-400 mt-1">Pickers + Packers + Operators</div>
          </button>

          {/* Mean productivity */}
          <button
            onClick={() => navigate('/team/ranking')}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-500" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-slate-800">{fmtUPH(meanUPH)}</div>
            <div className="text-xs text-slate-400 mt-1">Μέση Παραγωγικότητα</div>
            <div className="text-xs text-slate-400 mt-1">Orders/Hour (σήμερα)</div>
          </button>

          {/* Top performer */}
          <button
            onClick={() => navigate('/team/top-performers')}
            className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-amber-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-slate-800">
              {topPerformers[0]?.todayUPH?.toFixed(1) ?? '—'}
            </div>
            <div className="text-xs text-slate-400 mt-1">Καλύτερο Orders/Hour</div>
            <div className="text-xs text-amber-500 mt-1 font-medium truncate">
              {topPerformers[0]?.employee.full_name ?? '—'}
            </div>
          </button>
        </div>

        {/* ── Role Cards ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Απόδοση ανά Ρόλο</h2>
            <button
              onClick={() => navigate('/team/ranking')}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >Αναλυτικά<ChevronRight className="w-3 h-3" /></button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {roleStats.map(role => (
              <button
                key={role.key}
                onClick={() => navigate(`/team/ranking?role=${role.key}`)}
                className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg">{role.icon}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
                <div className="font-semibold text-slate-700 text-sm mb-0.5">{role.label}</div>
                <div className="text-xs text-slate-400 mb-3">{role.count} εργαζόμενοι</div>
                <div className="text-2xl font-bold font-mono" style={{ color: role.color }}>
                  {fmtUPH(role.avgUPH)}
                </div>
                <div className="text-[10px] text-slate-400 mb-2">Orders/Hour</div>
                {role.trendVsMonth != null && (
                  <div className={cn('text-xs font-semibold', trendColor(role.trendVsMonth))}>
                    {role.trendVsMonth > 0 ? '▲ +' : '▼ '}{role.trendVsMonth}% vs ΜΟ 30ημ
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Top Performers + Trend ── */}
        <div className="grid grid-cols-2 gap-6">

          {/* Top Performers */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-slate-700">Top Performers <span className="text-slate-400 font-normal">(Orders/Hour)</span></h2>
              </div>
              <button
                onClick={() => navigate('/team/top-performers')}
                className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
              >Προβολή όλων <ChevronRight className="w-3 h-3" /></button>
            </div>

            {barData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number) => [`${v} Orders/h`, 'UPH']}
                      contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="uph" radius={[4, 4, 0, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={ROLE_CONFIG[entry.role as keyof typeof ROLE_CONFIG]?.color ?? '#3b82f6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-3 space-y-1.5">
                  {topPerformers.slice(0, 5).map((m, i) => {
                    const { label, stars, color } = getRating(m.impactScore)
                    return (
                      <div key={m.employee.id} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}</span>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                          style={{ background: `${ROLE_CONFIG[m.employee.primary_role]?.color}18`, color: ROLE_CONFIG[m.employee.primary_role]?.color }}
                        >{initials(m.employee.full_name)}</div>
                        <span className="text-xs text-slate-700 flex-1 truncate">{m.employee.full_name}</span>
                        <span className="text-xs font-bold font-mono text-slate-700">{m.todayUPH?.toFixed(1)}</span>
                        <Stars n={stars} color={color} />
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400 text-sm py-8">Δεν υπάρχουν δεδομένα ακόμα</div>
            )}
          </div>

          {/* Performance Trend */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-slate-700">
                Performance Trend <span className="text-slate-400 font-normal">(σήμερα vs ΜΟ 30 ημερών)</span>
              </h2>
            </div>

            {trendList.length > 0 ? (
              <div className="space-y-2">
                {trendList.map(m => (
                  <div key={m.employee.id} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                      style={{ background: `${ROLE_CONFIG[m.employee.primary_role]?.color}18`, color: ROLE_CONFIG[m.employee.primary_role]?.color }}
                    >{initials(m.employee.full_name)}</div>
                    <span className="text-xs text-slate-700 flex-1 truncate">{m.employee.full_name}</span>

                    {/* Mini progress bar */}
                    <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', (m.trend ?? 0) >= 0 ? 'bg-emerald-400' : 'bg-red-400')}
                        style={{ width: `${Math.min(100, Math.abs(m.trend ?? 0) * 3)}%` }}
                      />
                    </div>

                    <TrendBadge v={m.trend} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400 text-sm py-8">Δεν υπάρχουν δεδομένα σύγκρισης</div>
            )}

            <button
              onClick={() => navigate('/team/top-performers')}
              className="mt-4 w-full text-xs text-blue-500 hover:text-blue-700 border border-blue-100 rounded-lg py-2 hover:bg-blue-50 transition-colors"
            >
              Προβολή όλων
            </button>
          </div>
        </div>

        {/* ── Quick Links Row ── */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/team/top-performers')}
            className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
          >
            <Award className="w-5 h-5 mb-2 opacity-80" />
            <div className="font-semibold text-sm">Top Performers</div>
            <div className="text-xs opacity-75 mt-0.5">Leaderboard & Hall of Fame</div>
          </button>
          <button
            onClick={() => navigate('/team/impact')}
            className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
          >
            <Star className="w-5 h-5 mb-2 opacity-80" />
            <div className="font-semibold text-sm">Impact Score</div>
            <div className="text-xs opacity-75 mt-0.5">Αξία ανά εργαζόμενο (0-100)</div>
          </button>
          <button
            onClick={() => navigate('/team/ranking')}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl p-4 text-left hover:opacity-90 transition-opacity"
          >
            <BarChart2 className="w-5 h-5 mb-2 opacity-80" />
            <div className="font-semibold text-sm">Ranking ανά Ρόλο</div>
            <div className="text-xs opacity-75 mt-0.5">Κατάταξη και στατιστικά ρόλου</div>
          </button>
        </div>

        {/* ── Employee Table ── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Λίστα Εργαζομένων</h2>
            <div className="flex gap-1">
              {(['uph', 'orders', 'trend', 'impact'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setTableSort(s)}
                  className={cn(
                    'px-2.5 py-1 rounded text-[11px] font-medium transition-colors',
                    tableSort === s ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  )}
                >
                  {s === 'uph' ? 'UPH' : s === 'orders' ? 'Παραγγελίες' : s === 'trend' ? 'Trend' : 'Impact'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['#', 'Εργαζόμενος', 'Ρόλος', 'Orders/Hour', 'Παραγγελίες', 'Ώρες', 'Trend 30ημ', 'Consistency', 'Rating'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedEmployees.map((m, i) => {
                  const emp = m.employee
                  const rc = ROLE_CONFIG[emp.primary_role]
                  const { label: rLabel, stars, color: rColor } = getRating(m.impactScore)
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => navigate(`/team/ranking?emp=${emp.id}`)}
                    >
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                            style={{ background: `${rc?.color}18`, color: rc?.color }}
                          >{initials(emp.full_name)}</div>
                          <span className="font-medium text-slate-800 text-xs truncate max-w-[140px]">{emp.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${rc?.color}18`, color: rc?.color }}>
                          {rc?.label ?? emp.primary_role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                        {m.todayUPH?.toFixed(1) ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                        {m.ordersToday ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {m.hoursToday ? `${m.hoursToday.toFixed(1)}h` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <TrendBadge v={m.trend} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${m.consistencyScore}%` }} />
                          </div>
                          <span className="text-xs text-slate-600 font-mono">{m.consistencyScore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px]" style={{ color: rColor }}>
                            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
                          </span>
                          <span className="text-[10px] font-medium" style={{ color: rColor }}>{rLabel}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
