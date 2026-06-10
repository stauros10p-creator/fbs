import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '@/store'
import { useBreakRequests, useApplyReallocation } from '@/hooks'
import { ROLE_CONFIG } from '@/types'
import type { EmployeeRole } from '@/types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

// ── Break countdown ───────────────────────────────────────────────────────────
function BreakTimer({ end }: { end: string }) {
  const [s, setS] = useState(Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000)))
  useEffect(() => {
    const t = setInterval(() => setS(p => Math.max(0, p - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  const m   = String(Math.floor(s / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return (
    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
      {m}:{sec}
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const employees     = useAppStore(s => s.employees)
  const engineResult  = useAppStore(s => s.engineResult)
  const latestOps     = useAppStore(s => s.latestOpsSnapshot)
  const todayForecast = useAppStore(s => s.todayForecast)
  const alerts        = useAppStore(s => s.alerts)
  const { data: breaks = [] } = useBreakRequests()
  const applyRealloc  = useApplyReallocation()

  const [applied, setApplied]       = useState<string[]>([])
  const [now, setNow]               = useState(new Date())
  const [nextUpdate, setNextUpdate] = useState(60)

  useEffect(() => {
    const t = setInterval(() => {
      setNow(new Date())
      setNextUpdate(s => (s <= 1 ? 60 : s - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const DAYS   = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο']
  const MONTHS = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου',
                  'Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου']
  const timeStr = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
  const dayStr  = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`

  // KPI values
  const working  = employees.filter(e => e.current_status === 'working' || e.current_status === 'redeployed').length
  const total    = employees.filter(e => e.current_status !== 'off').length
  const unacked  = alerts.filter(a => !a.acknowledged_at).length
  const risk     = engineResult?.overall_risk ?? 0
  const slaScore = Math.round((1 - risk * 0.8) * 1000) / 10
  const slaTrend = Math.round((1 - risk) * 30) / 10
  const riskLabel = risk < 0.3 ? 'Χαμηλός' : risk < 0.6 ? 'Μέτριος' : 'Υψηλός'
  const riskColor = risk < 0.3 ? '#22c55e' : risk < 0.6 ? '#f59e0b' : '#ef4444'
  const bottleneck = engineResult?.bottleneck_role
  const required   = engineResult?.role_capacity.reduce((s, rc) => s + rc.required_count, 0) ?? 0

  // Breaks
  const activeBreaks = breaks.filter(b => b.status === 'active' || b.status === 'pending')

  // Role groups
  const allRoles: EmployeeRole[] = ['picker', 'packer', 'sorter', 'operator', 'validator', 'transporter']
  const roleGroups = allRoles.map(role => {
    const active = employees.filter(
      e => (e.current_status === 'working' || e.current_status === 'redeployed') && e.primary_role === role
    )
    if (active.length === 0) return null
    const rc  = engineResult?.role_capacity.find(r => r.role === role)
    const cap = Math.round(active.reduce((sum, e) =>
      sum + (e.productivity?.find(p => p.role === role)?.units_per_hour ?? 110), 0))
    return { role, active, rc, cap }
  }).filter((g): g is NonNullable<typeof g> => g !== null)

  const suggestions = engineResult?.suggestions ?? []

  // Top performers
  const topPerformers = employees
    .filter(e => e.current_status === 'working' && (e.productivity?.length ?? 0) > 0)
    .map(e => ({ emp: e, uph: e.productivity?.find(p => p.role === e.primary_role)?.units_per_hour ?? 0 }))
    .filter(x => x.uph > 0)
    .sort((a, b) => b.uph - a.uph)
    .slice(0, 5)

  // Chart data (seeded, stable)
  const chartData = useMemo(() => {
    const total = (todayForecast?.due_date_orders ?? 4000) + (todayForecast?.intraday_orders ?? 2000)
    const nowH  = new Date().getHours() + new Date().getMinutes() / 60
    return Array.from({ length: 10 }, (_, i) => {
      const h          = 8 + i
      const pct        = (h - 8) / 9
      const pattern    = Math.sin(pct * Math.PI) * 0.8 + 0.2
      const forecast   = Math.round(total * pattern * 0.16 / 50) * 50
      const noise      = seededRand(i * 7 + 3)
      const actual     = h <= nowH ? Math.round(forecast * (0.85 + noise * 0.3)) : undefined
      const backlog    = h <= nowH ? Math.round(Math.max(0, (0.55 - pct)) * total * 0.09) : undefined
      return { time: `${h}:00`, forecast, actual, backlog }
    })
  }, [todayForecast?.id])

  const nowHourLabel  = `${String(now.getHours()).padStart(2, '0')}:00`
  const nowTimeLabel  = `Τώρα ${timeStr}`
  const nextStr       = `${String(Math.floor(nextUpdate / 60)).padStart(2, '0')}:${String(nextUpdate % 60).padStart(2, '0')}`
  const pendingTotal  = (latestOps?.pending_picking ?? 0) + (latestOps?.pending_packing ?? 0) + (latestOps?.pending_sorting ?? 0)
  const coveragePct   = required > 0 ? Math.min(100, Math.round(working / required * 100)) : 0

  async function handleApply(s: typeof suggestions[0]) {
    if (applied.includes(s.employee.id)) return
    try {
      await applyRealloc.mutateAsync({ employee_id: s.employee.id, from_role: s.from_role, to_role: s.to_role })
      setApplied(prev => [...prev, s.employee.id])
      toast.success(`${s.employee.full_name.split(' ')[0]} → ${ROLE_CONFIG[s.to_role].label}`)
    } catch {
      toast.error('Αποτυχία')
    }
  }

  // ── Shared styles ──────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: 'white', borderRadius: 14, border: '0.5px solid #e8e8e8', overflow: 'hidden',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f4f4ef', fontFamily: 'Inter, sans-serif' }}>

      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '0.5px solid #e5e5e5', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>👋</span>
          <div>
            <span style={{ fontSize: 15, fontWeight: 500, color: '#1a1a1a' }}>Καλημέρα!</span>
            <span style={{ fontSize: 13, color: '#9ca3af', marginLeft: 8 }}>Σήμερα είναι {dayStr}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <button style={{ background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 20, padding: '7px 12px', cursor: 'pointer', fontSize: 16 }}>🔔</button>
            {unacked > 0 && (
              <div style={{ position: 'absolute', top: -3, right: -3, background: '#ef4444', color: 'white', fontSize: 9, fontWeight: 700, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {unacked}
              </div>
            )}
          </div>
          <button style={{ background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 20, padding: '7px 12px', cursor: 'pointer', fontSize: 16 }}>❓</button>
          <div style={{ border: '0.5px solid #e5e5e5', borderRadius: 20, padding: '7px 16px', fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>Τώρα</span>
            <span style={{ fontWeight: 500 }}>{timeStr}</span>
            <span style={{ fontSize: 10, color: '#9ca3af' }}>▾</span>
          </div>
          <Link to="/breaks" style={{ background: '#1a1a1a', color: 'white', padding: '8px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            + Νέο Διάλειμμα
          </Link>
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── KPI ROW ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 270px', gap: 12 }}>

          {/* Διαθέσιμοι */}
          <div style={card}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#06b6d4,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>👥</div>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Διαθέσιμοι</span>
              </div>
              <div style={{ fontSize: 34, fontWeight: 600, color: '#1a1a1a', lineHeight: 1, marginBottom: 3 }}>
                {working}
                <span style={{ fontSize: 17, color: '#9ca3af', fontWeight: 400 }}> / {total}</span>
              </div>
              <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden', margin: '10px 0 6px' }}>
                <div style={{ height: '100%', width: `${total > 0 ? Math.round(working / total * 100) : 0}%`, background: 'linear-gradient(90deg,#06b6d4,#0284c7)', borderRadius: 2, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{total > 0 ? Math.round(working / total * 100) : 0}% ενεργοί τώρα</div>
            </div>
          </div>

          {/* Απαιτούμενοι */}
          <div style={card}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#22c55e,#16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✅</div>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Απαιτούμενοι</span>
              </div>
              <div style={{ fontSize: 34, fontWeight: 600, color: '#1a1a1a', lineHeight: 1, marginBottom: 3 }}>
                {required}
                <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 400, marginLeft: 6 }}>(Τώρα)</span>
              </div>
              <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden', margin: '10px 0 6px' }}>
                <div style={{ height: '100%', width: `${coveragePct}%`, background: 'linear-gradient(90deg,#22c55e,#16a34a)', borderRadius: 2, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>Στόχος κάλυψης {coveragePct}%</div>
            </div>
          </div>

          {/* SLA Πρόβλεψη */}
          <div style={card}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🎯</div>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>SLA Πρόβλεψη</span>
              </div>
              <div style={{ fontSize: 34, fontWeight: 600, color: '#1a1a1a', lineHeight: 1, marginBottom: 3 }}>
                {slaScore}%
                <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600, marginLeft: 10 }}>↑ {slaTrend}%</span>
              </div>
              {/* mini sparkline */}
              <svg width="100%" height="30" style={{ display: 'block', marginTop: 10, marginBottom: 2 }}>
                {[0,1,2,3,4,5,6,7].map((i, _arr, src) => {
                  const total = 7
                  if (i >= total) return null
                  const x1 = (i / total) * 100
                  const x2 = ((i + 1) / total) * 100
                  const y1 = 26 - (Math.sin((i / total) * Math.PI * 1.2 + 0.3) * 16 + seededRand(i * 5) * 6)
                  const y2 = 26 - (Math.sin(((i + 1) / total) * Math.PI * 1.2 + 0.3) * 16 + seededRand((i + 1) * 5) * 6)
                  return <line key={i} x1={`${x1}%`} y1={y1} x2={`${x2}%`} y2={y2} stroke="#22c55e" strokeWidth={1.5} strokeLinecap="round" />
                })}
              </svg>
            </div>
          </div>

          {/* Κίνδυνος */}
          <div style={card}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>⚡</div>
                <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Κίνδυνος</span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: riskColor, lineHeight: 1, marginBottom: 14 }}>
                {riskLabel}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: riskColor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {bottleneck ? `Bottleneck: ${ROLE_CONFIG[bottleneck]?.label}` : 'Κανένα bottleneck'}
                </span>
              </div>
            </div>
          </div>

          {/* Breaks panel */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>☕ Διαλείμματα (Τώρα)</span>
              {activeBreaks.length > 0 && (
                <div style={{ background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>
                  {activeBreaks.length}
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activeBreaks.length === 0 ? (
                <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>Κανένα ενεργό διάλειμμα</div>
              ) : activeBreaks.slice(0, 6).map(b => {
                const roleCfg  = ROLE_CONFIG[b.employee?.primary_role ?? 'packer']
                const startStr = b.break_start ? new Date(b.break_start).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }) : null
                const endStr   = b.break_end   ? new Date(b.break_end).toLocaleTimeString('el-GR',   { hour: '2-digit', minute: '2-digit' }) : null
                const name     = b.employee?.full_name?.split(' ').slice(0, 2).map((p, i) => i === 1 ? p[0] + '.' : p).join(' ') ?? '?'
                return (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '0.5px solid #f9f9f7' }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: roleCfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'white', flexShrink: 0 }}>
                      {initials(b.employee?.full_name ?? '?')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>
                        {roleCfg.label}
                        {startStr && endStr ? ` · ${startStr} - ${endStr}` : ''}
                      </div>
                    </div>
                    {b.status === 'active' && b.break_end
                      ? <BreakTimer end={b.break_end} />
                      : <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Pending</span>
                    }
                  </div>
                )
              })}
            </div>
            <Link to="/breaks" style={{ display: 'block', textAlign: 'center', padding: '9px', fontSize: 11, color: '#6b7280', textDecoration: 'none', borderTop: '0.5px solid #f0f0f0', flexShrink: 0 }}>
              Δείτε όλα τα διαλείμματα →
            </Link>
          </div>
        </div>

        {/* ── LIVE ALLOCATION ───────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ padding: '12px 18px', borderBottom: '0.5px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Live Allocation</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '0.5px solid #bbf7d0', borderRadius: 20, padding: '3px 10px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 500 }}>Αυτόματος υπολογισμός</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                Επόμενη ενημέρωση σε{' '}
                <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#6b7280' }}>{nextStr}</span>
              </span>
              <button style={{ background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 8, padding: '5px 9px', cursor: 'pointer', fontSize: 15, color: '#6b7280', lineHeight: 1 }}>⟳</button>
            </div>
          </div>

          {roleGroups.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: '#9ca3af' }}>
              Δεν υπάρχουν ενεργοί εργαζόμενοι τώρα
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${roleGroups.length}, 1fr)` }}>
              {roleGroups.map(({ role, active, rc, cap }, idx) => {
                const cfg     = ROLE_CONFIG[role]
                const reqCount = rc?.required_count ?? active.length
                const pct     = Math.min(100, (active.length / Math.max(reqCount, 1)) * 100)
                const statusOk = active.length >= reqCount
                return (
                  <div key={role} style={{ padding: '14px 16px', borderRight: idx < roleGroups.length - 1 ? '0.5px solid #f5f5f0' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: cfg.color }}>{cfg.label}</span>
                      <span style={{ fontSize: 12, fontFamily: 'monospace', color: statusOk ? '#22c55e' : '#f97316', fontWeight: 700 }}>{active.length}/{reqCount}</span>
                    </div>
                    <div style={{ height: 3, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: statusOk ? cfg.color : '#f97316', borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                    {active.slice(0, 4).map(emp => {
                      const uph = emp.productivity?.find(p => p.role === role)?.units_per_hour ?? 110
                      return (
                        <div key={emp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: 'white', flexShrink: 0 }}>
                              {initials(emp.full_name)}
                            </div>
                            <span style={{ fontSize: 11, color: '#374151', maxWidth: 85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {emp.full_name.split(' ').slice(0, 2).map((p, i) => i === 1 ? p[0] + '.' : p).join(' ')}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: '#374151', fontFamily: 'monospace' }}>{uph} u/h</span>
                        </div>
                      )
                    })}
                    {active.length > 4 && <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>... +{active.length - 4}</div>}
                    <div style={{ borderTop: '0.5px solid #f5f5f0', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>Σύνολο</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>{cap.toLocaleString()} u/h</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── BOTTOM ROW ────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12 }}>

          {/* Workload & Forecast chart */}
          <div style={card}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Workload & Forecast</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#9ca3af' }}>
                {[
                  { color: '#3b82f6', dash: false, label: 'Actual' },
                  { color: '#93c5fd', dash: true,  label: 'Forecast' },
                  { color: '#f87171', dash: false, label: 'Backlog' },
                ].map(({ color, dash, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="18" height="4"><line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dash ? '4 3' : undefined} /></svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ padding: '12px 4px 0' }}>
              <ResponsiveContainer width="100%" height={175}>
                <LineChart data={chartData} margin={{ top: 4, right: 14, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '0.5px solid #e5e5e5', padding: '6px 10px' }}
                    labelStyle={{ fontWeight: 600, color: '#1a1a1a', marginBottom: 3 }}
                  />
                  <ReferenceLine
                    x={nowHourLabel}
                    stroke="#d1d5db"
                    strokeDasharray="3 3"
                    label={{ value: nowTimeLabel, position: 'top', fontSize: 9, fill: '#9ca3af' }}
                  />
                  <Line type="monotone" dataKey="forecast" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
                  <Line type="monotone" dataKey="actual"   stroke="#3b82f6" strokeWidth={2}   dot={false} connectNulls />
                  <Line type="monotone" dataKey="backlog"  stroke="#f87171" strokeWidth={2}   dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '0.5px solid #f0f0f0' }}>
              {[
                { label: 'Pending Orders', val: pendingTotal > 0 ? pendingTotal.toLocaleString() : '—', sub: null },
                { label: 'Backlog',        val: (latestOps?.remaining_due_date ?? 0) > 0 ? (latestOps!.remaining_due_date).toLocaleString() : '—', sub: '-8% vs χθες', red: true },
                { label: 'Same Day',       val: (todayForecast?.due_date_orders  ?? 0) > 0 ? todayForecast!.due_date_orders.toLocaleString()  : '—', sub: '96% πρόβλεψη' },
                { label: 'Next Day',       val: (todayForecast?.intraday_orders  ?? 0) > 0 ? todayForecast!.intraday_orders.toLocaleString()  : '—', sub: '98% πρόβλεψη' },
              ].map(({ label, val, sub, red }, i) => (
                <div key={label} style={{ padding: '10px 14px', borderRight: i < 3 ? '0.5px solid #f5f5f0' : 'none' }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', fontFamily: 'monospace' }}>{val}</div>
                  {sub && <div style={{ fontSize: 9, color: red ? '#ef4444' : '#22c55e', marginTop: 2 }}>{sub}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* AI Suggestions */}
          <div style={card}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#1a1a1a,#374151)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🤖</div>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500 }}>AI Προτάσεις</span>
                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 5 }}>(Τώρα)</span>
              </div>
              <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#9ca3af', padding: 0 }}>⤢</button>
            </div>

            {suggestions.length > 0 ? suggestions.slice(0, 3).map((s, i) => {
              const meta = [
                { icon: '↑', color: '#22c55e', bg: '#f0fdf4', title: 'Μετακίνηση προτείνεται', btnLabel: 'Εφάρμοσε' },
                { icon: '→', color: '#f59e0b', bg: '#fffbeb', title: `Ενίσχυση ${ROLE_CONFIG[s.to_role].label}`, btnLabel: 'Εφάρμοσε' },
                { icon: 'ℹ', color: '#3b82f6', bg: '#eff6ff', title: 'Πρόβλεψη φόρτου', btnLabel: 'Προβολή' },
              ][i] ?? { icon: '•', color: '#6b7280', bg: '#f9f9f7', title: 'Πρόταση', btnLabel: 'Εφάρμοσε' }
              const isApplied = applied.includes(s.employee.id)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderBottom: '0.5px solid #f9f9f7' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: meta.color, fontWeight: 700, flexShrink: 0 }}>
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 }}>{meta.title}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.4, marginBottom: 4 }}>
                      Μετακίνηση του <strong>{s.employee.full_name.split(' ')[0]}</strong> από {ROLE_CONFIG[s.from_role].label} → {ROLE_CONFIG[s.to_role].label}
                    </div>
                    <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>Κέρδος: +{s.capacity_gain} ο/h στο {ROLE_CONFIG[s.to_role].label}</div>
                  </div>
                  <button
                    onClick={() => !isApplied && handleApply(s)}
                    style={{ background: isApplied ? '#f0f0f0' : meta.color, color: isApplied ? '#9ca3af' : 'white', border: 'none', padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: isApplied ? 'default' : 'pointer', flexShrink: 0, transition: 'opacity 0.2s' }}
                  >
                    {isApplied ? '✓' : meta.btnLabel}
                  </button>
                </div>
              )
            }) : (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 14 }}>Ενημέρωσε το Ops Snapshot για AI προτάσεις</div>
                <Link to="/ops" style={{ background: '#1a1a1a', color: 'white', padding: '8px 18px', borderRadius: 20, fontSize: 12, fontWeight: 500, textDecoration: 'none', display: 'inline-block' }}>
                  Ops Snapshot →
                </Link>
              </div>
            )}

            <div style={{ padding: '10px 16px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: '0.5px solid #e5e5e5', borderRadius: 20, padding: '7px 14px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => { window.location.href = '/copilot' }}
              >
                <span style={{ fontSize: 14 }}>💬</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Ρώτα τον Copilot...</span>
              </div>
            </div>
          </div>

          {/* Top Performance */}
          <div style={card}>
            <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Top Απόδοση</span>
                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>(Σήμερα)</span>
              </div>
              <select style={{ fontSize: 11, border: '0.5px solid #e5e5e5', borderRadius: 8, padding: '4px 10px', color: '#6b7280', background: 'white', cursor: 'pointer', outline: 'none' }}>
                <option value="">Όλα τα πόστα</option>
                {Object.entries(ROLE_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </div>

            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 52px 80px', gap: 6, padding: '6px 16px 4px', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4 }}>
              <span>#</span>
              <span>Εργαζόμενος</span>
              <span>Ρόλος</span>
              <span style={{ textAlign: 'right' }}>Παραγωγικότητα</span>
            </div>

            {topPerformers.length > 0 ? topPerformers.map(({ emp, uph }, i) => {
              const cfg  = ROLE_CONFIG[emp.primary_role]
              const gain = uph > 100 ? Math.round((uph / 100 - 1) * 100) : null
              return (
                <div key={emp.id} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 52px 80px', gap: 6, alignItems: 'center', padding: '8px 16px', borderBottom: '0.5px solid #f9f9f7' }}>
                  <div style={{ textAlign: 'center' }}>
                    {i < 2
                      ? <span style={{ fontSize: 14 }}>⭐</span>
                      : <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>{i + 1}</span>
                    }
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {initials(emp.full_name)}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {emp.full_name.split(' ')[0]} {emp.full_name.split(' ')[1]?.[0] ?? ''}.
                    </span>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: cfg.bg, color: cfg.color, textAlign: 'center' }}>{cfg.short}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: '#1a1a1a' }}>{uph} u/h</div>
                    {gain !== null && gain > 0 && <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600 }}>+{gain}%</div>}
                  </div>
                </div>
              )
            }) : (
              <div style={{ padding: '28px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>Δεν υπάρχουν δεδομένα απόδοσης</div>
            )}
          </div>
        </div>
      </div>

      {/* ── FAB ────────────────────────────────────────────────────────────── */}
      <Link to="/copilot" style={{ position: 'fixed', bottom: 24, right: 24, background: 'linear-gradient(135deg,#1a1a1a,#374151)', color: 'white', padding: '11px 20px', borderRadius: 24, fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 24px rgba(0,0,0,0.22)', textDecoration: 'none', zIndex: 50 }}>
        💬 Ρωτήστε τον Copilot
      </Link>
    </div>
  )
}
