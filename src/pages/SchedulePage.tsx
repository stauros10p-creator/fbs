import { useState, useRef } from 'react'
import { useShifts } from '@/hooks'
import { useAppStore } from '@/store'
import { ROLE_CONFIG } from '@/types'
import type { EmployeeRole } from '@/types'
import * as XLSX from 'xlsx'

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const DAY_LABELS = ['Κυρ','Δευ','Τρι','Τετ','Πεμ','Παρ','Σαβ']

const SHIFT_OPTIONS = [
  { label: 'Όλες', value: 'all' },
  { label: '06:00-14:00', value: '06' },
  { label: '07:00-15:00', value: '07' },
  { label: '09:00-17:00', value: '09' },
  { label: '13:00-21:00', value: '13' },
  { label: '18:00-02:00', value: '18' },
]

const ABSENCE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  sick:     { label: 'Αρρωστία',  color: '#ef4444', bg: '#fef2f2', icon: '🤒' },
  vacation: { label: 'Άδεια',     color: '#3b82f6', bg: '#eff6ff', icon: '🏖️' },
  off:      { label: 'Day Off',   color: '#9ca3af', bg: '#f9fafb', icon: '🔴' },
}

export function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [roleFilter, setRoleFilter] = useState('all')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [showAbsences, setShowAbsences] = useState(true)
  const { data: shifts = [], isLoading } = useShifts(selectedDate)
  const employees = useAppStore(s => s.employees)
  const fileRef = useRef<HTMLInputElement>(null)

  // Build week days Mon-Sun
  const baseDate = new Date(selectedDate)
  const dow = baseDate.getDay()
  const monday = new Date(baseDate)
  monday.setDate(baseDate.getDate() - (dow === 0 ? 6 : dow - 1))
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
  const today = new Date().toISOString().split('T')[0]

  // Employees absent today (sick/vacation/off) = in employees list but NOT in shifts
  const shiftEmployeeIds = new Set(shifts.map(s => s.employee_id))
  const absentEmployees = employees.filter(e =>
    ['sick', 'vacation', 'off'].includes(e.current_status) ||
    (!shiftEmployeeIds.has(e.id) && e.current_status !== 'working' && e.current_status !== 'redeployed')
  )

  // Filter shifts
  const filtered = shifts.filter(s => {
    const matchRole = roleFilter === 'all' || s.assigned_role === roleFilter
    const matchShift = shiftFilter === 'all' || s.start_time.startsWith(shiftFilter)
    return matchRole && matchShift
  }).sort((a, b) => a.start_time.localeCompare(b.start_time))

  // Role counts
  const roleCounts: Record<string, number> = {}
  for (const s of shifts) roleCounts[s.assigned_role] = (roleCounts[s.assigned_role] ?? 0) + 1

  // Shift counts
  const shiftCounts: Record<string, number> = {}
  for (const s of shifts) {
    const h = s.start_time.slice(0, 2)
    shiftCounts[h] = (shiftCounts[h] ?? 0) + 1
  }

  function calcHours(start: string, end: string) {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60
    return (mins / 60).toFixed(1)
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([
      ['employee_code','shift_date','start_time','end_time','assigned_role'],
      ['ID43715','2026-06-02','06:00','14:00','operator'],
    ])
    XLSX.utils.book_append_sheet(wb, ws, 'Shifts')
    XLSX.writeFile(wb, 'shift_template.xlsx')
  }

  const selectStyle: React.CSSProperties = {
    border: '0.5px solid #e5e5e5', borderRadius: 20, padding: '6px 14px',
    fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif',
    color: '#1a1a1a', background: 'white', cursor: 'pointer',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#f5f5f0', fontFamily:'Inter,sans-serif' }}>

      {/* Header */}
      <div style={{ background:'white', borderBottom:'0.5px solid #e5e5e5', padding:'16px 24px', flexShrink:0 }}>
        <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Ομάδα</div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:24, fontWeight:500, color:'#1a1a1a' }}>Schedule</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={downloadTemplate} style={{ border:'0.5px solid #e5e5e5', background:'white', padding:'8px 16px', borderRadius:20, fontSize:12, cursor:'pointer', color:'#1a1a1a' }}>
              ⬇️ Template
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ background:'#1a1a1a', color:'white', border:'none', padding:'8px 18px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer' }}>
              ⬆️ Import Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} />
          </div>
        </div>

        {/* Week selector */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:3, background:'#f9f9f7', borderRadius:12, padding:4, border:'0.5px solid #e5e5e5' }}>
            {weekDays.map((d, i) => {
              const iso = d.toISOString().split('T')[0]
              const isSelected = iso === selectedDate
              const isToday = iso === today
              return (
                <button key={i} onClick={() => setSelectedDate(iso)} style={{
                  padding:'6px 11px', borderRadius:8, border:'none', cursor:'pointer',
                  background: isSelected ? '#1a1a1a' : 'transparent', transition:'all 0.1s',
                }}>
                  <div style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:0.4, color: isSelected ? '#9ca3af' : '#9ca3af', marginBottom:2 }}>
                    {DAY_LABELS[d.getDay()]}
                  </div>
                  <div style={{ fontSize:13, fontWeight:500, color: isSelected ? 'white' : isToday ? '#3b82f6' : '#1a1a1a', fontFamily:'monospace' }}>
                    {d.getDate()}
                  </div>
                  {isToday && !isSelected && <div style={{ width:4, height:4, borderRadius:'50%', background:'#3b82f6', margin:'2px auto 0' }} />}
                </button>
              )
            })}
          </div>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            style={{ border:'0.5px solid #e5e5e5', borderRadius:8, padding:'6px 12px', fontSize:12, outline:'none', color:'#1a1a1a', background:'white', cursor:'pointer', width:150 }}
          />
          {shifts.length > 0 && <span style={{ fontSize:12, color:'#9ca3af' }}>{shifts.length} εργαζόμενοι</span>}
        </div>
      </div>

      {/* Filters bar */}
      <div style={{ background:'white', borderBottom:'0.5px solid #e5e5e5', padding:'10px 24px', display:'flex', gap:8, alignItems:'center', flexShrink:0, flexWrap:'wrap' }}>
        {/* Role filter */}
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={selectStyle}>
          <option value="all">Όλοι οι ρόλοι</option>
          {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label} ({roleCounts[key] ?? 0})</option>
          ))}
        </select>

        {/* Shift filter */}
        <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)} style={selectStyle}>
          {SHIFT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}{opt.value !== 'all' ? ` (${shiftCounts[opt.value] ?? 0})` : ''}
            </option>
          ))}
        </select>

        {/* Absence toggle */}
        <button
          onClick={() => setShowAbsences(!showAbsences)}
          style={{
            border: `0.5px solid ${showAbsences ? '#ef4444' : '#e5e5e5'}`,
            borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
            background: showAbsences ? '#fef2f2' : 'white',
            color: showAbsences ? '#ef4444' : '#9ca3af',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          🔴 Απόντες {absentEmployees.length > 0 ? `(${absentEmployees.length})` : ''}
        </button>

        <span style={{ fontSize:12, color:'#9ca3af', marginLeft:'auto' }}>
          {filtered.length} / {shifts.length} βάρδιες
        </span>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Role summary pills */}
        {shifts.length > 0 && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {Object.entries(roleCounts).map(([role, count]) => {
              const cfg = ROLE_CONFIG[role as EmployeeRole]
              if (!cfg) return null
              const isActive = roleFilter === role
              return (
                <div key={role} onClick={() => setRoleFilter(isActive ? 'all' : role)}
                  style={{ display:'flex', alignItems:'center', gap:6, background: isActive ? cfg.color : cfg.bg, borderRadius:20, padding:'5px 12px', cursor:'pointer', transition:'all 0.15s' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: isActive ? 'white' : cfg.color }} />
                  <span style={{ fontSize:11, fontWeight:500, color: isActive ? 'white' : cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize:11, fontWeight:700, color: isActive ? 'white' : cfg.color }}>{count}</span>
                </div>
              )
            })}

            {/* Shift time pills */}
            <div style={{ width:'0.5px', background:'#e5e5e5', margin:'0 4px' }} />
            {Object.entries(shiftCounts).sort().map(([h, count]) => {
              const isActive = shiftFilter === h
              return (
                <div key={h} onClick={() => setShiftFilter(isActive ? 'all' : h)}
                  style={{ display:'flex', alignItems:'center', gap:5, background: isActive ? '#1a1a1a' : '#f9f9f7', borderRadius:20, padding:'5px 12px', cursor:'pointer', border:`0.5px solid ${isActive ? '#1a1a1a' : '#e5e5e5'}`, transition:'all 0.15s' }}>
                  <span style={{ fontSize:11, fontWeight:500, color: isActive ? 'white' : '#6b7280' }}>{h}:00</span>
                  <span style={{ fontSize:11, fontWeight:700, color: isActive ? 'white' : '#1a1a1a' }}>{count}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Absences panel */}
        {showAbsences && absentEmployees.length > 0 && (
          <div style={{ background:'white', borderRadius:12, border:'0.5px solid #fecaca', overflow:'hidden' }}>
            <div style={{ background:'#fef2f2', padding:'10px 16px', borderBottom:'0.5px solid #fecaca', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:12, fontWeight:500, color:'#ef4444' }}>🔴 Απόντες σήμερα</div>
              <div style={{ fontSize:11, color:'#9ca3af' }}>{absentEmployees.length} άτομα</div>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:1, background:'#f9f9f7' }}>
              {absentEmployees.map((emp, i) => {
                const status = emp.current_status as keyof typeof ABSENCE_CONFIG
                const ac = ABSENCE_CONFIG[status] ?? ABSENCE_CONFIG.off
                const cfg = ROLE_CONFIG[emp.primary_role]
                return (
                  <div key={emp.id} style={{ background:'white', padding:'10px 14px', display:'flex', alignItems:'center', gap:10, minWidth:220 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color:'#9ca3af', flexShrink:0 }}>
                      {initials(emp.full_name)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {emp.full_name.split(' ').slice(0,2).join(' ')}
                      </div>
                      <div style={{ fontSize:10, color:cfg?.color ?? '#9ca3af' }}>{cfg?.label ?? emp.primary_role}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:20, background:ac.bg, color:ac.color, flexShrink:0 }}>
                      {ac.icon} {ac.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Shifts table */}
        {isLoading ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:'#9ca3af', fontSize:14 }}>Φόρτωση...</div>
        ) : shifts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px 0' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📅</div>
            <div style={{ fontSize:14, fontWeight:500, color:'#1a1a1a', marginBottom:6 }}>Δεν υπάρχουν βάρδιες</div>
            <div style={{ fontSize:12, color:'#9ca3af' }}>Κάνε import Excel ή επίλεξε άλλη μέρα</div>
          </div>
        ) : (
          <div style={{ background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', overflow:'hidden' }}>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 70px 130px', padding:'10px 16px', background:'#f9f9f7', borderBottom:'0.5px solid #e5e5e5' }}>
              {['Εργαζόμενος','Κωδικός','Έναρξη','Λήξη','Ώρες','Ρόλος'].map(h => (
                <div key={h} style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, fontWeight:600 }}>{h}</div>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#9ca3af', fontSize:13 }}>Δεν βρέθηκαν βάρδιες με αυτά τα φίλτρα</div>
            ) : (
              filtered.map((shift, i) => {
                const cfg = ROLE_CONFIG[shift.assigned_role]
                const hours = calcHours(shift.start_time, shift.end_time)
                const name = shift.employee?.full_name ?? '—'
                const code = shift.employee?.employee_code ?? '—'
                const shiftHour = shift.start_time.slice(0,2)

                // Shift color coding
                const shiftColors: Record<string, string> = { '06':'#f59e0b', '07':'#3b82f6', '09':'#8b5cf6', '13':'#22c55e', '18':'#f97316' }
                const shiftDot = shiftColors[shiftHour] ?? '#9ca3af'

                return (
                  <div key={shift.id} style={{
                    display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 70px 130px',
                    padding:'10px 16px', alignItems:'center',
                    borderBottom: i < filtered.length - 1 ? '0.5px solid #f9f9f7' : 'none',
                    transition:'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:cfg?.color ?? '#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color:'white', flexShrink:0 }}>
                        {initials(name)}
                      </div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {name}
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{code}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:shiftDot, flexShrink:0 }} />
                      <span style={{ fontSize:12, fontWeight:500, color:'#1a1a1a', fontFamily:'monospace' }}>{shift.start_time}</span>
                    </div>
                    <div style={{ fontSize:12, fontWeight:500, color:'#1a1a1a', fontFamily:'monospace' }}>{shift.end_time}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{hours}h</div>
                    {cfg && (
                      <span style={{ fontSize:10, fontWeight:500, padding:'3px 10px', borderRadius:20, background:cfg.bg, color:cfg.color, display:'inline-block' }}>
                        {cfg.label}
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
