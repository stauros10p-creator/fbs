import { useState } from 'react'
import { useAppStore } from '@/store'
import { ROLE_CONFIG, SKILL_LABELS, STATUS_CONFIG } from '@/types'
import type { Employee } from '@/types'

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const SKILL_COLORS: Record<string, { color: string; bg: string }> = {
  '5': { color: '#16a34a', bg: '#f0fdf4' },
  '4': { color: '#3b82f6', bg: '#eff6ff' },
  '3': { color: '#6b7280', bg: '#f9fafb' },
  '2': { color: '#f59e0b', bg: '#fffbeb' },
  '1': { color: '#ef4444', bg: '#fef2f2' },
}

function SkillBar({ level }: { level: string }) {
  const n = parseInt(level)
  return (
    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: 2,
          background: i <= n ? SKILL_COLORS[level]?.color ?? '#6b7280' : '#f0f0f0',
        }}/>
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
    <div onClick={onClick} style={{
      background: 'white', borderRadius: 12, border: '0.5px solid #e5e5e5',
      padding: 14, cursor: 'pointer', transition: 'all 0.15s',
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
    onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e5e5')}
    >
      {/* Top */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: cfg.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 500, color: 'white',
          }}>{initials(emp.full_name)}</div>
          <div style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 10, height: 10, borderRadius: '50%',
            background: status.dot, border: '2px solid white',
          }}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {emp.full_name}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>{emp.employee_code}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: skill.color, fontWeight: 600, background: skill.bg, padding: '2px 7px', borderRadius: 10 }}>
            {skillLabel}
          </div>
        </div>
      </div>

      {/* Roles */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>
          {cfg.label} ★
        </span>
        {sec && (
          <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 20, background: sec.bg, color: sec.color }}>
            {sec.label}
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div style={{ background: '#f9f9f7', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Avg u/h</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#1a1a1a', fontFamily: 'monospace' }}>
            {uph ?? '—'}
          </div>
        </div>
        <div style={{ background: '#f9f9f7', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>Status</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: status.color }}>
            {status.label}
          </div>
        </div>
      </div>

      {/* Skill bar */}
      <div>
        <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 2 }}>Skill Level</div>
        <SkillBar level={emp.skill_level} />
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

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, fontFamily: 'Inter, sans-serif',
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: 16, width: 480,
        maxHeight: '85vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: cfg.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 500, color: 'white', flexShrink: 0,
            }}>{initials(emp.full_name)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>{emp.full_name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>{emp.employee_code}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.label} ★ Primary</span>
                {sec && <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: sec.bg, color: sec.color }}>{sec.label} Secondary</span>}
                {ter && <span style={{ fontSize: 10, fontWeight: 500, padding: '3px 9px', borderRadius: 20, background: ter.bg, color: ter.color }}>{ter.label} Tertiary</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', padding: '0 4px' }}>×</button>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0 }}>
          {[
            { label: 'Skill', val: skillLabel, color: skill.color },
            { label: 'Status', val: status.label, color: status.color },
            { label: 'Ρόλος', val: cfg.label, color: cfg.color },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ padding: '14px 16px', borderBottom: '0.5px solid #f0f0f0', borderRight: '0.5px solid #f0f0f0' }}>
              <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Productivity per role */}
        {emp.productivity && emp.productivity.length > 0 && (
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f0f0' }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Παραγωγικότητα ανά ρόλο</div>
            {emp.productivity.map(p => {
              const rc = ROLE_CONFIG[p.role]
              const maxUph = 250
              const pct = Math.min(100, (p.units_per_hour / maxUph) * 100)
              return (
                <div key={p.role} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: rc.color, fontWeight: 500 }}>{rc.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500, fontFamily: 'monospace' }}>{p.units_per_hour} u/h</span>
                  </div>
                  <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: rc.color, borderRadius: 2 }}/>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Skill bar */}
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #f0f0f0' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Skill Level</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SkillBar level={emp.skill_level} />
            <span style={{ fontSize: 12, fontWeight: 500, color: skill.color, flexShrink: 0 }}>
              {emp.skill_level}/5 — {skillLabel}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: '#d1d5db' }}>
            <span>Trainee</span><span>Junior</span><span>Standard</span><span>Senior</span><span>Expert</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '14px 20px', display: 'flex', gap: 8 }}>
          <button style={{ flex: 1, background: '#1a1a1a', color: 'white', border: 'none', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
            Επεξεργασία
          </button>
          <button style={{ flex: 1, border: '0.5px solid #e5e5e5', background: 'transparent', padding: '10px', borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>
            ☕ Διάλειμμα
          </button>
          <button style={{ flex: 1, border: '0.5px solid #e5e5e5', background: 'transparent', padding: '10px', borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>
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
  const [selected, setSelected] = useState<Employee | null>(null)

  const filtered = employees.filter(emp => {
    const matchSearch = emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || emp.primary_role === roleFilter
    const matchStatus = statusFilter === 'all' || emp.current_status === statusFilter
    return matchSearch && matchRole && matchStatus
  })

  const total    = employees.length
  const working  = employees.filter(e => e.current_status === 'working').length
  const onBreak  = employees.filter(e => e.current_status === 'break').length
  const sick     = employees.filter(e => e.current_status === 'sick').length

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#f5f5f0', fontFamily:'Inter,sans-serif' }}>

      {/* Header */}
      <div style={{ background:'white', borderBottom:'0.5px solid #e5e5e5', padding:'16px 24px', flexShrink:0 }}>
        <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Ομάδα</div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:24, fontWeight:500 }}>Εργαζόμενοι</div>
          <button style={{ background:'#1a1a1a', color:'white', border:'none', padding:'8px 16px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer' }}>
            + Προσθήκη
          </button>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:20, marginTop:12 }}>
          {[
            { label:'Σύνολο', val:total, color:'#1a1a1a' },
            { label:'Working', val:working, color:'#22c55e' },
            { label:'Break', val:onBreak, color:'#f59e0b' },
            { label:'Sick', val:sick, color:'#ef4444' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:color }}/>
              <span style={{ fontSize:12, color:'#6b7280' }}>{label}:</span>
              <span style={{ fontSize:12, fontWeight:500, color }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ background:'white', borderBottom:'0.5px solid #e5e5e5', padding:'10px 24px', display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
        <div style={{ position:'relative', flex:1, maxWidth:300 }}>
          <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'#9ca3af' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Αναζήτηση ονόματος ή κωδικού..."
            style={{ width:'100%', border:'0.5px solid #e5e5e5', borderRadius:20, padding:'7px 12px 7px 34px', fontSize:12, outline:'none' }}
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ border:'0.5px solid #e5e5e5', borderRadius:20, padding:'7px 14px', fontSize:12, outline:'none', background:'white', cursor:'pointer' }}>
          <option value="all">Όλοι οι ρόλοι</option>
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ border:'0.5px solid #e5e5e5', borderRadius:20, padding:'7px 14px', fontSize:12, outline:'none', background:'white', cursor:'pointer' }}>
          <option value="all">Όλα τα status</option>
          <option value="working">Working</option>
          <option value="break">Break</option>
          <option value="sick">Sick</option>
          <option value="vacation">Vacation</option>
        </select>
        <span style={{ fontSize:12, color:'#9ca3af', marginLeft:'auto' }}>{filtered.length} εργαζόμενοι</span>
      </div>

      {/* Cards grid */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12 }}>
          {filtered.map(emp => (
            <EmployeeCard key={emp.id} emp={emp} onClick={() => setSelected(emp)} />
          ))}
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>
            Δεν βρέθηκαν εργαζόμενοι
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && <EmployeeModal emp={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
