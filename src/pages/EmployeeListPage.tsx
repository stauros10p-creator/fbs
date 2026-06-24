// src/pages/EmployeeListPage.tsx — Full redesign with Impact Score + Rankings

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, Grid3X3, List, Users, BarChart2, Package,
  TrendingUp, TrendingDown, Zap, ChevronDown, ChevronUp, Minus,
} from 'lucide-react'
import { useProductivityData, nameMatch, impactColor } from '@/lib/useProductivityData'
import type { DayRow, ProdSnapshot, EmployeeMetrics } from '@/lib/useProductivityData'
import { ROLE_CONFIG } from '@/types'
import { cn, initials } from '@/lib/utils'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────
type SortKey   = 'impact' | 'uph' | 'orders' | 'trend' | 'flex' | 'name'
type RoleFilter = 'all' | 'picker' | 'packer' | 'operator'
type ViewMode  = 'list' | 'grid'
type TabView   = 'list' | 'top10' | 'byRole' | 'improved'

// ── Helpers ────────────────────────────────────────────────────────────────────
function getEmployeeDays(empName: string, snap: ProdSnapshot | null): DayRow[] {
  return [
    ...(snap?.pickers_days   ?? []),
    ...(snap?.packers_days   ?? []),
    ...(snap?.operators_days ?? []),
  ].filter(r => nameMatch(empName, r.ONOMA))
   .sort((a, b) => a.DAY.localeCompare(b.DAY))
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ImpactRing({ score, size = 60 }: { score: number; size?: number }) {
  const r    = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const col  = impactColor(score)
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={8}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fontSize={size >= 60 ? 14 : 11} fontWeight="bold" fill={col}>{score}</text>
    </svg>
  )
}

function Sparkline({ days }: { days: DayRow[] }) {
  if (days.length < 2) return <span className="text-slate-200 text-xs">—</span>
  const data  = days.slice(-14).map(d => ({ v: d.UPH ?? 0 }))
  const isUp  = data[data.length - 1].v >= data[0].v
  return (
    <div style={{ width: 72, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="v" stroke={isUp ? '#22c55e' : '#ef4444'}
                dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function FlexDots({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map(i => (
        <div key={i}
          className={cn('w-2.5 h-2.5 rounded-full transition-colors', i <= count ? 'bg-indigo-500' : 'bg-slate-200')} />
      ))}
      <span className="ml-1 text-xs text-slate-400">{count}/3</span>
    </div>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width={11} height={11} viewBox="0 0 24 24"
          fill={i <= n ? '#f59e0b' : '#e2e8f0'}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: any; color: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 flex items-start gap-4 shadow-sm">
      <div className="p-2.5 rounded-xl" style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-800 mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-emerald-500 font-medium mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend == null) return <span className="text-slate-300 text-xs">—</span>
  const up = trend >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold',
      up ? 'text-emerald-600' : 'text-red-500')}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {trend > 0 ? '+' : ''}{trend}%
    </span>
  )
}

// ── Grid Card ──────────────────────────────────────────────────────────────────
function EmployeeCard({ m, rank, days, onClick }: {
  m: EmployeeMetrics; rank: number; days: DayRow[]; onClick: () => void
}) {
  const rc = ROLE_CONFIG[m.employee.primary_role]
  return (
    <div onClick={onClick}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: `${rc?.color}18`, color: rc?.color }}>
            {initials(m.employee.full_name)}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900 leading-tight">
              {m.employee.full_name}
            </p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: `${rc?.color}18`, color: rc?.color }}>
              {rc?.label}
            </span>
          </div>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">#{rank}</span>
      </div>

      <div className="flex items-center justify-between">
        <ImpactRing score={m.impactScore} size={52} />
        <div className="text-right space-y-1">
          <div>
            <p className="text-[10px] text-slate-400">Μ.Ο. μήνα</p>
            <p className="text-lg font-bold font-mono" style={{ color: rc?.color }}>
              {m.monthUPH?.toFixed(1) ?? '—'}
            </p>
          </div>
          <TrendBadge trend={m.trend} />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
        <FlexDots count={m.flexibilityRoles} />
        <Stars n={m.ratingStars} />
      </div>
    </div>
  )
}

// ── AI Insights ────────────────────────────────────────────────────────────────
function AIInsights({ sorted }: { sorted: EmployeeMetrics[] }) {
  const active = sorted.filter(m => m.hasData)
  if (active.length === 0) return null

  const top      = active[0]
  const topPct   = Math.round((1 / active.length) * 100)
  const topRank  = 1

  const mostFlex = [...active].sort((a, b) => b.flexibilityRoles - a.flexibilityRoles)[0]
  const mostImp  = [...active].filter(m => m.trend != null).sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))[0]
  const triRole  = active.filter(m => m.flexibilityRoles === 3).length

  const firstName = (m: EmployeeMetrics) => m.employee.full_name.split(' ')[0]

  const insights = [
    {
      icon: '🏆',
      text: `Ο/Η ${firstName(top)} ανήκει στο Top ${topPct}% των εργαζομένων (Impact Score: ${top.impactScore}/100, #${topRank} στην αποθήκη).`,
      color: '#f59e0b',
    },
    mostFlex.flexibilityRoles >= 2 && {
      icon: '🔄',
      text: `Ο/Η ${firstName(mostFlex)} έχει το υψηλότερο Flexibility Score — καλύπτει ${mostFlex.flexibilityRoles} διαφορετικούς ρόλους και είναι ιδανικός/η για critical reallocations.`,
      color: '#6366f1',
    },
    mostImp && (mostImp.trend ?? 0) > 0 && {
      icon: '📈',
      text: `Ο/Η ${firstName(mostImp)} εμφανίζει τη μεγαλύτερη βελτίωση σήμερα με trend +${mostImp.trend}% έναντι του 30ήμερου μέσου.`,
      color: '#22c55e',
    },
    triRole > 0 && {
      icon: '⚡',
      text: `${triRole} εργαζόμενοι μπορούν να καλύψουν και τους 3 ρόλους — κρίσιμο asset για ευέλικτη στελέχωση σε SLA peaks.`,
      color: '#0ea5e9',
    },
  ].filter(Boolean) as { icon: string; text: string; color: string }[]

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-bold text-slate-700">AI Insights</span>
        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
          Auto-generated from data
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((ins, i) => (
          <div key={i}
            className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex gap-3 items-start">
            <span className="text-lg leading-none mt-0.5">{ins.icon}</span>
            <p className="text-xs text-slate-600 leading-relaxed">{ins.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Rankings ───────────────────────────────────────────────────────────────────
function RankingByRole({ all }: { all: EmployeeMetrics[] }) {
  const roles = ['picker', 'packer', 'operator'] as const
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {roles.map(role => {
        const rc      = ROLE_CONFIG[role]
        const members = all.filter(m => m.employee.primary_role === role && m.hasData)
                           .sort((a, b) => b.impactScore - a.impactScore)
        return (
          <div key={role} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-50"
              style={{ background: `${rc?.color}08` }}>
              <span className="text-xs font-bold" style={{ color: rc?.color }}>{rc?.label}</span>
              <span className="ml-2 text-[10px] text-slate-400">{members.length} εργαζόμενοι</span>
            </div>
            <div className="divide-y divide-slate-50">
              {members.slice(0, 8).map((m, i) => (
                <div key={m.employee.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-[10px] font-bold text-slate-400 w-4">#{i+1}</span>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: `${rc?.color}18`, color: rc?.color }}>
                    {initials(m.employee.full_name)}
                  </div>
                  <span className="flex-1 text-xs text-slate-700 truncate">{m.employee.full_name}</span>
                  <ImpactRing score={m.impactScore} size={28} />
                </div>
              ))}
              {members.length === 0 && (
                <p className="px-4 py-4 text-xs text-slate-400 text-center">Δεν υπάρχουν δεδομένα</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Top10({ sorted }: { sorted: EmployeeMetrics[] }) {
  const top10 = sorted.filter(m => m.hasData).slice(0, 10)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 bg-gradient-to-r from-amber-50 to-white">
        <p className="text-sm font-bold text-slate-800">🏆 Top 10 Most Impactful Employees</p>
        <p className="text-xs text-slate-400">Βασισμένο σε Impact Score (Productivity + Flexibility + Trend)</p>
      </div>
      <div className="divide-y divide-slate-50">
        {top10.map((m, i) => {
          const rc    = ROLE_CONFIG[m.employee.primary_role]
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
          return (
            <div key={m.employee.id} className="flex items-center gap-4 px-5 py-3">
              <div className="w-8 text-center">
                {medal
                  ? <span className="text-lg">{medal}</span>
                  : <span className="text-sm font-bold text-slate-300">#{i+1}</span>}
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: `${rc?.color}18`, color: rc?.color }}>
                {initials(m.employee.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{m.employee.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-medium" style={{ color: rc?.color }}>{rc?.label}</span>
                  <span className="text-[10px] text-slate-400">{m.impactLabel}</span>
                </div>
              </div>
              <ImpactRing score={m.impactScore} size={44} />
              <div className="text-right min-w-[60px]">
                <p className="text-sm font-bold font-mono" style={{ color: rc?.color }}>
                  {m.monthUPH?.toFixed(1) ?? '—'}
                </p>
                <p className="text-[10px] text-slate-400">μ.ο. μήνα</p>
              </div>
              <TrendBadge trend={m.trend} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MostImproved({ all }: { all: EmployeeMetrics[] }) {
  const improved = all.filter(m => m.trend != null && m.trend > 0)
                      .sort((a, b) => (b.trend ?? 0) - (a.trend ?? 0))
                      .slice(0, 10)
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-50 bg-gradient-to-r from-emerald-50 to-white">
        <p className="text-sm font-bold text-slate-800">📈 Most Improved Today</p>
        <p className="text-xs text-slate-400">Εργαζόμενοι που βελτίωσαν σήμερα vs 30ήμερο μέσο</p>
      </div>
      <div className="divide-y divide-slate-50">
        {improved.map((m, i) => {
          const rc = ROLE_CONFIG[m.employee.primary_role]
          return (
            <div key={m.employee.id} className="flex items-center gap-4 px-5 py-3">
              <span className="text-[10px] font-bold text-slate-300 w-5">#{i+1}</span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: `${rc?.color}18`, color: rc?.color }}>
                {initials(m.employee.full_name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 truncate">{m.employee.full_name}</p>
                <span className="text-[10px] font-medium" style={{ color: rc?.color }}>{rc?.label}</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                <TrendingUp className="w-4 h-4" />+{m.trend}%
              </div>
              <div className="text-right">
                <p className="text-xs font-mono text-slate-600">{m.monthUPH?.toFixed(1)} o/h</p>
                <p className="text-[10px] text-slate-400">μ.ο. μήνα</p>
              </div>
            </div>
          )
        })}
        {improved.length === 0 && (
          <p className="px-5 py-8 text-sm text-slate-400 text-center">Δεν υπάρχουν βελτιώσεις σήμερα</p>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'impact',  label: 'Impact Score' },
  { key: 'uph',    label: 'Orders/Hour' },
  { key: 'orders', label: 'Παραγγελίες' },
  { key: 'trend',  label: 'Trend' },
  { key: 'flex',   label: 'Flexibility' },
  { key: 'name',   label: 'Αλφαβητικά' },
]

const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: 'all',      label: 'Όλοι οι Εργαζόμενοι' },
  { key: 'operator', label: 'Operators' },
  { key: 'picker',   label: 'Pickers (Ράφι)' },
  { key: 'packer',   label: 'Packers' },
]

const VIEW_TABS: { key: TabView; label: string; icon: string }[] = [
  { key: 'list',    label: 'Λίστα',      icon: '📋' },
  { key: 'top10',   label: 'Top 10',     icon: '🏆' },
  { key: 'byRole',  label: 'Ανά Ρόλο',   icon: '🎭' },
  { key: 'improved',label: 'Βελτίωση',   icon: '📈' },
]

export function EmployeeListPage() {
  const navigate = useNavigate()
  const { allMetrics, prodSnap, totalOrdersToday, meanUPH, loading } = useProductivityData()

  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState<SortKey>('impact')
  const [asc,        setAsc]        = useState(false)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [viewMode,   setViewMode]   = useState<ViewMode>('list')
  const [tabView,    setTabView]    = useState<TabView>('list')
  const [sortOpen,   setSortOpen]   = useState(false)

  // ── Computed stats ───────────────────────────────────────────────────────────
  const active    = useMemo(() => allMetrics.filter(m => m.hasData), [allMetrics])
  const avgImpact = useMemo(() => {
    if (!active.length) return 0
    return Math.round(active.reduce((s, m) => s + m.impactScore, 0) / active.length)
  }, [active])

  const roleCount = (role: RoleFilter) =>
    role === 'all' ? allMetrics.length
    : allMetrics.filter(m => m.employee.primary_role === role).length

  // ── Sorted + filtered list ───────────────────────────────────────────────────
  const sortedAll = useMemo(() => {
    return [...allMetrics].sort((a, b) => {
      let va: number, vb: number
      switch (sort) {
        case 'name':    return asc ? a.employee.full_name.localeCompare(b.employee.full_name)
                                   : b.employee.full_name.localeCompare(a.employee.full_name)
        case 'uph':    va = a.monthUPH ?? -1;     vb = b.monthUPH ?? -1; break
        case 'orders': va = a.ordersToday ?? -1;  vb = b.ordersToday ?? -1; break
        case 'trend':  va = a.trend ?? -999;       vb = b.trend ?? -999; break
        case 'flex':   va = a.flexibilityRoles;    vb = b.flexibilityRoles; break
        default:       va = a.impactScore;         vb = b.impactScore; break
      }
      return asc ? va - vb : vb - va
    })
  }, [allMetrics, sort, asc])

  const filtered = useMemo(() => {
    return sortedAll.filter(m => {
      if (roleFilter !== 'all' && m.employee.primary_role !== roleFilter) return false
      if (search) return m.employee.full_name.toLowerCase().includes(search.toLowerCase())
      return true
    })
  }, [sortedAll, roleFilter, search])

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(a => !a)
    else { setSort(key); setAsc(false) }
    setSortOpen(false)
  }

  const sortLabel = SORT_OPTIONS.find(o => o.key === sort)?.label ?? 'Impact Score'

  return (
    <div className="min-h-full bg-slate-50">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/team')} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">Εργαζόμενοι</h1>
            <p className="text-xs text-slate-400">Manage and monitor your warehouse team performance</p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 w-52"
            />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">

        {/* ── Stats Row ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Employees" value={allMetrics.length}
            sub={`${active.length} ενεργοί σήμερα`} icon={Users} color="#3b82f6" />
          <StatCard label="Average Impact Score" value={`${avgImpact}/100`}
            icon={Zap} color={impactColor(avgImpact)} />
          <StatCard label="Total Orders Today" value={totalOrdersToday.toLocaleString()}
            icon={Package} color="#f97316" />
          <StatCard label="Avg Orders/Hour" value={meanUPH?.toFixed(1) ?? '—'}
            icon={BarChart2} color="#22c55e" />
        </div>

        {/* ── Main Card ───────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* View tabs */}
          <div className="border-b border-slate-100 px-5 flex items-center justify-between">
            <div className="flex">
              {VIEW_TABS.map(tab => (
                <button key={tab.key} onClick={() => setTabView(tab.key)}
                  className={cn('px-4 py-3.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors',
                    tabView === tab.key
                      ? 'border-slate-800 text-slate-800'
                      : 'border-transparent text-slate-400 hover:text-slate-600')}>
                  <span>{tab.icon}</span>{tab.label}
                </button>
              ))}
            </div>
          </div>

          {tabView === 'list' && (
            <>
              {/* Filter row */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50 bg-slate-50/50">
                <div className="flex gap-0">
                  {ROLE_TABS.map(tab => {
                    const rc     = ROLE_CONFIG[tab.key as keyof typeof ROLE_CONFIG]
                    const active = roleFilter === tab.key
                    return (
                      <button key={tab.key} onClick={() => setRoleFilter(tab.key)}
                        className={cn('px-3.5 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5',
                          active
                            ? tab.key === 'all' ? 'bg-slate-800 text-white' : 'text-white'
                            : 'text-slate-500 hover:bg-slate-100'
                        )}
                        style={active && tab.key !== 'all' ? { background: rc?.color } : {}}>
                        {tab.label}
                        <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 font-bold',
                          active ? 'bg-white/20' : 'bg-slate-200 text-slate-400')}>
                          {roleCount(tab.key)}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">{filtered.length} εμφανίζονται</span>

                  {/* Sort dropdown */}
                  <div className="relative">
                    <button onClick={() => setSortOpen(o => !o)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 bg-white hover:border-slate-300">
                      Sort: {sortLabel}
                      {asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {sortOpen && (
                      <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden py-1">
                        {SORT_OPTIONS.map(opt => (
                          <button key={opt.key} onClick={() => toggleSort(opt.key)}
                            className={cn('w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between',
                              sort === opt.key ? 'text-slate-800 font-semibold' : 'text-slate-500')}>
                            {opt.label}
                            {sort === opt.key && (asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* View toggle */}
                  <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
                    <button onClick={() => setViewMode('list')}
                      className={cn('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-slate-200')}>
                      <List className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                    <button onClick={() => setViewMode('grid')}
                      className={cn('p-1.5 rounded-md transition-all', viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-slate-200')}>
                      <Grid3X3 className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Grid View */}
              {viewMode === 'grid' ? (
                <div className="p-5 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map((m, i) => (
                    <EmployeeCard key={m.employee.id} m={m} rank={i + 1}
                      days={getEmployeeDays(m.employee.full_name, prodSnap)}
                      onClick={() => navigate(`/team/employees/${m.employee.id}`)} />
                  ))}
                  {filtered.length === 0 && (
                    <div className="col-span-full py-12 text-center text-sm text-slate-400">
                      Δεν βρέθηκαν αποτελέσματα
                    </div>
                  )}
                </div>
              ) : (
                /* List/Table View */
                <table className="w-full">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {[
                        { label: 'Εργαζόμενος' },
                        { label: 'Impact Score', center: true },
                        { label: 'Orders/Hour', center: true },
                        { label: 'Παραγγελίες', center: true },
                        { label: 'Trend 30D', center: true },
                        { label: 'Flexibility', center: true },
                        { label: 'Rating' },
                      ].map(col => (
                        <th key={col.label}
                          className={cn('px-4 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider',
                            col.center ? 'text-center' : 'text-left')}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((m, i) => {
                      const rc   = ROLE_CONFIG[m.employee.primary_role]
                      const days = getEmployeeDays(m.employee.full_name, prodSnap)
                      return (
                        <tr key={m.employee.id}
                          onClick={() => navigate(`/team/employees/${m.employee.id}`)}
                          className={cn('cursor-pointer hover:bg-slate-50/80 transition-colors group',
                            !m.hasData && 'opacity-50')}>
                          {/* Employee */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: `${rc?.color}18`, color: rc?.color }}>
                                {initials(m.employee.full_name)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 leading-tight">
                                  {m.employee.full_name}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                    style={{ background: `${rc?.color}18`, color: rc?.color }}>
                                    {rc?.label}
                                  </span>
                                  {i < 3 && m.hasData && (
                                    <span className="text-[10px] text-amber-500 font-bold">
                                      {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          {/* Impact Ring */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <ImpactRing score={m.impactScore} size={44} />
                              <span className="text-[10px] font-medium"
                                style={{ color: impactColor(m.impactScore) }}>
                                {m.impactLabel}
                              </span>
                            </div>
                          </td>
                          {/* UPH — 30-day avg */}
                          <td className="px-4 py-3.5 text-center">
                            <div>
                              <span className="text-sm font-bold font-mono"
                                style={{ color: m.monthUPH ? rc?.color : '#cbd5e1' }}>
                                {m.monthUPH?.toFixed(1) ?? '—'}
                              </span>
                              {m.monthUPH && (
                                <p className="text-[10px] text-slate-400">μ.ο. μήνα</p>
                              )}
                            </div>
                          </td>
                          {/* Orders */}
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-sm font-mono text-slate-600">
                              {m.ordersToday ?? '—'}
                            </span>
                          </td>
                          {/* Trend */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Sparkline days={days} />
                              <TrendBadge trend={m.trend} />
                            </div>
                          </td>
                          {/* Flexibility */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex justify-center">
                              <FlexDots count={m.flexibilityRoles} />
                            </div>
                          </td>
                          {/* Rating */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-0.5">
                              <Stars n={m.ratingStars} />
                              <span className="text-[10px] text-slate-400">{m.rating}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                          Δεν βρέθηκαν αποτελέσματα
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </>
          )}

          {tabView === 'top10'    && <div className="p-5"><Top10 sorted={sortedAll} /></div>}
          {tabView === 'byRole'   && <div className="p-5"><RankingByRole all={allMetrics} /></div>}
          {tabView === 'improved' && <div className="p-5"><MostImproved all={allMetrics} /></div>}
        </div>

        {/* ── AI Insights ─────────────────────────────────────────────────────── */}
        <AIInsights sorted={sortedAll} />

      </div>
    </div>
  )
}
