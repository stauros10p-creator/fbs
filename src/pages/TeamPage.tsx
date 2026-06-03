import { useState } from 'react'
import { useAppStore } from '@/store'
import { ROLE_CONFIG, SKILL_LABELS, STATUS_CONFIG } from '@/types'
import type { Employee } from '@/types'

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const SKILL_COLORS: Record<string, { color: string; bg: string; text: string }> = {
  '5': { color: '#22c55e', bg: '#f0fdf4', text: '#15803d' },
  '4': { color: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  '3': { color: '#9ca3af', bg: '#f9fafb', text: '#6b7280' },
  '2': { color: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
  '1': { color: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
}

function SkillDots({ level }: { level: string }) {
  const n = parseInt(level)
  const c = SKILL_COLORS[level] ?? SKILL_COLORS['3']
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: '50%',
          background: i <= n ? c.color : '#e5e7eb',
        }} />
      ))}
    </div>
  )
}

function EmployeeCard({ emp, onClick }: { emp: Employee; onClick: () => void }) {
  const cfg = ROLE_CONFIG[emp.primary_role]
  const sec = emp.secondary_role ? ROLE_CONFIG[emp.secondary_role] : null
  const skill = SKILL_COLORS[emp.skill_level] ?? SKILL_COLORS['3']
  const skillLabel = SKILL_LABELS[emp.skill_level as keyof typeof SKILL_LABELS]
  const status = STATUS_CONFIG[emp.current_status]
  const uph = emp.productivity?.find(p => p.role === emp.primary_role)?.units_per_hour

  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: 12,
        border: '0.5px solid #e5e5e5',
        padding: '16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#1a1a1a'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#e5e5e5'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: cfg.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 500, color: 'white',
          }}>{initials(emp.full_name)}</div>
          <div style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 11, height: 11, borderRadius: '50%',
            background: status.dot, border: '2px solid white',
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: '#1a1a1a',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            marginBottom: 1,
          }}>{emp.full_name}</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>{emp.employee_code}</div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 500,
          padding: '2px 8px', borderRadius: 20,
          background: skill.bg, color: skill.text,
          flexShrink: 0,
        }}>{skillLabel}</div>
      </div>

      {/* Roles */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{
          fontSize: 10, fontWeight: 500,
          padding: '3px 9px', borderRadius: 20,
          background: cfg.bg, color: cfg.color,
        }}>{cfg.label} ★</span>
        {sec && (
          <span style={{
            fontSize: 10, fontWeight: 500,
            padding: '3px 9px', borderRadius: 20,
            background: sec.bg, color: sec.color,
          }}>{sec.label}</span>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
        <div style={{ background: '#f9f9f7', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Avg u/h</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', fontFamily: 'monospace' }}>
            {uph ?? '—'}
          </div>
        </div>
        <div style={{ background: '#f9f9f7', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Status</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: status.color }}>{status.label}</div>
        </div>
      </div>

      {/* Skill dots */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>Skill level</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: skill.text }}>{emp.skill_level}/5</span>
        </div>
        <SkillDots level={emp.skill_level} />
      </div>
    </div>
  )
}

function EmployeeModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const cfg = ROLE_CONFIG[emp.primary_role]
  const sec = emp.secondary_role ? ROLE_CONFIG[emp.secondary_role] : null
  const ter = emp.tertiary_role ? ROLE_CONFIG[emp.tertiary_role] : null
  const skill = SKILL_COLORS[emp.skill_level] ?? SKILL_COLORS['3']
  const skillLabel = SKILL_LABELS[emp.skill_level as keyof typeof SKILL_LABELS]
  const status = STATUS_CONFIG[emp.current_status]
  const primaryUph = emp.productivity?.find(p => p.role === emp.primary_role)?.units_per_hour
  const maxUph = 250

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200, fontFamily: 'Inter, sans-serif',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white', borderRadius: 16,
          width: 480, maxHeight: '88vh', overflow: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          border: '0.5px solid #e5e5e5',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '0.5px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: cfg.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 500, color: 'white',
              }}>{initials(emp.full_name)}</div>
              <div style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 13, height: 13, borderRadius: '50%',
                background: status.dot, border: '2px solid white',
              }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 500, color: '#1a1a1a', marginBottom: 2 }}>{emp.full_name}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                {emp.employee_code} · {status.label}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
                  {cfg.label} ★ Primary
                </span>
                {sec && (
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: sec.bg, color: sec.color }}>
                    {sec.label} Secondary
                  </span>
                )}
                {ter && (
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: ter.bg, color: ter.color }}>
                    {ter.label} Tertiary
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', padding: '0 4px', lineHeight: 1 }}
            >×</button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)' }}>
          {[
            { label: 'Skill', val: skillLabel, color: skill.text },
            { label: 'Avg u/h', val: primaryUph ? `${primaryUph}` : '—', color: '#1a1a1a', mono: true },
            { label: 'Status', val: status.label, color: status.color },
          ].map(({ label, val, color, mono }, i) => (
            <div key={label} style={{
              padding: '14px 16px',
              borderBottom: '0.5px solid #f0f0f0',
              borderRight: i < 2 ? '0.5px solid #f0f0f0' : 'none',
            }}>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 15, fontWeight: 500, color, fontFamily: mono ? 'monospace' : 'inherit' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Productivity bars */}
        {emp.productivity && emp.productivity.length > 0 && (
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f0f0' }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
              Παραγωγικότητα ανά ρόλο
            </div>
            {emp.productivity.map(p => {
              const rc = ROLE_CONFIG[p.role]
              const pct = Math.min(100, Math.round((p.units_per_hour / maxUph) * 100))
              return (
                <div key={p.role} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: rc.color, fontWeight: 500 }}>{rc.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'monospace', color: '#1a1a1a' }}>
                      {p.units_per_hour} u/h
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: rc.color, borderRadius: 3 }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Skill level */}
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f0f0' }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Skill level — {emp.skill_level}/5 {skillLabel}
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                flex: 1, height: 6, borderRadius: 3,
                background: i <= parseInt(emp.skill_level) ? skill.color : '#e5e7eb',
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#d1d5db' }}>
            <span>Trainee</span><span>Junior</span><span>Standard</span><span>Senior</span><span>Expert</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '14px 20px', display: 'flex', gap: 8 }}>
          <button style={{
            flex: 1, background: '#1a1a1a', color: 'white',
            border: 'none', padding: '10px', borderRadius: 10,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            ✏️ Επεξεργασία
          </button>
          <button style={{
            flex: 1, border: '0.5px solid #e5e5e5', background: 'transparent',
            padding: '10px', borderRadius: 10, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            ☕ Διάλειμμα
          </button>
          <button style={{
            flex: 1, border: '0.5px solid #e5e5e5', background: 'transparent',
            padding: '10px', borderRadius: 10, fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            📊 Ιστορικό
          </button>
        </div>
      </div>
    </div>
  )
}

export function TeamPage() {
  const employees = useAppStore(s => s.employees)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [skillFilter, setSkillFilter] = useState('all')
  const [selected, setSelected] = useState<Employee | null>(null)

  const filtered = employees.filter(emp => {
    const matchSearch =
      emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || emp.primary_role === roleFilter
    const matchStatus = statusFilter === 'all' || emp.current_status === statusFilter
    const matchSkill = skillFilter === 'all' || emp.skill_level === skillFilter
    return matchSearch && matchRole && matchStatus && matchSkill
  })

  const total   = employees.length
  const working = employees.filter(e => e.current_status === 'working').length
  const onBreak = employees.filter(e => e.current_status === 'break').length
  const sick    = employees.filter(e => e.current_status === 'sick').length

  const inputStyle: React.CSSProperties = {
    border: '0.5px solid #e5e5e5', borderRadius: 20,
    padding: '7px 14px', fontSize: 12, outline: 'none',
    background: 'white', cursor: 'pointer', color: '#1a1a1a',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f5f5f0', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '0.5px solid #e5e5e5', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Ομάδα</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#1a1a1a' }}>Εργαζόμενοι</div>
          <button style={{
            background: '#1a1a1a', color: 'white', border: 'none',
            padding: '8px 18px', borderRadius: 20, fontSize: 12,
            fontWeight: 500, cursor: 'pointer',
          }}>+ Προσθήκη</button>
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
          {[
            { label: 'Σύνολο', val: total,   color: '#1a1a1a' },
            { label: 'Working', val: working, color: '#22c55e' },
            { label: 'Break',   val: onBreak, color: '#f59e0b' },
            { label: 'Sick',    val: sick,    color: '#ef4444' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: 12, color: '#6b7280' }}>{label}:</span>
              <span style={{ fontSize: 12, fontWeight: 500, color }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white', borderBottom: '0.5px solid #e5e5e5',
        padding: '10px 24px', display: 'flex', gap: 8,
        alignItems: 'center', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#9ca3af' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Αναζήτηση ονόματος ή κωδικού..."
            style={{ ...inputStyle, width: '100%', paddingLeft: 34 }}
          />
        </div>

        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={inputStyle}>
          <option value="all">Όλοι οι ρόλοι</option>
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inputStyle}>
          <option value="all">Όλα τα status</option>
          <option value="working">Working</option>
          <option value="break">Break</option>
          <option value="sick">Sick</option>
          <option value="vacation">Vacation</option>
          <option value="off">Off</option>
        </select>

        <select value={skillFilter} onChange={e => setSkillFilter(e.target.value)} style={inputStyle}>
          <option value="all">Όλα τα skill</option>
          <option value="5">Expert</option>
          <option value="4">Senior</option>
          <option value="3">Standard</option>
          <option value="2">Junior</option>
          <option value="1">Trainee</option>
        </select>

        <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
          {filtered.length} / {total} εργαζόμενοι
        </span>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 14 }}>
            Δεν βρέθηκαν εργαζόμενοι
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: 12,
          }}>
            {filtered.map(emp => (
              <EmployeeCard key={emp.id} emp={emp} onClick={() => setSelected(emp)} />
            ))}
          </div>
        )}
      </div>

      {selected && <EmployeeModal emp={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
