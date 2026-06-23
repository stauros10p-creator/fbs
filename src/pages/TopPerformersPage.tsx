// src/pages/TopPerformersPage.tsx — Top Performers Leaderboard

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trophy, Flame, TrendingUp, Target, Users } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  useProductivityData, getRating, type EmployeeMetrics,
} from '@/lib/useProductivityData'
import { ROLE_CONFIG } from '@/types'
import { cn, initials } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtUPH = (n: number | null) => n == null ? '—' : n.toFixed(1)
const trendColor = (t: number | null) =>
  t == null ? 'text-slate-400' : t > 0 ? 'text-emerald-500' : 'text-red-500'

function Stars({ n, color, size = 'sm' }: { n: number; color: string; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'text-xl' : 'text-xs'
  return <span className={cls} style={{ color }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
}

function TrendPill({ v }: { v: number | null }) {
  if (v == null) return <span className="text-slate-300 text-xs">—</span>
  const pos = v >= 0
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', pos ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500')}>
      {pos ? '+' : ''}{v}%
    </span>
  )
}

// ── Medal badges ──────────────────────────────────────────────────────────────
const MEDALS = ['🥇', '🥈', '🥉']

// ── Podium Card ───────────────────────────────────────────────────────────────
function PodiumCard({ m, rank }: { m: EmployeeMetrics; rank: number }) {
  const rc = ROLE_CONFIG[m.employee.primary_role]
  const { label, stars, color } = getRating(m.impactScore)
  const isFirst = rank === 1
  return (
    <div className={cn(
      'bg-white rounded-xl border p-5 text-center flex flex-col items-center',
      isFirst ? 'border-amber-300 shadow-lg shadow-amber-100 scale-105' : 'border-slate-200'
    )}>
      {isFirst && <div className="text-3xl mb-1">👑</div>}
      <div className="text-2xl mb-2">{MEDALS[rank - 1]}</div>
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold mb-3"
        style={{ background: `${rc?.color}18`, color: rc?.color }}
      >{initials(m.employee.full_name)}</div>
      <div className="font-bold text-slate-800 text-sm">{m.employee.full_name}</div>
      <div className="text-xs text-slate-400 mb-2">{rc?.label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: rc?.color }}>
        {fmtUPH(m.todayUPH)}
      </div>
      <div className="text-[10px] text-slate-400 mb-3">Orders/Hour</div>
      <Stars n={stars} color={color} size={isFirst ? 'lg' : 'sm'} />
      <div className="text-xs font-medium mt-1" style={{ color }}>{label}</div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function TopPerformersPage() {
  const navigate = useNavigate()
  const { allMetrics, withData } = useProductivityData()
  const [activeRole, setActiveRole] = useState<string>('all')

  const roles = ['all', 'operator', 'picker', 'packer', 'sorter']
  const roleLabels: Record<string, string> = {
    all: 'Όλοι', operator: 'Operators', picker: 'Pickers', packer: 'Packers', sorter: 'Palletizers',
  }

  // Filtered by role
  const filtered = useMemo(() => {
    const base = withData.filter(m => m.todayUPH != null)
    if (activeRole === 'all') return [...base].sort((a, b) => (b.todayUPH ?? 0) - (a.todayUPH ?? 0))
    return [...base]
      .filter(m => m.employee.primary_role === activeRole)
      .sort((a, b) => (b.todayUPH ?? 0) - (a.todayUPH ?? 0))
  }, [withData, activeRole])

  // By improvement (trend)
  const mostImproved = useMemo(() =>
    [...allMetrics]
      .filter(m => m.trend != null && m.trend > 0)
      .sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))
      .slice(0, 8),
    [allMetrics]
  )

  // Most consistent
  const mostConsistent = useMemo(() =>
    [...withData]
      .sort((a, b) => b.consistencyScore - a.consistencyScore)
      .slice(0, 8),
    [withData]
  )

  // Hall of Fame (top by impact today)
  const hallOfFame = useMemo(() => ({
    day:   filtered[0]  ?? null,
    week:  filtered[1]  ?? null,
    month: filtered[2]  ?? null,
  }), [filtered])

  // Bar chart
  const barData = filtered.slice(0, 10).map(m => ({
    name: m.employee.full_name.split(' ')[0],
    uph: m.todayUPH ?? 0,
    role: m.employee.primary_role,
  }))

  const kpis = [
    { label: '#1 Performer', value: filtered[0]?.employee.full_name ?? '—', sub: `${fmtUPH(filtered[0]?.todayUPH)} Orders/h`, icon: '🥇', color: '#f59e0b' },
    { label: 'Καλύτερο UPH', value: fmtUPH(filtered[0]?.todayUPH), sub: 'Orders/Hour σήμερα', icon: '⚡', color: '#3b82f6' },
    { label: 'Μεγαλύτερη Βελτίωση', value: mostImproved[0] ? `+${mostImproved[0].trend}%` : '—', sub: mostImproved[0]?.employee.full_name ?? '', icon: '📈', color: '#22c55e' },
    { label: 'Πιο Σταθερός', value: mostConsistent[0]?.employee.full_name ?? '—', sub: `Score: ${mostConsistent[0]?.consistencyScore ?? '—'}`, icon: '🎯', color: '#8b5cf6' },
  ]

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/team')} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Top Performers</h1>
            <p className="text-xs text-slate-400">Κατάταξη κορυφαίων εργαζομένων</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {kpis.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-2xl mb-2">{k.icon}</div>
              <div className="text-lg font-bold text-slate-800 truncate">{k.value}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{k.label}</div>
              <div className="text-xs font-medium mt-1 truncate" style={{ color: k.color }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Role filter */}
        <div className="flex gap-2">
          {roles.map(r => (
            <button
              key={r}
              onClick={() => setActiveRole(r)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeRole === r ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >{roleLabels[r]}</button>
          ))}
        </div>

        {/* Podium */}
        {filtered.length >= 3 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" /> Podium
            </h2>
            <div className="grid grid-cols-3 gap-4 max-w-2xl">
              {/* Silver first (left), Gold center (up), Bronze right */}
              <div className="mt-8"><PodiumCard m={filtered[1]} rank={2} /></div>
              <PodiumCard m={filtered[0]} rank={1} />
              <div className="mt-8"><PodiumCard m={filtered[2]} rank={3} /></div>
            </div>
          </div>
        )}

        {/* General Leaderboard + Bar Chart */}
        <div className="grid grid-cols-2 gap-6">

          {/* Full leaderboard */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-700">Γενικό Ranking</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {filtered.map((m, i) => {
                const rc = ROLE_CONFIG[m.employee.primary_role]
                const { label, stars, color } = getRating(m.impactScore)
                return (
                  <div key={m.employee.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-bold text-slate-400 w-6 text-center">
                      {i < 3 ? MEDALS[i] : i + 1}
                    </span>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: `${rc?.color}18`, color: rc?.color }}
                    >{initials(m.employee.full_name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate">{m.employee.full_name}</div>
                      <div className="text-[10px] text-slate-400">{rc?.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-slate-700">{fmtUPH(m.todayUPH)}</div>
                      <Stars n={stars} color={color} />
                    </div>
                    <TrendPill v={m.trend} />
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div className="py-10 text-center text-slate-400 text-sm">Δεν υπάρχουν δεδομένα</div>
              )}
            </div>
          </div>

          {/* Bar chart + Consistent */}
          <div className="space-y-4">
            {/* Bar chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Top 10 Orders/Hour</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [`${v} Orders/h`, 'UPH']}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="uph" radius={[4, 4, 0, 0]}>
                    {barData.map((d, i) => (
                      <Cell key={i} fill={ROLE_CONFIG[d.role as keyof typeof ROLE_CONFIG]?.color ?? '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Most Improved */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-semibold text-slate-700">Biggest Improvements</h2>
              </div>
              <div className="space-y-2">
                {mostImproved.map((m, i) => (
                  <div key={m.employee.id} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                    <span className="text-xs text-slate-700 flex-1 truncate">{m.employee.full_name}</span>
                    <TrendPill v={m.trend} />
                  </div>
                ))}
                {mostImproved.length === 0 && <p className="text-xs text-slate-400">Δεν υπάρχουν δεδομένα</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Hall of Fame */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" /> Hall of Fame (βάσει UPH σήμερα)
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { title: '🏆 Employee of the Day',   m: hallOfFame.day   },
              { title: '⭐ Employee of the Week',  m: hallOfFame.week  },
              { title: '🎖️ Employee of the Month', m: hallOfFame.month },
            ].map(({ title, m }) => {
              if (!m) return (
                <div key={title} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="text-sm font-semibold text-slate-400">{title}</div>
                  <div className="text-xs text-slate-300 mt-2">Δεν υπάρχουν δεδομένα</div>
                </div>
              )
              const rc = ROLE_CONFIG[m.employee.primary_role]
              const { label, stars, color } = getRating(m.impactScore)
              return (
                <div key={title} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="text-sm font-semibold text-slate-600 mb-4">{title}</div>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: `${rc?.color}18`, color: rc?.color }}
                    >{initials(m.employee.full_name)}</div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{m.employee.full_name}</div>
                      <div className="text-xs text-slate-400">{rc?.label}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold font-mono" style={{ color: rc?.color }}>{fmtUPH(m.todayUPH)}</div>
                      <div className="text-[9px] text-slate-400">Orders/h</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold font-mono text-slate-700">{m.ordersToday ?? '—'}</div>
                      <div className="text-[9px] text-slate-400">Παραγγελίες</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Stars n={stars} color={color} />
                    <span className="text-xs font-medium" style={{ color }}>{label}</span>
                  </div>
                  {m.trend != null && (
                    <div className="mt-2 text-xs font-semibold" style={{ color: m.trend >= 0 ? '#10b981' : '#ef4444' }}>
                      {m.trend >= 0 ? '▲ +' : '▼ '}{m.trend}% vs ΜΟ 30 ημερών
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Most Consistent */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-700">Most Consistent Employees</h2>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {mostConsistent.map((m, i) => {
              const rc = ROLE_CONFIG[m.employee.primary_role]
              return (
                <div key={m.employee.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2.5">
                  <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ background: `${rc?.color}18`, color: rc?.color }}
                  >{initials(m.employee.full_name)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-slate-700 truncate">{m.employee.full_name.split(' ')[0]}</div>
                    <div className="text-[10px] text-slate-400">{m.consistencyScore}/100</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
