// src/pages/EmployeeListPage.tsx — Warehouse Shift Management Control Center

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import {
  useProductivityData, nameMatch, type DayRow,
  impactColor, getImpactLabel, getRating,
} from '@/lib/useProductivityData'
import { initials } from '@/lib/utils'
import {
  ChevronDown, ChevronUp, X, AlertTriangle, Zap, ExternalLink, Search,
} from 'lucide-react'
import {
  BarChart, Bar, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis,
} from 'recharts'
import type { Employee } from '@/types'

// ── Role targets (orders/hour) ────────────────────────────────────────────────
const ROLE_TARGETS: Record<string, number> = {
  operator:   180,
  packer:      75,
  picker:      80,
  palletizer:  50,
  sorter:      50,
  validator:   60,
  transporter: 50,
  team_leader: 80,
}

// ── Role display groups (render order) ───────────────────────────────────────
const ROLE_GROUPS = [
  { roles: ['operator'],                                                    label: 'OPERATORS',           color: '#f59e0b' },
  { roles: ['packer'],                                                      label: 'PACKERS',             color: '#22c55e' },
  { roles: ['picker'],                                                      label: 'PICKERS (ΡΑΦΙ)',      color: '#3b82f6' },
  { roles: ['palletizer', 'sorter', 'validator', 'transporter', 'team_leader'], label: 'PALLETIZERS / SORTERS', color: '#8b5cf6' },
]

// ── Session validity ──────────────────────────────────────────────────────────
function isValidDay(r: DayRow) {
  return r.ORES >= 3 && r.ORDERS > 100 && r.ORES < 13
}

// ── Per-employee computed stats ───────────────────────────────────────────────
interface EmpStats {
  liveUPH:     number | null
  isLive:      boolean         // true = today's session, false = monthly avg
  target:      number
  gap:         number | null   // liveUPH − target
  gapPct:      number | null   // gap / target × 100
  status:      'above' | 'near' | 'below' | 'none'
  achieveDays: number
  totalDays:   number
  achievePct:  number | null   // days on/above target / total valid days
  trendPct:    number | null   // today vs month avg %
  streakAbove: number          // consecutive most-recent days above target
  streakBelow: number
  validDays:   DayRow[]
}

function computeStats(emp: Employee, metrics: any, prodSnap: any, overrideRole?: string): EmpStats {
  const role   = overrideRole ?? emp.primary_role
  const target = ROLE_TARGETS[role] ?? 70

  const roleArr: DayRow[] | undefined =
    role === 'operator' ? prodSnap?.operators_days :
    role === 'packer'   ? prodSnap?.packers_days   :
    role === 'picker'   ? prodSnap?.pickers_days   :
    undefined

  const oracleName = (emp as any).oracle_name as string | null | undefined
  const validDays: DayRow[] = (roleArr ?? [])
    .filter((r: DayRow) => nameMatch(emp.full_name, r.ONOMA, oracleName) && isValidDay(r))
    .sort((a: DayRow, b: DayRow) => a.DAY.localeCompare(b.DAY))

  // For secondary/tertiary role groups: derive UPH directly from that role's _days data.
  // Never fall back to metrics (which are primary-role based) — avoids showing operator
  // UPH inside the packers table just because the employee has secondary_role = 'packer'.
  const isSecondaryRole = overrideRole != null && overrideRole !== emp.primary_role
  let todayUPH: number | null
  let monthUPH: number | null

  if (isSecondaryRole) {
    // Compute monthly avg from validDays only — if no days, stays null → employee hidden from group
    monthUPH = validDays.length > 0
      ? Math.round((validDays.reduce((s, d) => s + (d.UPH ?? 0), 0) / validDays.length) * 10) / 10
      : null
    todayUPH = null  // today's role can't be determined from days array alone
  } else {
    todayUPH = metrics?.todayUPH ?? null
    monthUPH = metrics?.monthUPH ?? null
  }

  const liveUPH = todayUPH ?? monthUPH
  const isLive  = todayUPH != null

  const gap    = liveUPH != null ? Math.round((liveUPH - target) * 10) / 10 : null
  const gapPct = liveUPH != null ? Math.round(((liveUPH - target) / target) * 100) : null

  const status: EmpStats['status'] =
    liveUPH == null           ? 'none'  :
    liveUPH >= target         ? 'above' :
    liveUPH >= target * 0.9   ? 'near'  : 'below'

  const achieveDays = validDays.filter(d => (d.UPH ?? 0) >= target).length
  const achievePct  = validDays.length > 0
    ? Math.round((achieveDays / validDays.length) * 100) : null

  // Streak from most recent day
  const desc = [...validDays].reverse()
  let streakAbove = 0, streakBelow = 0
  for (const d of desc) {
    if ((d.UPH ?? 0) >= target) {
      if (streakBelow > 0) break
      streakAbove++
    } else {
      if (streakAbove > 0) break
      streakBelow++
    }
  }

  return {
    liveUPH, isLive, target, gap, gapPct, status,
    achieveDays, totalDays: validDays.length, achievePct,
    trendPct: isSecondaryRole ? null : (metrics?.trend ?? null),
    streakAbove, streakBelow, validDays,
  }
}

// ── Small UI primitives ───────────────────────────────────────────────────────
function StatusDot({ status }: { status: EmpStats['status'] }) {
  const cls =
    status === 'above' ? 'bg-emerald-500' :
    status === 'near'  ? 'bg-amber-400'   :
    status === 'below' ? 'bg-red-500'     : 'bg-slate-300'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />
}

function GapBadge({ gap, pct }: { gap: number | null; pct: number | null }) {
  if (gap == null) return <span className="text-slate-300 text-xs">—</span>
  const pos = gap >= 0
  return (
    <div className={`text-xs font-bold leading-none ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      <div>{pos ? '+' : ''}{gap}</div>
      <div className="text-[10px] font-normal opacity-70">{pos ? '+' : ''}{pct}%</div>
    </div>
  )
}

function AchieveBadge({ achieved, total, pct }: { achieved: number; total: number; pct: number | null }) {
  if (pct == null || total === 0) return <span className="text-slate-300 text-xs">—</span>
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col gap-0.5 min-w-[72px]">
      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
        {achieved}/{total}d · <span style={{ color }}>{pct}%</span>
      </span>
    </div>
  )
}

// ── Group header ──────────────────────────────────────────────────────────────
interface GroupInfo {
  label: string; color: string
  employees: Employee[]
  withData: { emp: Employee; stats: EmpStats }[]
  avgUPH: number | null; target: number; gapPct: number | null
  above: number; near: number; below: number; noData: number
}

function GroupHeader({ g, collapsed, onToggle }: {
  g: GroupInfo; collapsed: boolean; onToggle: () => void
}) {
  const gapColor =
    g.gapPct == null ? '#94a3b8' :
    g.gapPct >= 0    ? '#22c55e' :
    g.gapPct >= -10  ? '#f59e0b' : '#ef4444'

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-4 px-4 py-2.5 text-left bg-slate-100 border-y border-slate-200 hover:bg-slate-200/70 transition-colors sticky top-0 z-10"
      style={{ borderLeft: `4px solid ${g.color}` }}
    >
      <span className="flex items-center gap-2 flex-shrink-0">
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronUp   className="w-3.5 h-3.5 text-slate-400" />}
        <span className="font-bold text-xs text-slate-700 tracking-widest uppercase">{g.label}</span>
        <span className="text-slate-400 text-xs">({g.employees.length})</span>
      </span>

      {g.avgUPH != null && (
        <div className="flex items-center gap-5 flex-1">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold">Avg UPH</span>
            <span className="text-xs font-bold text-slate-700">{g.avgUPH} o/h</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold">Στόχος</span>
            <span className="text-xs font-bold text-slate-700">{g.target} o/h</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold">Gap</span>
            <span className="text-xs font-bold" style={{ color: gapColor }}>
              {g.gapPct != null ? `${g.gapPct >= 0 ? '+' : ''}${g.gapPct}%` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs ml-auto">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{g.above}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400  inline-block" />{g.near}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500    inline-block" />{g.below}</span>
            {g.noData > 0 && (
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />{g.noData}
              </span>
            )}
          </div>
        </div>
      )}
    </button>
  )
}

// ── Employee row ──────────────────────────────────────────────────────────────
function EmpRow({ emp, stats, isSelected, onClick }: {
  emp: Employee; stats: EmpStats; isSelected: boolean; onClick: () => void
}) {
  const bg =
    isSelected              ? 'bg-blue-50'          :
    stats.status === 'below' ? 'hover:bg-red-50/40'     :
    stats.status === 'above' ? 'hover:bg-emerald-50/40' : 'hover:bg-slate-50'

  return (
    <tr
      onClick={onClick}
      className={`border-b border-slate-100 cursor-pointer transition-colors ${bg}`}
      style={isSelected ? { borderLeft: '3px solid #3b82f6' } : {}}
    >
      {/* Employee */}
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {initials(emp.full_name)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-800 truncate leading-tight">{emp.full_name}</div>
            <div className="text-[10px] text-slate-400 capitalize">{emp.primary_role}</div>
          </div>
        </div>
      </td>

      {/* Live UPH */}
      <td className="px-3 py-2.5 text-center">
        {stats.liveUPH != null ? (
          <div className="flex flex-col items-center leading-none">
            <span className="text-sm font-bold text-slate-800">{Math.round(stats.liveUPH)}</span>
            <span className="text-[9px] font-semibold mt-0.5" style={{ color: stats.isLive ? '#22c55e' : '#94a3b8' }}>
              {stats.isLive ? '● LIVE' : 'μ.ο. μήνα'}
            </span>
          </div>
        ) : <span className="text-slate-300 text-xs">—</span>}
      </td>

      {/* Target */}
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs text-slate-500 font-mono">{stats.target}</span>
      </td>

      {/* Gap */}
      <td className="px-3 py-2.5 text-center">
        <GapBadge gap={stats.gap} pct={stats.gapPct} />
      </td>

      {/* Trend */}
      <td className="px-3 py-2.5 text-center">
        {stats.trendPct != null ? (
          <span className={`text-xs font-bold ${stats.trendPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {stats.trendPct >= 0 ? '▲' : '▼'} {Math.abs(stats.trendPct)}%
          </span>
        ) : <span className="text-slate-300 text-xs">—</span>}
      </td>

      {/* Target Achievement */}
      <td className="px-3 py-2.5">
        <AchieveBadge achieved={stats.achieveDays} total={stats.totalDays} pct={stats.achievePct} />
      </td>

      {/* Status */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusDot status={stats.status} />
          <span className="text-[10px] text-slate-500">
            {stats.status === 'above' ? 'Above' : stats.status === 'near' ? 'Near' : stats.status === 'below' ? 'Below' : '—'}
          </span>
          {stats.streakBelow >= 3 && (
            <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1 rounded">↓{stats.streakBelow}d</span>
          )}
          {stats.streakAbove >= 5 && (
            <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1 rounded">🔥{stats.streakAbove}d</span>
          )}
        </div>
      </td>
    </tr>
  )
}

// ── Alerts computation ────────────────────────────────────────────────────────
interface Alert { level: 'critical' | 'warning' | 'info'; text: string }

function computeAlerts(groups: GroupInfo[], allStats: { emp: Employee; stats: EmpStats }[]): Alert[] {
  const alerts: Alert[] = []

  for (const g of groups) {
    if (g.below >= 3) alerts.push({ level: 'critical', text: `${g.below} ${g.label} κάτω από στόχο` })
    else if (g.below > 0) alerts.push({ level: 'warning', text: `${g.below} ${g.label} κάτω από στόχο` })
  }
  for (const { emp, stats } of allStats) {
    if (stats.streakBelow >= 3) {
      const p = emp.full_name.split(' ')
      alerts.push({ level: 'warning', text: `${p[0]} ${p[1]?.[0] ?? ''}.  κάτω από στόχο ${stats.streakBelow} συνεχόμενες ημέρες` })
    }
  }
  for (const { emp, stats } of allStats) {
    if (stats.streakAbove >= 7) {
      const p = emp.full_name.split(' ')
      alerts.push({ level: 'info', text: `${p[0]} ${p[1]?.[0] ?? ''}.  πάνω από στόχο ${stats.streakAbove} συνεχόμενες ημέρες 🔥` })
    }
  }
  return alerts
}

// ── Right panel ───────────────────────────────────────────────────────────────
function RightPanel({ alerts, actions }: { alerts: Alert[]; actions: string[] }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">AI Alerts</span>
          {alerts.length > 0 && (
            <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{alerts.length}</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          {alerts.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic px-1">Όλα εντάξει ✓</div>
          ) : alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-[11px] leading-snug ${
              a.level === 'critical' ? 'bg-red-50 border border-red-200 text-red-700'       :
              a.level === 'warning'  ? 'bg-amber-50 border border-amber-200 text-amber-700' :
              'bg-blue-50 border border-blue-200 text-blue-700'
            }`}>
              <span className="flex-shrink-0">{a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️' : '🔥'}</span>
              {a.text}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Zap className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Top Actions</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {actions.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic px-1">Δεν υπάρχουν προτάσεις</div>
          ) : actions.map((a, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-700 leading-snug">
              <span className="flex-shrink-0">💡</span>{a}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Employee Drawer ───────────────────────────────────────────────────────────
function EmployeeDrawer({ emp, stats, metrics, rank, groupSize, onClose, onNavigate }: {
  emp: Employee; stats: EmpStats; metrics: any
  rank: number; groupSize: number
  onClose: () => void; onNavigate: () => void
}) {
  const impScore = metrics?.impactScore ?? 0
  const { label: ratingLabel, stars, color: ratingColor } = getRating(impScore)

  const chartData = stats.validDays.slice(-14).map(d => ({
    day: d.DAY.substring(5),
    uph: d.UPH ?? 0,
  }))

  const avgOrders = stats.validDays.length > 0
    ? Math.round(stats.validDays.reduce((s, d) => s + d.ORDERS, 0) / stats.validDays.length) : null
  const bestUPH = stats.validDays.length > 0
    ? Math.max(...stats.validDays.map(d => d.UPH ?? 0)) : null

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l border-slate-200 flex flex-col z-50">

        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials(emp.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 text-sm truncate">{emp.full_name}</div>
            <div className="text-[10px] text-slate-500 capitalize">{emp.primary_role}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

          {/* Roles */}
          <div className="grid grid-cols-3 gap-1.5">
            {([['1ος Ρόλος', emp.primary_role], ['2ος Ρόλος', emp.secondary_role], ['3ος Ρόλος', emp.tertiary_role]] as [string, string|null][]).map(([label, value]) => (
              <div key={label} className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                <div className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">{label}</div>
                <div className="text-[11px] font-bold text-slate-700 capitalize mt-0.5 truncate">{value ?? '—'}</div>
              </div>
            ))}
          </div>

          {/* Impact + Rating */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-semibold mb-1">Impact Score</div>
              <div className="text-2xl font-black leading-none" style={{ color: impactColor(impScore) }}>{impScore}</div>
              <div className="text-[10px] text-slate-500 mt-1">{getImpactLabel(impScore)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-semibold mb-1">Rating</div>
              <div className="text-base leading-none" style={{ color: ratingColor }}>
                {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{ratingLabel}</div>
            </div>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg p-2.5 border border-slate-100 bg-slate-50">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Live UPH</div>
              <div className={`text-xl font-black leading-none mt-0.5 ${
                stats.status === 'above' ? 'text-emerald-600' :
                stats.status === 'below' ? 'text-red-500'     : 'text-amber-500'
              }`}>{stats.liveUPH != null ? Math.round(stats.liveUPH) : '—'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">στόχος: {stats.target}</div>
            </div>
            <div className="rounded-lg p-2.5 border border-slate-100 bg-slate-50">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Target Ach.</div>
              <div className={`text-xl font-black leading-none mt-0.5 ${
                (stats.achievePct ?? 0) >= 80 ? 'text-emerald-600' :
                (stats.achievePct ?? 0) >= 60 ? 'text-amber-500'   : 'text-red-500'
              }`}>{stats.achievePct != null ? `${stats.achievePct}%` : '—'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{stats.achieveDays}/{stats.totalDays} ημέρες</div>
            </div>
          </div>

          {/* Ranking */}
          {rank > 0 && groupSize > 0 && (
            <div className="rounded-lg p-2.5 bg-blue-50 border border-blue-100 flex items-center gap-3">
              <span className="text-2xl font-black text-blue-600">#{rank}</span>
              <div>
                <div className="text-[10px] text-blue-700 font-semibold">Ranking στο ρόλο</div>
                <div className="text-[10px] text-blue-400">από {groupSize} εργαζομένους</div>
              </div>
            </div>
          )}

          {/* Streak */}
          {(stats.streakAbove > 0 || stats.streakBelow > 0) && (
            <div className={`rounded-lg p-2.5 text-[11px] font-medium ${
              stats.streakAbove > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-red-50 text-red-700 border border-red-100'
            }`}>
              {stats.streakAbove > 0
                ? `🔥 Πάνω από στόχο ${stats.streakAbove} συνεχόμενες ημέρες`
                : `⚠️ Κάτω από στόχο ${stats.streakBelow} συνεχόμενες ημέρες`}
            </div>
          )}

          {/* UPH bar chart */}
          {chartData.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5">
                UPH Ανά Ημέρα (τελευταίες {chartData.length})
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={chartData} barSize={12} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 7, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <RTooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow">
                          {payload[0].payload.day}: {payload[0].value} o/h
                        </div>
                      ) : null
                    }
                  />
                  <Bar dataKey="uph">
                    {chartData.map((d, i) => (
                      <Cell
                        key={i}
                        fill={d.uph >= stats.target ? '#22c55e' : d.uph >= stats.target * 0.9 ? '#f59e0b' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Averages */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Μέσες Παρ./Ημέρα</div>
              <div className="text-sm font-bold text-slate-700 mt-0.5">{avgOrders != null ? `${avgOrders} orders` : '—'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Καλύτερη Ημέρα</div>
              <div className="text-sm font-bold text-slate-700 mt-0.5">{bestUPH != null ? `${bestUPH.toFixed(0)} o/h` : '—'}</div>
            </div>
          </div>

          {/* Skill level */}
          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
            <div className="text-[9px] text-slate-400 uppercase font-semibold mb-1.5">Skill Level</div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full ${parseInt(emp.skill_level) > i ? 'bg-blue-500' : 'bg-slate-200'}`} />
              ))}
              <span className="text-xs font-bold text-slate-600 ml-1">{emp.skill_level}/5</span>
            </div>
          </div>

          {/* Full profile */}
          <button
            onClick={onNavigate}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Πλήρες Προφίλ & Ιστορικό
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function EmployeeListPage() {
  const navigate   = useNavigate()
  const employees  = useAppStore(s => s.employees)
  const { prodSnap, allMetrics, loading } = useProductivityData()

  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState<'all' | 'above' | 'near' | 'below'>('all')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [collapsed,   setCollapsed]   = useState<Record<string, boolean>>({})

  // Compute stats for every employee
  const empStatMap = useMemo(() => {
    const map = new Map<string, EmpStats>()
    for (const emp of employees) {
      const metrics = allMetrics.find(m => m.employee.id === emp.id)
      map.set(emp.id, computeStats(emp, metrics, prodSnap))
    }
    return map
  }, [employees, allMetrics, prodSnap])

  // Build group info — include primary, secondary AND tertiary role matches
  const groupInfos: GroupInfo[] = useMemo(() =>
    ROLE_GROUPS.map(g => {
      const groupRole = g.roles[0]
      // employee appears in this group if any of their roles matches
      const emps = employees.filter(e =>
        g.roles.some(r =>
          r === e.primary_role ||
          r === (e as any).secondary_role ||
          r === (e as any).tertiary_role
        )
      )
      // compute stats using this group's role data (not necessarily primary role)
      const metrics = (e: Employee) => allMetrics.find(m => m.employee.id === e.id)
      const withData = emps
        .map(e => ({ emp: e, stats: computeStats(e, metrics(e), prodSnap, groupRole) }))
        .filter(x => x.stats.liveUPH != null)

      const avgUPH = withData.length > 0
        ? Math.round(withData.reduce((s, x) => s + (x.stats.liveUPH ?? 0), 0) / withData.length)
        : null
      const target = ROLE_TARGETS[groupRole] ?? 70
      const gapPct = avgUPH != null
        ? Math.round(((avgUPH - target) / target) * 100) : null

      return {
        label: g.label, color: g.color,
        employees: emps, withData, avgUPH, target, gapPct,
        above:  withData.filter(x => x.stats.status === 'above').length,
        near:   withData.filter(x => x.stats.status === 'near').length,
        below:  withData.filter(x => x.stats.status === 'below').length,
        noData: emps.length - withData.length,
      }
    }),
    [employees, allMetrics, prodSnap]
  )

  const allWithStats = useMemo(() =>
    employees.map(e => ({ emp: e, stats: empStatMap.get(e.id)! })),
    [employees, empStatMap]
  )

  const alerts = useMemo(() => computeAlerts(groupInfos, allWithStats), [groupInfos, allWithStats])

  const actions = useMemo(() => {
    const acts: string[] = []
    const withGap = groupInfos.filter(g => g.gapPct != null)
    const sorted  = [...withGap].sort((a, b) => (a.gapPct ?? 0) - (b.gapPct ?? 0))
    const worst   = sorted[0]
    const best    = sorted[sorted.length - 1]

    if (worst?.gapPct != null && worst.gapPct < -5)
      acts.push(`Οι ${worst.label} βρίσκονται ${Math.abs(worst.gapPct)}% κάτω από τον στόχο`)
    if (best?.gapPct != null && best.gapPct > 10)
      acts.push(`Οι ${best.label} ξεπερνούν τον στόχο κατά ${best.gapPct}%`)
    if (worst && best && worst !== best && (worst.gapPct ?? 0) < -8)
      acts.push(`Σκέψου μετακίνηση 1-2 ατόμων από ${best.label} προς ${worst.label}`)

    const needCoaching = allWithStats.filter(x => (x.stats.achievePct ?? 100) < 50 && x.stats.totalDays >= 5)
    if (needCoaching.length > 0)
      acts.push(`${needCoaching.length} εργαζόμενοι χρειάζονται coaching (< 50% target achievement)`)

    return acts
  }, [groupInfos, allWithStats])

  // Filter by search + status
  const filteredIds = useMemo(() => {
    const set = new Set<string>()
    for (const { emp, stats } of allWithStats) {
      const matchSearch = !search || emp.full_name.toLowerCase().includes(search.toLowerCase())
      const matchFilter = filter === 'all' || stats.status === filter
      if (matchSearch && matchFilter) set.add(emp.id)
    }
    return set
  }, [allWithStats, search, filter])

  const selectedStats   = selectedEmp ? empStatMap.get(selectedEmp.id)                          : null
  const selectedMetrics = selectedEmp ? allMetrics.find(m => m.employee.id === selectedEmp.id) : null

  const selectedRank = useMemo(() => {
    if (!selectedEmp || !selectedStats?.liveUPH) return { rank: 0, groupSize: 0 }
    const group  = groupInfos.find(g => g.employees.some(e => e.id === selectedEmp.id))
    if (!group) return { rank: 0, groupSize: 0 }
    const sorted = [...group.withData].sort((a, b) => (b.stats.liveUPH ?? 0) - (a.stats.liveUPH ?? 0))
    const rank   = sorted.findIndex(x => x.emp.id === selectedEmp.id) + 1
    return { rank, groupSize: group.withData.length }
  }, [selectedEmp, selectedStats, groupInfos])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Φόρτωση δεδομένων...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-slate-800 leading-tight">Shift Management</h1>
          <p className="text-[11px] text-slate-400">Operations Control Center · Παραγωγικότητα Βάρδιας</p>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Αναζήτηση εργαζομένου..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 w-48"
          />
        </div>
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {(['all', 'above', 'near', 'below'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'all' ? 'Όλοι' : f === 'above' ? '🟢 Πάνω' : f === 'near' ? '🟡 Κοντά' : '🔴 Κάτω'}
            </button>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Table area */}
        <div className="flex-1 overflow-y-auto">
          {groupInfos.map(g => {
            const isCollapsed = !!collapsed[g.label]
            // show all members; apply search filter; status filter uses group-specific stats
            const allMembers = [...g.withData, ...g.employees
              .filter(e => !g.withData.some(x => x.emp.id === e.id))
              .map(e => ({ emp: e, stats: empStatMap.get(e.id)! }))]
            const visible = allMembers.filter(({ emp, stats }) => {
              const matchSearch = !search || emp.full_name.toLowerCase().includes(search.toLowerCase())
              const matchFilter = filter === 'all' || (stats?.status ?? 'none') === filter
              return matchSearch && matchFilter
            })
            if (filter !== 'all' && visible.length === 0) return null

            return (
              <div key={g.label}>
                <GroupHeader
                  g={g}
                  collapsed={isCollapsed}
                  onToggle={() => setCollapsed(prev => ({ ...prev, [g.label]: !prev[g.label] }))}
                />
                {!isCollapsed && (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-white">
                        {['Εργαζόμενος', 'Live UPH', 'Στόχος', 'Gap', 'Trend', 'Ημέρες / Στόχο', 'Status'].map(h => (
                          <th key={h} className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center first:text-left border-b border-slate-100">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-xs text-slate-400 text-center italic">
                            Κανένας εργαζόμενος αντιστοιχεί στο φίλτρο
                          </td>
                        </tr>
                      ) : visible.map(({ emp, stats }) => (
                        <EmpRow
                          key={emp.id}
                          emp={emp}
                          stats={stats}
                          isSelected={selectedEmp?.id === emp.id}
                          onClick={() => setSelectedEmp(prev => prev?.id === emp.id ? null : emp)}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>

        {/* Right panel */}
        <div className="w-64 flex-shrink-0 bg-white border-l border-slate-200 overflow-y-auto">
          <RightPanel alerts={alerts} actions={actions} />
        </div>
      </div>

      {/* Employee drawer */}
      {selectedEmp && selectedStats && (
        <EmployeeDrawer
          emp={selectedEmp}
          stats={selectedStats}
          metrics={selectedMetrics}
          rank={selectedRank.rank}
          groupSize={selectedRank.groupSize}
          onClose={() => setSelectedEmp(null)}
          onNavigate={() => navigate(`/team/employees/${selectedEmp.id}`)}
        />
      )}
    </div>
  )
}
