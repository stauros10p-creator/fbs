// src/pages/RoleRankingPage.tsx — Ranking ανά Ρόλο

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Zap, Users, BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  useProductivityData, getRating, type EmployeeMetrics,
} from '@/lib/useProductivityData'
import { ROLE_CONFIG } from '@/types'
import { cn, initials } from '@/lib/utils'

const MEDALS = ['🥇', '🥈', '🥉']
const ROLES = [
  { key: 'operator', label: 'Operators',          color: '#22c55e', icon: '⚙️' },
  { key: 'picker',   label: 'Pickers (Ράφι)',     color: '#3b82f6', icon: '📦' },
  { key: 'packer',   label: 'Packers',            color: '#f97316', icon: '🎁' },
  { key: 'sorter',   label: 'Palletizers/Sorters', color: '#eab308', icon: '🔄' },
] as const

const fmtUPH = (n: number | null) => n == null ? '—' : n.toFixed(1)
const trendColor = (t: number | null) =>
  t == null ? 'text-slate-400' : t > 0 ? 'text-emerald-500' : 'text-red-500'

function Stars({ n, color }: { n: number; color: string }) {
  return <span className="text-xs" style={{ color }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
}

// ── AI Insights (rule-based) ──────────────────────────────────────────────────
function generateInsights(metrics: EmployeeMetrics[], role: string): string[] {
  const insights: string[] = []
  if (metrics.length === 0) return ['Δεν υπάρχουν δεδομένα για αυτόν τον ρόλο.']

  const sorted = [...metrics].filter(m => m.todayUPH).sort((a, b) => (b.todayUPH ?? 0) - (a.todayUPH ?? 0))
  if (sorted[0]) {
    insights.push(`Ο/Η ${sorted[0].employee.full_name.split(' ')[0]} είναι #1 ${role} με ${fmtUPH(sorted[0].todayUPH)} Orders/Hour σήμερα.`)
  }

  const improving = metrics.filter(m => (m.trend ?? 0) > 10)
  if (improving.length > 0) {
    insights.push(`${improving.length} εργαζόμενοι παρουσιάζουν βελτίωση >10% σε σχέση με τον ΜΟ 30 ημερών.`)
  }

  const declining = metrics.filter(m => (m.trend ?? 0) < -10)
  if (declining.length > 0) {
    insights.push(`${declining.length} εργαζόμενοι εμφανίζουν πτώση >10% — ενδέχεται να χρειάζονται coaching.`)
  }

  const avgUPH = metrics.filter(m => m.todayUPH).reduce((s, m) => s + (m.todayUPH ?? 0), 0) / (metrics.filter(m => m.todayUPH).length || 1)
  const aboveAvg = metrics.filter(m => (m.todayUPH ?? 0) > avgUPH * 1.2).length
  if (aboveAvg > 0) {
    insights.push(`${aboveAvg} εργαζόμενοι αποδίδουν >20% πάνω από τον μέσο όρο (${avgUPH.toFixed(1)} Orders/h).`)
  }

  return insights.slice(0, 4)
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function RoleRankingPage() {
  const navigate = useNavigate()
  const [params]  = useSearchParams()
  const initRole  = (params.get('role') ?? 'picker') as string
  const [activeRole, setActiveRole] = useState(initRole)
  const { allMetrics, employees } = useProductivityData()

  const roleConfig = ROLES.find(r => r.key === activeRole) ?? ROLES[1]

  // Role-filtered metrics
  const roleMetrics = useMemo(() =>
    allMetrics.filter(m => m.employee.primary_role === activeRole),
    [allMetrics, activeRole]
  )

  // Sorted by UPH
  const ranked = useMemo(() =>
    [...roleMetrics]
      .sort((a, b) => (b.todayUPH ?? -1) - (a.todayUPH ?? -1)),
    [roleMetrics]
  )

  // Sorted by improvement
  const improving = useMemo(() =>
    [...roleMetrics]
      .filter(m => m.trend != null && m.trend > 0)
      .sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0)),
    [roleMetrics]
  )

  // Sorted by impact
  const byImpact = useMemo(() =>
    [...roleMetrics]
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 5),
    [roleMetrics]
  )

  // Aggregates
  const withUPH   = ranked.filter(m => m.todayUPH != null)
  const avgUPH    = withUPH.length ? withUPH.reduce((s, m) => s + (m.todayUPH ?? 0), 0) / withUPH.length : null
  const totalOrders = roleMetrics.reduce((s, m) => s + (m.ordersToday ?? 0), 0)

  const activeToday = withUPH.length
  const kpis = [
    { label: 'Εργαζόμενοι',            value: `${activeToday} / ${employees.filter(e => e.primary_role === activeRole).length}`, icon: <Users className="w-4 h-4" />, sub: 'ενεργοί σήμερα' },
    { label: 'ΜΟ Ομάδας Σήμερα',       value: avgUPH?.toFixed(1) ?? '—', icon: <Zap className="w-4 h-4" />, sub: 'Orders/Hour' },
    { label: 'Καλύτερος Σήμερα',       value: ranked[0]?.employee.full_name?.split(' ')[0] ?? '—', icon: '🥇', sub: ranked[0]?.todayUPH ? `${ranked[0].todayUPH.toFixed(1)} UPH` : '' },
    { label: 'Σύνολο Παραγγελιών',     value: totalOrders.toLocaleString('el-GR'), icon: <BarChart2 className="w-4 h-4" />, sub: 'σήμερα' },
  ]

  const barData = withUPH.slice(0, 10).map(m => ({
    name: m.employee.full_name.split(' ')[0],
    uph: m.todayUPH ?? 0,
  }))

  const insights = generateInsights(roleMetrics, roleConfig.label)

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/team')} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Ranking ανά Ρόλο</h1>
            <p className="text-xs text-slate-400">Παραγωγικότητα σήμερα · σύγκριση με ΜΟ 30 ημερών</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Role tabs */}
        <div className="flex gap-2">
          {ROLES.map(r => (
            <button
              key={r.key}
              onClick={() => setActiveRole(r.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeRole === r.key
                  ? 'text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
              style={activeRole === r.key ? { backgroundColor: r.color } : {}}
            >
              <span>{r.icon}</span>{r.label}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2 text-slate-400">
                {typeof k.icon === 'string' ? <span className="text-lg">{k.icon}</span> : k.icon}
              </div>
              <div className="text-xl font-bold text-slate-800">{k.value}</div>
              <div className="text-xs text-slate-500 mt-0.5 font-medium">{k.label}</div>
              {k.sub && <div className="text-[10px] text-slate-400">{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Podium (top 3) */}
        {ranked.length >= 3 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Top 3 Podium</h2>
            <div className="flex gap-4 items-end">
              {/* #2 */}
              <div className="flex-1">
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <div className="text-xl mb-2">🥈</div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2"
                    style={{ background: `${roleConfig.color}18`, color: roleConfig.color }}
                  >{initials(ranked[1].employee.full_name)}</div>
                  <div className="text-xs font-bold text-slate-700">{ranked[1].employee.full_name.split(' ')[0]}</div>
                  <div className="text-lg font-bold font-mono mt-1" style={{ color: roleConfig.color }}>{fmtUPH(ranked[1].todayUPH)}</div>
                </div>
              </div>
              {/* #1 */}
              <div className="flex-1 -mt-4">
                <div className="bg-white rounded-xl border-2 shadow-lg p-4 text-center" style={{ borderColor: roleConfig.color }}>
                  <div className="text-2xl mb-2">🥇</div>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2"
                    style={{ background: `${roleConfig.color}18`, color: roleConfig.color }}
                  >{initials(ranked[0].employee.full_name)}</div>
                  <div className="text-sm font-bold text-slate-800">{ranked[0].employee.full_name.split(' ')[0]}</div>
                  <div className="text-xl font-bold font-mono mt-1" style={{ color: roleConfig.color }}>{fmtUPH(ranked[0].todayUPH)}</div>
                  <div className="text-[10px] text-slate-400">Orders/Hour</div>
                </div>
              </div>
              {/* #3 */}
              <div className="flex-1">
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <div className="text-xl mb-2">🥉</div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2"
                    style={{ background: `${roleConfig.color}18`, color: roleConfig.color }}
                  >{initials(ranked[2].employee.full_name)}</div>
                  <div className="text-xs font-bold text-slate-700">{ranked[2].employee.full_name.split(' ')[0]}</div>
                  <div className="text-lg font-bold font-mono mt-1" style={{ color: roleConfig.color }}>{fmtUPH(ranked[2].todayUPH)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main 3-col layout */}
        <div className="grid grid-cols-3 gap-6">

          {/* Leaderboard */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">Πλήρης Κατάταξη — {roleConfig.label}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {[
                      { h: 'Rank', tip: '' },
                      { h: 'Εργαζόμενος', tip: '' },
                      { h: 'UPH Σήμερα', tip: 'Orders/Hour σήμερα' },
                      { h: 'vs Ομάδα', tip: '% διαφορά από ΜΟ ομάδας σήμερα' },
                      { h: 'Παραγγελίες', tip: '' },
                      { h: 'Ώρες', tip: '' },
                      { h: 'Trend', tip: '% vs ΜΟ 30 ημερών' },
                      { h: 'Impact', tip: '' },
                      { h: 'Rating', tip: '' },
                    ].map(({ h, tip }) => (
                      <th key={h} title={tip} className="px-4 py-2.5 text-left text-[10px] tracking-wider text-slate-400 uppercase whitespace-nowrap font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {ranked.map((m, i) => {
                    const { stars, color } = getRating(m.impactScore)
                    const noData = m.todayUPH == null
                    return (
                      <tr key={m.employee.id} className={cn('hover:bg-slate-50/80 transition-colors', noData && 'opacity-50')}>
                        <td className="px-4 py-2.5 text-center text-sm">
                          {!noData && i < 3 ? MEDALS[i] : <span className="text-xs text-slate-400 font-mono">{i + 1}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                              style={{ background: `${roleConfig.color}18`, color: roleConfig.color }}
                            >{initials(m.employee.full_name)}</div>
                            <div>
                              <div className="text-xs font-medium text-slate-700">{m.employee.full_name}</div>
                              {noData && <div className="text-[9px] text-slate-400">Δεν εργάστηκε σήμερα</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs font-bold" style={{ color: noData ? '#cbd5e1' : roleConfig.color }}>
                          {fmtUPH(m.todayUPH)}
                        </td>
                        <td className="px-4 py-2.5">
                          {m.vsTeamToday != null ? (
                            <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-md',
                              m.vsTeamToday >= 10 ? 'bg-emerald-50 text-emerald-600'
                              : m.vsTeamToday <= -10 ? 'bg-red-50 text-red-500'
                              : 'bg-slate-100 text-slate-500'
                            )}>
                              {m.vsTeamToday > 0 ? '+' : ''}{m.vsTeamToday}%
                            </span>
                          ) : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{m.ordersToday ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">{m.hoursToday ? `${m.hoursToday.toFixed(1)}h` : '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('text-xs font-semibold', trendColor(m.trend))}>
                            {m.trend != null ? `${m.trend > 0 ? '+' : ''}${m.trend}%` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${m.impactScore}%`, backgroundColor: roleConfig.color }} />
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">{m.impactScore}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Stars n={stars} color={color} />
                        </td>
                      </tr>
                    )
                  })}
                  {ranked.length === 0 && (
                    <tr><td colSpan={9} className="py-10 text-center text-slate-400 text-sm">Δεν υπάρχουν δεδομένα</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column: Bar chart + AI Insights + Most Improved */}
          <div className="space-y-4">
            {/* Bar chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-600 mb-3">Top 10 Orders/Hour</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`${v}`, 'UPH']} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="uph" fill={roleConfig.color} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Most Improved */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <h3 className="text-xs font-semibold text-slate-600">Most Improved</h3>
              </div>
              <div className="space-y-2">
                {improving.slice(0, 5).map((m, i) => (
                  <div key={m.employee.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] text-slate-400">{i + 1}</span>
                      <span className="text-xs text-slate-700 truncate">{m.employee.full_name.split(' ')[0]}</span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">+{m.trend}%</span>
                  </div>
                ))}
                {improving.length === 0 && <p className="text-xs text-slate-400">Κανένας</p>}
              </div>
            </div>

            {/* AI Insights */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <h3 className="text-xs font-semibold">AI Insights</h3>
              </div>
              <div className="space-y-2">
                {insights.map((ins, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-blue-400 flex-shrink-0 text-xs">•</span>
                    <p className="text-xs text-slate-300 leading-relaxed">{ins}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Top Impact */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Top Impact Employees — {roleConfig.label}</h2>
          <div className="grid grid-cols-5 gap-3">
            {byImpact.map((m, i) => {
              const { label, stars, color } = getRating(m.impactScore)
              return (
                <div key={m.employee.id} className="bg-slate-50 rounded-xl p-3 text-center">
                  <div className="text-sm font-bold text-slate-400 mb-1">#{i + 1}</div>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-2"
                    style={{ background: `${roleConfig.color}18`, color: roleConfig.color }}
                  >{initials(m.employee.full_name)}</div>
                  <div className="text-[11px] font-semibold text-slate-700 truncate">{m.employee.full_name.split(' ')[0]}</div>
                  <div className="text-lg font-bold font-mono mt-1" style={{ color: roleConfig.color === '#22c55e' ? '#16a34a' : roleConfig.color }}>
                    {m.impactScore}
                  </div>
                  <div className="text-[9px] text-slate-400">Impact Score</div>
                  <Stars n={stars} color={color} />
                </div>
              )
            })}
            {byImpact.length === 0 && (
              <div className="col-span-5 py-8 text-center text-slate-400 text-sm">Δεν υπάρχουν δεδομένα</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
