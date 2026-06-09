import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import { ROLE_CONFIG, SKILL_LABELS, STATUS_CONFIG } from '@/types'
import type { Employee } from '@/types'

// ── Skill thresholds ──────────────────────────────────────────────────────────
function calcSkill(role: string, uph: number): string {
  if (role === 'packer') {
    if (uph > 90) return '5'; if (uph >= 70) return '4'
    if (uph >= 55) return '3'; if (uph >= 40) return '2'; return '1'
  }
  if (role === 'picker') {
    if (uph > 85) return '5'; if (uph >= 75) return '4'
    if (uph >= 65) return '3'; if (uph >= 55) return '2'; return '1'
  }
  if (role === 'operator') {
    if (uph > 225) return '5'; if (uph >= 205) return '4'
    if (uph >= 185) return '3'; if (uph >= 160) return '2'; return '1'
  }
  if (uph > 120) return '5'; if (uph >= 90) return '4'
  if (uph >= 60) return '3'; if (uph >= 30) return '2'; return '1'
}

// ── Team averages (from 3-month data) ────────────────────────────────────────
const TEAM_AVG: Record<string, number> = {
  operator: 150.8,
  packer:   61.0,
  picker:   71.9,
  sorter:   80,
  validator:60,
  transporter: 50,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const SKILL_COLORS: Record<string, string> = {
  '5': '#22c55e', '4': '#3b82f6', '3': '#9ca3af', '2': '#f59e0b', '1': '#ef4444'
}

const MAX_UPH: Record<string, number> = {
  operator: 280, packer: 130, picker: 130, sorter: 100, validator: 80, transporter: 60
}

const MONTHS = ['2026-03','2026-04','2026-05','2026-06']
const MONTH_LBL = ['Μαρ','Απρ','Μαΐ','Ιουν']

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const r = 44, circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#3b82f6' : '#f59e0b'
  return (
    <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={110} height={110} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <circle cx={55} cy={55} r={r} fill="none" stroke="#f0f0f0" strokeWidth={8} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#1a1a1a', lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>/100</div>
      </div>
    </div>
  )
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color, width=160, height=36 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 10, color: '#d1d5db' }}>—</span></div>
  const min = Math.min(...data) * 0.85
  const max = Math.max(...data) * 1.15
  const pts = data.map((v, i) => `${(i/(data.length-1))*width},${height - ((v-min)/(max-min))*height}`).join(' ')
  const lx = width, ly = height - ((data[data.length-1]-min)/(max-min))*height
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={3} fill={color} />
    </svg>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const employees = useAppStore(s => s.employees)
  const emp = employees.find(e => e.id === id)

  if (!emp) return (
    <div style={{ padding: 60, fontFamily: 'Inter,sans-serif', textAlign: 'center', color: '#9ca3af' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
      <div style={{ fontSize: 16, marginBottom: 16 }}>Εργαζόμενος δεν βρέθηκε</div>
      <button onClick={() => navigate('/team')} style={{ border: '0.5px solid #e5e5e5', background: 'white', padding: '8px 20px', borderRadius: 20, cursor: 'pointer', fontSize: 13 }}>← Πίσω</button>
    </div>
  )

  const cfg    = ROLE_CONFIG[emp.primary_role]
  const sec    = emp.secondary_role ? ROLE_CONFIG[emp.secondary_role] : null
  const ter    = emp.tertiary_role  ? ROLE_CONFIG[emp.tertiary_role]  : null
  const skillLabel = SKILL_LABELS[emp.skill_level as keyof typeof SKILL_LABELS]
  const skillC = SKILL_COLORS[emp.skill_level] ?? '#9ca3af'
  const status = STATUS_CONFIG[emp.current_status]

  // Primary productivity
  const primaryProd = emp.productivity?.find(p => p.role === emp.primary_role)
  const primaryUPH  = primaryProd?.units_per_hour ?? 0
  const primarySkill = calcSkill(emp.primary_role, primaryUPH)
  const teamAvg = TEAM_AVG[emp.primary_role] ?? 80

  // AI Score
  const uphPct   = Math.min(primaryUPH / (teamAvg * 1.5), 1)
  const flexRoles = [emp.primary_role, emp.secondary_role, emp.tertiary_role].filter(Boolean)
  const flexPct  = flexRoles.length >= 3 ? 1.0 : flexRoles.length === 2 ? 0.6 : 0.2
  const aiScore  = Math.round(uphPct * 40 + 0.95 * 30 + 0.92 * 20 + flexPct * 10)
  const scoreColor = aiScore >= 80 ? '#22c55e' : aiScore >= 60 ? '#3b82f6' : '#f59e0b'

  // Avg hours/day from productivity (use primary role UPH as proxy)
  const avgHrs = primaryUPH > 0 ? Math.round((primaryUPH / (teamAvg)) * 6 * 10) / 10 : 0

  // Monthly data for sparkline — from productivity records grouped by month
  // (Currently we only have current UPH — monthly will come from Supabase import)
  const monthlyUPH = MONTHS.map(m => {
    // Find any productivity record for this month
    const found = emp.productivity?.find(p => p.role === emp.primary_role)
    return found ? found.units_per_hour : null
  })
  // Only show last month for now
  const sparkData = monthlyUPH.filter((v): v is number => v !== null)

  // Rankings
  const allEmps = employees.filter(e => e.primary_role === emp.primary_role)
  const sorted = [...allEmps].sort((a,b) => {
    const ua = a.productivity?.find(p=>p.role===a.primary_role)?.units_per_hour ?? 0
    const ub = b.productivity?.find(p=>p.role===b.primary_role)?.units_per_hour ?? 0
    return ub - ua
  })
  const rank = sorted.findIndex(e => e.id === emp.id) + 1
  const topPct = Math.round((rank / allEmps.length) * 100)

  const card: React.CSSProperties = { background: 'white', borderRadius: 12, border: '0.5px solid #e5e5e5' }
  const secTitle: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#f5f5f0', fontFamily: 'Inter,sans-serif' }}>

      {/* Topbar */}
      <div style={{ background: 'white', borderBottom: '0.5px solid #e5e5e5', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/team')} style={{ border: '0.5px solid #e5e5e5', background: 'white', padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>← Εργαζόμενοι</button>
        <span style={{ color: '#e5e5e5' }}>›</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>Καρτέλα Εργαζόμενου</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#9ca3af', padding: '6px 0' }}>Δεδομένα: Μαρ–Ιουν 2026</span>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── ROW 1: Profile + AI Score + Rankings ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: 16 }}>

          {/* Profile */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 500, color: 'white' }}>{initials(emp.full_name)}</div>
                <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: status.dot, border: '2px solid white' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a' }}>{emp.full_name}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: '#f0f0f0', color: '#6b7280' }}>{emp.employee_code}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label} ★ Primary</span>
                  {sec && <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: sec.bg, color: sec.color }}>{sec.label}</span>}
                  {ter && <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 10px', borderRadius: 20, background: ter.bg, color: ter.color }}>{ter.label}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
                  {[
                    { label: 'Ρόλος', val: cfg.label },
                    { label: 'Δευτερεύοντες', val: [sec?.label,ter?.label].filter(Boolean).join(', ')||'—' },
                    { label: 'Skill Level', val: `${primarySkill}/5`, color: SKILL_COLORS[primarySkill] },
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
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', marginBottom: 14 }}>🤖 AI Warehouse Score</div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <ScoreRing score={aiScore} />
            </div>
            {[
              { label: 'Παραγωγικότητα', pct: 40, color: '#3b82f6' },
              { label: 'Ποιότητα',       pct: 30, color: '#22c55e' },
              { label: 'Attendance',     pct: 20, color: '#f59e0b' },
              { label: 'Ευελιξία',       pct: 10, color: '#8b5cf6' },
            ].map(({ label, pct, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 10, color: '#6b7280' }}>{label}</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 500, color: '#1a1a1a' }}>{pct}%</span>
              </div>
            ))}
          </div>

          {/* Rankings */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', marginBottom: 14 }}>🏆 Κατάταξη</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉', label: `#${rank} ${cfg.label} της ομάδας` },
                { icon: '📊', label: `Top ${topPct}% αποθήκης` },
                ...(emp.secondary_role ? [{ icon: '🏅', label: `Ευέλικτος: ${sec?.label}` }] : []),
              ].map(({ icon, label }, i, arr) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < arr.length-1 ? '0.5px solid #f0f0f0' : 'none' }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ROW 2: Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            {
              label: 'Μ.Ο. Παραγωγικότητας (3μήνες)',
              icon: '⚡',
              main: primaryUPH ? `${primaryUPH}` : '—',
              sub: `τεμ/ώρα | ομάδα: ${teamAvg}`,
              color: primaryUPH >= teamAvg ? '#22c55e' : '#f59e0b',
              badge: primaryUPH >= teamAvg ? `+${Math.round(((primaryUPH-teamAvg)/teamAvg)*100)}%` : `${Math.round(((primaryUPH-teamAvg)/teamAvg)*100)}%`
            },
            {
              label: 'Μέσες Ώρες / Ημέρα',
              icon: '🕐',
              main: primaryProd ? `${avgHrs}h` : '—',
              sub: `${primaryProd?.units_per_hour ? Math.round(primaryProd.units_per_hour * avgHrs) : '—'} τεμ/ημέρα`,
              color: '#3b82f6',
              badge: ''
            },
            {
              label: 'Ρόλοι',
              icon: '🎭',
              main: `${flexRoles.length}`,
              sub: flexRoles.map(r => ROLE_CONFIG[r as keyof typeof ROLE_CONFIG]?.label ?? r).join(', '),
              color: '#8b5cf6',
              badge: ''
            },
          ].map(({ label, icon, main, sub, color, badge }) => (
            <div key={label} style={{ ...card, padding: '16px 20px' }}>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 10 }}>{icon} {label}</div>
              <div style={{ fontSize: 28, fontWeight: 500, color, fontFamily: 'monospace', marginBottom: 2 }}>
                {main}
                {badge && <span style={{ fontSize: 11, fontWeight: 500, color: parseFloat(badge) >= 0 ? '#22c55e' : '#ef4444', marginLeft: 8 }}>{badge}</span>}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── ROW 3: Skills + Chart + Comparison ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: 16 }}>

          {/* Skills Matrix */}
          <div style={{ ...card, padding: 20 }}>
            <div style={secTitle}>📊 Skills Matrix</div>
            {emp.productivity && emp.productivity.length > 0 ? (
              emp.productivity.map(p => {
                const rc  = ROLE_CONFIG[p.role]
                const sk  = calcSkill(p.role, p.units_per_hour)
                const skC = SKILL_COLORS[sk]
                const isPrimary = p.role === emp.primary_role
                return (
                  <div key={p.role} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 12, color: rc.color, fontWeight: 500 }}>{rc.label}</span>
                        {isPrimary && <span style={{ fontSize: 8, background: '#f0f0f0', color: '#9ca3af', padding: '1px 5px', borderRadius: 8 }}>Primary</span>}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: skC }}>{sk}/5</span>
                    </div>
                    <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
                      {[1,2,3,4,5].map(i => (
                        <div key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: i <= parseInt(sk) ? skC : '#e5e7eb' }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{p.units_per_hour} u/h</div>
                  </div>
                )
              })
            ) : (
              <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Δεν υπάρχουν δεδομένα</div>
            )}
          </div>

          {/* Productivity Chart */}
          <div style={{ ...card, padding: 20 }}>
            <div style={secTitle}>📈 Ιστορικό Απόδοσης (3 μήνες)</div>

            {emp.productivity && emp.productivity.length > 0 ? (
              <div>
                {/* Bar chart per role */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120, marginBottom: 16 }}>
                  {emp.productivity.slice(0,4).map(p => {
                    const rc  = ROLE_CONFIG[p.role]
                    const pct = Math.min(100, (p.units_per_hour / (MAX_UPH[p.role] ?? 150)) * 100)
                    const ta  = TEAM_AVG[p.role] ?? 80
                    const taPct = Math.min(100, (ta / (MAX_UPH[p.role] ?? 150)) * 100)
                    return (
                      <div key={p.role} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 4, fontFamily: 'monospace' }}>{p.units_per_hour}</div>
                        <div style={{ width: '100%', position: 'relative', height: `${pct}%`, minHeight: 8 }}>
                          {/* Team avg line */}
                          <div style={{ position: 'absolute', bottom: `${(taPct/pct)*100}%`, left: 0, right: 0, borderTop: '1.5px dashed #e5e7eb', zIndex: 2 }} />
                          <div style={{ width: '100%', height: '100%', background: rc.color, borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                        </div>
                        <div style={{ fontSize: 9, color: rc.color, marginTop: 5, fontWeight: 600 }}>{rc.short}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <div style={{ width: 16, height: 1, borderTop: '1.5px dashed #e5e7eb' }} />
                  Μέσος όρος ομάδας
                </div>

                {/* Monthly sparkline */}
                <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 14 }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 10 }}>Μηνιαία εξέλιξη — {cfg.label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Sparkline data={sparkData.length >= 2 ? sparkData : [teamAvg, primaryUPH]} color={cfg.color} />
                    <div style={{ display: 'flex', gap: 12 }}>
                      {MONTH_LBL.map((lbl, i) => (
                        <div key={lbl} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 9, color: '#9ca3af' }}>{lbl}</div>
                          <div style={{ fontSize: 10, fontWeight: 500, color: i === MONTH_LBL.length-1 ? cfg.color : '#d1d5db', fontFamily: 'monospace' }}>
                            {i === MONTH_LBL.length-1 ? primaryUPH : '—'}
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

          {/* Team Comparison */}
          <div style={{ ...card, padding: 20 }}>
            <div style={secTitle}>👥 Σύγκριση με Ομάδα</div>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 14 }}>Μ.Ο. 3 μηνών — {cfg.label}</div>

            {/* UPH comparison */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>{emp.full_name.split(' ')[0]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, fontFamily: 'monospace' }}>{primaryUPH} u/h</span>
              </div>
              <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${Math.min(100,(primaryUPH/(MAX_UPH[emp.primary_role]??150))*100)}%`, background: cfg.color, borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>Μ.Ο. Ομάδας</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', fontFamily: 'monospace' }}>{teamAvg} u/h</span>
              </div>
              <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100,(teamAvg/(MAX_UPH[emp.primary_role]??150))*100)}%`, background: '#e5e7eb', borderRadius: 4 }} />
              </div>
            </div>

            {/* Difference */}
            <div style={{ background: primaryUPH >= teamAvg ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: primaryUPH >= teamAvg ? '#22c55e' : '#ef4444', fontFamily: 'monospace' }}>
                {primaryUPH >= teamAvg ? '+' : ''}{(primaryUPH - teamAvg).toFixed(1)}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                {primaryUPH >= teamAvg ? 'πάνω' : 'κάτω'} από τον μέσο όρο
              </div>
            </div>

            {/* Other roles comparison */}
            {emp.productivity && emp.productivity.filter(p => p.role !== emp.primary_role).length > 0 && (
              <div style={{ marginTop: 14, borderTop: '0.5px solid #f0f0f0', paddingTop: 14 }}>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 10 }}>Δευτερεύοντες ρόλοι</div>
                {emp.productivity.filter(p => p.role !== emp.primary_role).map(p => {
                  const rc = ROLE_CONFIG[p.role]
                  const ta = TEAM_AVG[p.role] ?? 80
                  const diff = p.units_per_hour - ta
                  return (
                    <div key={p.role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: rc.color, fontWeight: 500 }}>{rc.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#1a1a1a' }}>{p.units_per_hour}</span>
                        <span style={{ fontSize: 10, color: diff >= 0 ? '#22c55e' : '#ef4444', fontWeight: 500 }}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 4: Alerts ── */}
        <div style={{ ...card, padding: 20 }}>
          <div style={secTitle}>⚠️ Αξιολόγηση & Παρατηρήσεις</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10 }}>
            {[
              primaryUPH >= teamAvg * 1.2 && {
                icon: '✅', bg: '#f0fdf4', color: '#16a34a',
                msg: `Παραγωγικότητα ${Math.round(((primaryUPH-teamAvg)/teamAvg)*100)}% πάνω από τη μέση`,
                sub: `${primaryUPH} vs ${teamAvg} u/h ομάδας`
              },
              primaryUPH < teamAvg * 0.8 && {
                icon: '⚠️', bg: '#fffbeb', color: '#b45309',
                msg: `Παραγωγικότητα χαμηλότερη από τη μέση`,
                sub: `${primaryUPH} vs ${teamAvg} u/h ομάδας`
              },
              parseInt(primarySkill) >= 4 && {
                icon: '⭐', bg: '#eff6ff', color: '#1d4ed8',
                msg: `${SKILL_LABELS[primarySkill as keyof typeof SKILL_LABELS]} στο ${cfg.label}`,
                sub: `Skill ${primarySkill}/5 βάσει μέσου UPH`
              },
              emp.secondary_role && {
                icon: '🔄', bg: '#f5f3ff', color: '#7c3aed',
                msg: `Ευέλικτος: ${[sec?.label,ter?.label].filter(Boolean).join(' + ')}`,
                sub: 'Μπορεί να καλύψει πολλαπλές θέσεις'
              },
              !emp.secondary_role && {
                icon: 'ℹ️', bg: '#f9f9f7', color: '#6b7280',
                msg: 'Δεν έχει secondary role',
                sub: 'Εξέτασε εκπαίδευση σε δεύτερο ρόλο'
              },
            ].filter(Boolean).map((item, i) => item && (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: item.bg, borderRadius: 10 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: item.color, marginBottom: 2 }}>{item.msg}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
