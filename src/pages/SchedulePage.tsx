import { useState, useRef } from 'react'
import { useShifts } from '@/hooks'
import { ROLE_CONFIG } from '@/types'
import type { EmployeeRole } from '@/types'
import * as XLSX from 'xlsx'

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const DAY_LABELS = ['Κυρ','Δευ','Τρι','Τετ','Πεμ','Παρ','Σαβ']

export function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const { data: shifts = [], isLoading } = useShifts(selectedDate)
  const fileRef = useRef<HTMLInputElement>(null)

  // Build week days (Mon-Sun)
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

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()
    const data = [
      ['employee_code','shift_date','start_time','end_time','assigned_role'],
      ['ID43715','2026-06-02','06:00','14:00','operator'],
      ['ID44445','2026-06-02','07:00','15:00','picker'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Shifts')
    XLSX.writeFile(wb, 'shift_template.xlsx')
  }

  // Group shifts by role for summary
  const roleCounts: Record<string, number> = {}
  for (const s of shifts) {
    const r = s.assigned_role
    roleCounts[r] = (roleCounts[r] ?? 0) + 1
  }

  function calcHours(start: string, end: string) {
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60
    return (mins / 60).toFixed(1)
  }

  const inputStyle: React.CSSProperties = {
    border: '0.5px solid #e5e5e5', borderRadius: 8, padding: '7px 12px',
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
            <button onClick={downloadTemplate} style={{ border:'0.5px solid #e5e5e5', background:'white', padding:'8px 16px', borderRadius:20, fontSize:12, cursor:'pointer', color:'#1a1a1a', display:'flex', alignItems:'center', gap:6 }}>
              ⬇️ Template
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ background:'#1a1a1a', color:'white', border:'none', padding:'8px 18px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              ⬆️ Import Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} />
          </div>
        </div>

        {/* Week selector */}
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', gap:4, background:'#f9f9f7', borderRadius:12, padding:4, border:'0.5px solid #e5e5e5' }}>
            {weekDays.map((d, i) => {
              const iso = d.toISOString().split('T')[0]
              const isSelected = iso === selectedDate
              const isToday = iso === today
              return (
                <button key={i} onClick={() => setSelectedDate(iso)} style={{
                  padding:'6px 12px', borderRadius:8, border:'none', cursor:'pointer',
                  background: isSelected ? '#1a1a1a' : 'transparent',
                  transition:'all 0.1s',
                }}>
                  <div style={{ fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, color: isSelected ? '#9ca3af' : '#9ca3af', marginBottom:2 }}>
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
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ ...inputStyle, width:160 }} />
          {shifts.length > 0 && (
            <div style={{ fontSize:12, color:'#9ca3af', marginLeft:4 }}>
              {shifts.length} εργαζόμενοι
            </div>
          )}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

        {/* Role summary pills */}
        {shifts.length > 0 && (
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
            {Object.entries(roleCounts).map(([role, count]) => {
              const cfg = ROLE_CONFIG[role as EmployeeRole]
              if (!cfg) return null
              return (
                <div key={role} style={{ display:'flex', alignItems:'center', gap:6, background:cfg.bg, borderRadius:20, padding:'5px 12px' }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:cfg.color }} />
                  <span style={{ fontSize:11, fontWeight:500, color:cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize:11, fontWeight:600, color:cfg.color }}>{count}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Shifts */}
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
            {/* Table header */}
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 80px 120px', gap:0, background:'#f9f9f7', borderBottom:'0.5px solid #e5e5e5', padding:'10px 16px' }}>
              {['Εργαζόμενος','Κωδικός','Έναρξη','Λήξη','Ώρες','Ρόλος'].map(h => (
                <div key={h} style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, fontWeight:600 }}>{h}</div>
              ))}
            </div>

            {/* Rows - grouped by shift start */}
            {shifts
              .slice()
              .sort((a, b) => a.start_time.localeCompare(b.start_time))
              .map((shift, i) => {
                const cfg = ROLE_CONFIG[shift.assigned_role]
                const hours = calcHours(shift.start_time, shift.end_time)
                const name = shift.employee?.full_name ?? '—'
                const code = shift.employee?.employee_code ?? '—'

                return (
                  <div key={shift.id} style={{
                    display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 80px 120px',
                    gap:0, padding:'10px 16px', alignItems:'center',
                    borderBottom: i < shifts.length - 1 ? '0.5px solid #f9f9f7' : 'none',
                    transition:'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Name + avatar */}
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background: cfg?.color ?? '#9ca3af', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:500, color:'white', flexShrink:0 }}>
                        {initials(name)}
                      </div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {name}
                      </div>
                    </div>

                    <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{code}</div>
                    <div style={{ fontSize:12, fontWeight:500, color:'#1a1a1a', fontFamily:'monospace' }}>{shift.start_time}</div>
                    <div style={{ fontSize:12, fontWeight:500, color:'#1a1a1a', fontFamily:'monospace' }}>{shift.end_time}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{hours}h</div>

                    {/* Role badge */}
                    <div style={{ display:'flex' }}>
                      {cfg && (
                        <span style={{ fontSize:10, fontWeight:500, padding:'3px 10px', borderRadius:20, background:cfg.bg, color:cfg.color }}>
                          {cfg.label}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
