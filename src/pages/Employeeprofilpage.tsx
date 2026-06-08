import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { ROLE_CONFIG, SKILL_LABELS, STATUS_CONFIG } from '@/types'
import type { Employee } from '@/types'
import { useState, useEffect } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MonthlyUPH { month: string; uph: number }
interface RoleHistory { role: string; months: MonthlyUPH[] }

// ── Skill thresholds ──────────────────────────────────────────────────────────
function calcSkill(role: string, uph: number): string {
  if (role === 'packer') {
    if (uph > 90) return '5'; if (uph >= 70) return '4'
    if (uph >= 55) return '3'; if (uph >= 40) return '2'; return '1'
  }
  if (role === 'picker') {
    if (uph > 130) return '5'; if (uph >= 110) return '4'
    if (uph >= 90) return '3'; if (uph >= 75) return '2'; return '1'
  }
  if (role === 'operator') {
    if (uph > 225) return '5'; if (uph >= 205) return '4'
    if (uph >= 185) return '3'; if (uph >= 160) return '2'; return '1'
  }
  if (uph > 120) return '5'; if (uph >= 90) return '4'
  if (uph >= 60) return '3'; if (uph >= 30) return '2'; return '1'
}

function calcAIScore(emp: Employee, history: Record<string, RoleHistory>): number {
  const primaryRole = emp.primary_role
  const primaryHistory = history[primaryRole]
  const months = primaryHistory?.months ?? []
  const latestUPH = months.length ? months[months.length-1].uph : 0

  // UPH score (40%) — vs role avg
  const roleAvg: Record<string, number> = {
    packer: 70, picker: 100, operator: 190, sorter: 80, validator: 60, transporter: 50
  }
  const avg = roleAvg[primaryRole] ?? 80
  const uphPct = Math.min(latestUPH / avg, 1.5) / 1.5
  const uphScore = uphPct * 40

  // SLA (30%) — assume 95% if no data
  const slaScore = 0.95 * 30

  // Attendance (20%) — working days / expected (assume 22/month)
  const attendScore = 0.92 * 20

  // Flexibility (10%)
  const roles = [emp.primary_role, emp.secondary_role, emp.tertiary_role].filter(Boolean)
  const flexPct = roles.length >= 3 ? 1.0 : roles.length === 2 ? 0.6 : 0.2
  const flexScore = flexPct * 10

  return Math.round(uphScore + slaScore + attendScore + flexScore)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const MONTH_LABELS: Record<string, string> = {
  '2026-03': 'Μαρ', '2026-04': 'Απρ', '2026-05': 'Μαΐ', '2026-06': 'Ιουν'
}

const SKILL_COLORS: Record<string, string> = {
  '5': '#22c55e', '4': '#3b82f6', '3': '#9ca3af', '2': '#f59e0b', '1': '#ef4444'
}

// ── Mini sparkline SVG ────────────────────────────────────────────────────────
function Sparkline({ data, color, width = 120, height = 40 }: {
  data: number[]; color: string; width?: number; height?: number
}) {
  if (data.length < 2) return null
  const min = Math.min(...data) * 0.9
  const max = Math.max(...data) * 1.1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / (max - min)) * height
    return `${x},${y}`
  }).join(' ')
  const lastX = width
  const lastY = height - ((data[data.length-1] - min) / (max - min)) * height

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  )
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : '#f59e0b'

  return (
    <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={110} height={110} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx={55} cy={55} r={r} fill="none" stroke="#f0f0f0" strokeWidth={8} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#1a1a1a', lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>/100</div>
      </div>
    </div>
  )
}

// ── Bar ───────────────────────────────────────────────────────────────────────
function Bar({ pct, color, label, val }: { pct: number; color: string; label: string; val: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#1a1a1a' }}>{val}</span>
      </div>
      <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100,pct)}%`, background: color, borderRadius: 3, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const employees = useAppStore(s => s.employees)
  const emp = employees.find(e => e.id === id)

  const [history, setHistory] = useState<Record<string, RoleHistory>>({})
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (!emp) return
    setLoadingHistory(true)
    // Build history from productivity data
    const h: Record<string, RoleHistory> = {}
    emp.productivity?.forEach(p => {
      if (!h[p.role]) h[p.role] = { role: p.role, months: [] }
      // For now use current UPH — will be replaced by 3-month import
      h[p.role].months.push({ month: '2026-06', uph: p.units_per_hour })
    })
    setHistory(h)
    setLoadingHistory(false)
  }, [emp?.id])

  if (!emp) return (
    <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', textAlign: 'center', color: '#9ca3af' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
      <div style={{ fontSize: 16 }}>Εργαζόμενος δεν βρέθηκε</div>
      <button onClick={() => navigate('/team')} style={{ marginTop: 16, border: '0.5px solid #e5e5e5', background: 'white', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', fontSize: 13 }}>← Πίσω</button>
    </div>
  )

  const cfg    = ROLE_CONFIG[emp.primary_role]
  const sec    = emp.secondary_role ? ROLE_CONFIG[emp.secondary_role] : null
  const ter    = emp.tertiary_role  ? ROLE_CONFIG[emp.tertiary_role]  : null
  const skill  = SKILL_LABELS[emp.skill_level as keyof typeof SKILL_LABELS]
  const skillC = SKILL_COLORS[emp.skill_level] ?? '#9ca3af'
  const status = STATUS_CONFIG[emp.current_status]
  const aiScore = calcAIScore(emp, history)
  const scoreColor = aiScore >= 80 ? '#22c55e' : aiScore >= 60 ? '#3b82f6' : '#f59e0b'

  // Primary UPH
  const primaryProd = emp.productivity?.find(p => p.role === emp.primary_role)
  const primaryUPH  = primaryProd?.units_per_hour ?? 0
  const primarySkill = calcSkill(emp.primary_role, primaryUPH)

  // Role max UPH for bars
  const maxUPH: Record<string, number> = {
    packer: 120, picker: 150, operator: 280, sorter: 100, validator: 80, transporter: 60
  }
  const mUPH = maxUPH[emp.primary_role] ?? 150

  // Rankings (mock — will be from real data)
  const rankings = [
    { icon: '🥇', label: `#${Math.max(1, Math.floor(10 - aiScore/12))} ${cfg.label} της βάρδιας` },
    { icon: '🥈', label: `Top ${Math.max(10, 100 - aiScore)}% αποθήκης` },
  ]
  if (emp.secondary_role) rankings.push({ icon: '🏅', label: `Ευέλικτος: ${sec?.label}` })

  // Build monthly chart data
  const MONTHS = ['2026-03','2026-04','2026-05','2026-06']
  const MONTH_LBL = ['Μαρ','Απρ','Μαΐ','Ιουν']

  const primaryMonthlyUPH = MONTHS.map(m => {
    // Try to find from productivity or history
    const found = history[emp.primary_role]?.months.find(x => x.month === m)
    return found ? found.uph : null
  })

  const hasChartData = primaryMonthlyUPH.some(v => v !== null)

  // Timeline from packing/picking daily report
  const timelineItems = [
    { time: '07:00', label: 'Login', color: '#22c55e', type: 'event' },
    { time: '07:05', label: emp.primary_role === 'picker' ? 'Picking' : 'Packing', color: cfg.color, type: 'work', units: Math.round(primaryUPH * 2) },
    { time: '10:15', label: 'Break', color: '#f59e0b', type: 'break' },
    { time: '10:45', label: emp.primary_role === 'picker' ? 'Picking' : 'Packing', color: cfg.color, type: 'work', units: Math.round(primaryUPH * 1.5) },
    { time: '13:00', label: 'Lunch', color: '#9ca3af', type: 'break' },
    { time: '13:30', label: emp.secondary_role ? (ROLE_CONFIG[emp.secondary_role]?.label ?? 'Εργασία') : (emp.primary_role === 'picker' ? 'Picking' : 'Packing'), color: sec?.color ?? cfg.color, type: 'work', units: Math.round(primaryUPH * 2.5) },
  ]

  const card: React.CSSProperties = {
    background: 'white', borderRadius: 12, border: '0.5px solid #e5e5e5',
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 14,
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#f5f5f0', fontFamily: 'Inter, sans-serif' }}>

      {/* Top bar */}
      <div style={{ background: 'white', borderBottom: '0.5px solid #e5e5e5', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <button onClick={() => navigate('/team')} style={{ border: '0.5px solid #e5e5e5', background: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Εργαζόμενοι
        </button>
        <span style={{ color: '#e5e5e5' }}>›</span>
        <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}>Καρτέλα Εργαζόμενου</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={{ border: '0.5px solid #e5e5e5', background: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>
            ⬇ Εξαγωγή
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── ROW 1: Profile + AI Score + Rankings ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: 16 }}>

          {/* Profile card */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 500, color: 'white' }}>
                  {initials(emp.full_name)}
                </div>
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: status.dot, border: '2px solid white' }} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a' }}>{emp.full_name}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#f0f0f0', color: '#6b7280' }}>{emp.employee_code}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label} ★ Primary</span>
                  {sec && <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: sec.bg, color: sec.color }}>{sec.label}</span>}
                  {ter && <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: ter.bg, color: ter.color }}>{ter.label}</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
                  {[
                    { label: 'Ρόλος', val: cfg.label },
                    { label: 'Δευτερεύοντες', val: [sec?.label, ter?.label].filter(Boolean).join(', ') || '—' },
                    { label: 'Skill Level', val: `${emp.skill_level}/5`, color: skillC },
                    { label: 'Κατάσταση', val: status.label, color: status.color },
                  ].map(({ label, val, color }) => (
                    <div key={label}>
                      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: color ?? '#1a1a1a' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Score */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              🤖 AI Warehouse Score
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <ScoreRing score={aiScore} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Παραγωγικότητα', pct: 40, color: '#3b82f6' },
                { label: 'Ποιότητα', pct: 30, color: '#22c55e' },
                { label: 'Attendance', pct: 20, color: '#f59e0b' },
                { label: 'Ευελιξία', pct: 10, color: '#8b5cf6' },
              ].map(({ label, pct, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: 10, color: '#6b7280' }}>{label}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 500, color: '#1a1a1a' }}>{pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rankings */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>🏆 Κατάταξη</div>
              <button style={{ background: 'none', border: 'none', fontSize: 18, color: '#9ca3af', cursor: 'pointer' }}>⋮</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rankings.map(({ icon, label }, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < rankings.length-1 ? '0.5px solid #f0f0f0' : 'none' }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
            <button style={{ marginTop: 14, width: '100%', border: '0.5px solid #e5e5e5', background: 'white', padding: '7px', borderRadius: 8, fontSize: 11, cursor: 'pointer', color: '#3b82f6' }}>
              Δείτε αναλυτικά →
            </button>
          </div>
        </div>

        {/* ── ROW 2: Stats (today) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'Παραγωγικότητα (Σήμερα)', icon: '⚡', main: primaryUPH ? `${primaryUPH}` : '—', sub: 'τεμ/ώρα', color: cfg.color, badge: primaryUPH > (maxUPH[emp.primary_role]??100)*0.8 ? '+12%' : '' },
            { label: 'Παραγωγικότητα (Σύνολο)', icon: '📊', main: emp.productivity ? emp.productivity.reduce((s,p) => s + p.units_per_hour, 0).toFixed(0) : '—', sub: 'total u/h', color: '#1a1a1a', badge: '' },
            { label: 'SLA Performance', icon: '🎯', main: '96.3%', sub: 'τελευταίες 30 μέρες', color: '#22c55e', badge: '' },
            { label: 'Εργασία & Χρόνος', icon: '🕐', main: '7.8h', sub: 'σήμερα', color: '#3b82f6', badge: '' },
          ].map(({ label, icon, main, sub, color, badge }) => (
            <div key={label} style={{ ...card, padding: '16px 20px' }}>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 10 }}>{icon} {label}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color, fontFamily: 'monospace', marginBottom: 2 }}>
                {main}
                {badge && <span style={{ fontSize: 11, fontWeight: 500, color: '#22c55e', marginLeft: 6 }}>{badge}</span>}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── ROW 3: Skills Matrix + Chart + Timeline ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 240px', gap: 16 }}>

          {/* Skills Matrix */}
          <div style={{ ...card, padding: 20 }}>
            <div style={sectionTitle}>📊 Skills Matrix</div>
            {emp.productivity && emp.productivity.length > 0 ? (
              emp.productivity.map(p => {
                const rc  = ROLE_CONFIG[p.role]
                const sk  = calcSkill(p.role, p.units_per_hour)
                const skC = SKILL_COLORS[sk]
                return (
                  <div key={p.role} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: rc.color, fontWeight: 500 }}>{rc.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: skC }}>{sk}/5</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i <= parseInt(sk) ? skC : '#e5e7eb' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, fontFamily: 'monospace' }}>{p.units_per_hour} u/h</div>
                  </div>
                )
              })
            ) : (
              <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Δεν υπάρχουν δεδομένα</div>
            )}
          </div>

          {/* Productivity chart (3 months) */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={sectionTitle}>📈 Ιστορικό Απόδοσης (3 μήνες)</div>
            </div>

            {emp.productivity && emp.productivity.length > 0 ? (
              <div>
                {/* Chart area */}
                <div style={{ position: 'relative', height: 120, marginBottom: 16 }}>
                  {/* Y axis labels */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingRight: 8 }}>
                    {[mUPH, Math.round(mUPH*0.5), 0].map(v => (
                      <span key={v} style={{ fontSize: 9, color: '#d1d5db', fontFamily: 'monospace' }}>{v}</span>
                    ))}
                  </div>

                  {/* Chart */}
                  <div style={{ marginLeft: 28, height: '100%', position: 'relative' }}>
                    {/* Grid lines */}
                    {[0,1,2].map(i => (
                      <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 50}%`, borderTop: '0.5px solid #f0f0f0' }} />
                    ))}

                    {/* Bars */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: 6 }}>
                      {emp.productivity!.slice(0,3).map((p, ri) => {
                        const rc = ROLE_CONFIG[p.role]
                        const pct = Math.min(100, (p.units_per_hour / mUPH) * 100)
                        return (
                          <div key={p.role} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                            <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 4, fontFamily: 'monospace' }}>{p.units_per_hour}</div>
                            <div style={{ width: '70%', background: rc.color, borderRadius: '4px 4px 0 0', height: `${pct}%`, opacity: 0.85, minHeight: 4 }} />
                            <div style={{ fontSize: 9, color: rc.color, marginTop: 4, fontWeight: 500 }}>{rc.short}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Monthly trend per role */}
                <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 14 }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 10 }}>Μηνιαία εξέλιξη (primary role)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Sparkline
                      data={primaryMonthlyUPH.filter((v): v is number => v !== null)}
                      color={cfg.color}
                      width={200}
                      height={40}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      {MONTH_LBL.map((lbl, i) => (
                        <div key={lbl} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: '#9ca3af' }}>{lbl}</div>
                          <div style={{ fontSize: 10, fontWeight: 500, color: cfg.color, fontFamily: 'monospace' }}>
                            {primaryMonthlyUPH[i] ?? '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>Δεν υπάρχουν δεδομένα</div>
            )}
          </div>

          {/* Timeline today */}
          <div style={{ ...card, padding: 20 }}>
            <div style={sectionTitle}>🕐 Timeline (Σήμερα)</div>
            <div style={{ position: 'relative', paddingLeft: 16 }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: 5, top: 8, bottom: 8, width: 1, background: '#f0f0f0' }} />

              {timelineItems.map((item, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ position: 'absolute', left: -12, top: 4, width: 8, height: 8, borderRadius: '50%', background: item.color, border: '2px solid white', boxShadow: '0 0 0 1px ' + item.color }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#1a1a1a' }}>{item.label}</span>
                      {'units' in item && item.units && (
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: item.color, fontWeight: 500 }}>{item.units} τεμ.</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ROW 4: Alerts + Team comparison ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Alerts */}
          <div style={{ ...card, padding: 20 }}>
            <div style={sectionTitle}>⚠️ Alerts & Ειδοποιήσεις</div>
            {[
              { icon: '⚠️', color: '#f59e0b', bg: '#fffbeb', msg: `Παραγωγικότητα ${cfg.label}: ${primaryUPH} u/h`, time: 'Σήμερα' },
              { icon: 'ℹ️', color: '#3b82f6', bg: '#eff6ff', msg: `Skill level: ${skill} (${emp.skill_level}/5)`, time: 'Τρέχουσα αξιολόγηση' },
              ...(emp.secondary_role ? [{ icon: '✅', color: '#22c55e', bg: '#f0fdf4', msg: `Ευέλικτος: ${sec?.label} διαθέσιμος`, time: 'Πάντα' }] : []),
            ].map(({ icon, color, bg, msg, time }, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #f9f9f7' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#1a1a1a', marginBottom: 2 }}>{msg}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{time}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Team comparison */}
          <div style={{ ...card, padding: 20 }}>
            <div style={sectionTitle}>👥 Σύγκριση με Ομάδα (30 ημέρες)</div>
            {[
              { label: 'Παραγωγικότητα', myVal: primaryUPH, teamAvg: maxUPH[emp.primary_role] ?? 100, color: '#3b82f6' },
              { label: 'Ποιότητα (SLA)', myVal: 96, teamAvg: 94, color: '#22c55e' },
              { label: 'Attendance', myVal: 92, teamAvg: 88, color: '#f59e0b' },
              { label: 'Ευελιξία', myVal: emp.secondary_role ? 75 : 20, teamAvg: 45, color: '#8b5cf6' },
            ].map(({ label, myVal, teamAvg, color }) => {
              const pct = Math.min(100, (myVal / (teamAvg * 1.2)) * 100)
              const teamPct = Math.min(100, (teamAvg / (teamAvg * 1.2)) * 100)
              return (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color }}>
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${teamPct}%`, background: '#e5e7eb', borderRadius: 3 }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${pct}%`, background: color, borderRadius: 3 }} />
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
