import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '@/store'
import { useBreakRequests, useApplyReallocation } from '@/hooks'
import { ROLE_CONFIG } from '@/types'
import toast from 'react-hot-toast'

const f = {
  page: { display:'flex', flexDirection:'column' as const, height:'100%', overflow:'hidden', background:'#f5f5f0', fontFamily:'Inter,sans-serif' } as React.CSSProperties,
  topbar: { background:'white', borderBottom:'0.5px solid #e5e5e5', padding:'11px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 } as React.CSSProperties,
  content: { flex:1, overflowY:'auto' as const, padding:'16px 20px', display:'flex', flexDirection:'column' as const, gap:14 },
  card: { background:'white', borderRadius:12, border:'0.5px solid #e5e5e5' } as React.CSSProperties,
  btn: (dark?: boolean) => ({ background: dark?'#1a1a1a':'transparent', color: dark?'white':'#1a1a1a', border:'0.5px solid '+(dark?'#1a1a1a':'#d1d5db'), padding:'7px 14px', borderRadius:20, fontSize:12, cursor:'pointer', fontFamily:'Inter,sans-serif', fontWeight:500 } as React.CSSProperties),
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function BreakTimer({ end }: { end: string }) {
  const [s, setS] = useState(Math.max(0, Math.floor((new Date(end).getTime() - Date.now()) / 1000)))
  useEffect(() => { const t = setInterval(() => setS(p => Math.max(0, p - 1)), 1000); return () => clearInterval(t) }, [])
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:500, color:'#ef4444' }}>{m}:{sec}</span>
}

export function DashboardPage() {
  const employees    = useAppStore(s => s.employees)
  const engineResult = useAppStore(s => s.engineResult)
  const latestOps    = useAppStore(s => s.latestOpsSnapshot)
  const alerts       = useAppStore(s => s.alerts)
  const { data: breaks = [] } = useBreakRequests()
  const applyRealloc = useApplyReallocation()
  const [applied, setApplied] = useState<string[]>([])
  const [now, setNow] = useState(new Date())

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

  const working  = employees.filter(e => e.current_status === 'working' || e.current_status === 'redeployed').length
  const total    = employees.filter(e => e.current_status !== 'off').length
  const unacked  = alerts.filter(a => !a.acknowledged_at).length
  const risk     = engineResult?.overall_risk ?? 0
  const riskColor = risk < 0.3 ? '#22c55e' : risk < 0.6 ? '#f59e0b' : '#ef4444'
  const riskLabel = risk < 0.3 ? 'Χαμηλός' : risk < 0.6 ? 'Μέτριος' : 'Υψηλός'

  const DAYS = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο']
  const MONTHS = ['Ιαν','Φεβ','Μαρ','Απρ','Μαΐ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']
  const timeStr = now.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
  const dayStr  = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`

  // Active breaks
  const activeBreaks = breaks.filter(b => b.status === 'active' || b.status === 'pending').slice(0, 4)

  // Role groups
  const SHOW = ['picker', 'packer', 'sorter', 'operator'] as const
  const roleGroups = SHOW.map(role => {
    const active = employees.filter(e => (e.current_status === 'working' || e.current_status === 'redeployed') && e.primary_role === role)
    const rc = engineResult?.role_capacity.find(r => r.role === role)
    const cap = Math.round(active.reduce((sum, e) => {
      const prod = e.productivity?.find(p => p.role === role)
      return sum + (prod?.units_per_hour ?? 110)
    }, 0))
    return { role, active, rc, cap }
  }).filter(g => g.active.length > 0)

  const totalCap = roleGroups.reduce((s, g) => s + g.cap, 0)
  const suggestions = engineResult?.suggestions ?? []

  // Top performers
  const topPerformers = employees
    .filter(e => e.current_status === 'working' && e.productivity?.length)
    .map(e => ({ emp: e, uph: e.productivity?.find(p => p.role === e.primary_role)?.units_per_hour ?? 0 }))
    .filter(x => x.uph > 0).sort((a, b) => b.uph - a.uph).slice(0, 5)

  async function handleApply(s: typeof suggestions[0]) {
    if (applied.includes(s.employee.id)) return
    try {
      await applyRealloc.mutateAsync({ employee_id: s.employee.id, from_role: s.from_role, to_role: s.to_role })
      setApplied(prev => [...prev, s.employee.id])
      toast.success(`${s.employee.full_name.split(' ')[0]} → ${ROLE_CONFIG[s.to_role].label}`)
    } catch { toast.error('Αποτυχία') }
  }

  return (
    <div style={f.page}>
      {/* TOPBAR */}
      <div style={f.topbar}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:16 }}>👋</span>
          <div>
            <span style={{ fontSize:14, fontWeight:500 }}>Καλημέρα, Σταύρο</span>
            <span style={{ fontSize:13, color:'#9ca3af', marginLeft:8 }}>{dayStr}</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {unacked > 0 && (
            <div style={{ position:'relative' }}>
              <button style={{ ...f.btn(), padding:'7px 10px' }}>🔔</button>
              <div style={{ position:'absolute', top:-3, right:-3, background:'#ef4444', color:'white', fontSize:9, fontWeight:700, width:16, height:16, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>{unacked}</div>
            </div>
          )}
          <div style={{ border:'0.5px solid #e5e5e5', borderRadius:20, padding:'6px 14px', fontSize:13, color:'#6b7280' }}>
            {timeStr}
          </div>
          <Link to="/ops" style={{ ...f.btn(true), textDecoration:'none', display:'inline-block' }}>
            + Νέο Snapshot
          </Link>
        </div>
      </div>

      <div style={f.content}>
        {/* KPI ROW */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 220px', gap:10 }}>

          {/* Dark card - Διαθέσιμοι */}
          <div style={{ background:'#1a1a1a', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
              👥 Διαθέσιμοι
            </div>
            <div style={{ fontSize:28, fontWeight:500, color:'white', lineHeight:1, marginBottom:4 }}>
              {working} <span style={{ fontSize:15, color:'rgba(255,255,255,0.4)', fontWeight:400 }}>/ {total}</span>
            </div>
            <div style={{ height:3, background:'rgba(255,255,255,0.1)', borderRadius:2, overflow:'hidden', margin:'6px 0 4px' }}>
              <div style={{ height:'100%', width:`${total>0?Math.round(working/total*100):0}%`, background:'white', borderRadius:2 }}/>
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>{total>0?Math.round(working/total*100):0}% ενεργοί</div>
          </div>

          {/* Due Date */}
          <div style={{ ...f.card, padding:'14px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>📦 Due Date</div>
            <div style={{ fontSize:26, fontWeight:500, color:'#1a1a1a', lineHeight:1, marginBottom:4 }}>
              {latestOps?.remaining_due_date?.toLocaleString() ?? '—'}
            </div>
            <div style={{ height:3, background:'#f0f0f0', borderRadius:2, overflow:'hidden', margin:'6px 0 4px' }}>
              <div style={{ height:'100%', width:'65%', background:'#3b82f6', borderRadius:2 }}/>
            </div>
            <div style={{ fontSize:10, color:'#9ca3af' }}>Cutoff 19:00</div>
          </div>

          {/* Intraday */}
          <div style={{ ...f.card, padding:'14px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>🌙 Intraday</div>
            <div style={{ fontSize:26, fontWeight:500, color:'#1a1a1a', lineHeight:1, marginBottom:4 }}>
              {latestOps?.remaining_intraday?.toLocaleString() ?? '—'}
            </div>
            <div style={{ height:3, background:'#f0f0f0', borderRadius:2, overflow:'hidden', margin:'6px 0 4px' }}>
              <div style={{ height:'100%', width:'28%', background:'#8b5cf6', borderRadius:2 }}/>
            </div>
            <div style={{ fontSize:10, color:'#9ca3af' }}>Cutoff 01:30</div>
          </div>

          {/* Capacity */}
          <div style={{ ...f.card, padding:'14px 16px' }}>
            <div style={{ fontSize:10, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>⚡ Capacity/hr</div>
            <div style={{ fontSize:26, fontWeight:500, color:'#1a1a1a', lineHeight:1, marginBottom:4 }}>
              {totalCap.toLocaleString()}
            </div>
            <div style={{ height:3, background:'#f0f0f0', borderRadius:2, overflow:'hidden', margin:'6px 0 4px' }}>
              <div style={{ height:'100%', width:'80%', background:'#22c55e', borderRadius:2 }}/>
            </div>
            <div style={{ fontSize:10, color:'#22c55e' }}>u/h συνολικά</div>
          </div>

          {/* Breaks */}
          <div style={{ ...f.card, overflow:'hidden' }}>
            <div style={{ padding:'10px 12px 8px', borderBottom:'0.5px solid #f5f5f0', display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:500 }}>
              ☕ Διαλείμματα
              {activeBreaks.length > 0 && <span style={{ background:'#1a1a1a', color:'white', fontSize:9, fontWeight:700, width:18, height:18, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', marginLeft:'auto' }}>{activeBreaks.length}</span>}
            </div>
            {activeBreaks.length === 0 ? (
              <div style={{ padding:'16px 12px', fontSize:11, color:'#9ca3af', textAlign:'center' }}>Κανένα ενεργό</div>
            ) : activeBreaks.map(b => (
              <div key={b.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderBottom:'0.5px solid #f9f9f7' }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background: ROLE_CONFIG[b.employee?.primary_role??'packer'].color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:500, color:'white', flexShrink:0 }}>
                  {initials(b.employee?.full_name ?? '?')}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {b.employee?.full_name?.split(' ')[0]} {b.employee?.full_name?.split(' ')[1]?.[0]}.
                  </div>
                  <div style={{ fontSize:9, color:'#9ca3af', textTransform:'capitalize' }}>{ROLE_CONFIG[b.employee?.primary_role??'packer'].label}</div>
                </div>
                {b.status === 'active' && b.break_end
                  ? <BreakTimer end={b.break_end} />
                  : <span style={{ fontSize:10, color:'#f59e0b', fontWeight:500 }}>Pending</span>
                }
              </div>
            ))}
            <Link to="/breaks" style={{ display:'block', textAlign:'center', padding:'7px', fontSize:10, color:'#9ca3af', textDecoration:'none', borderTop:'0.5px solid #f5f5f0' }}>
              Όλα τα διαλείμματα →
            </Link>
          </div>
        </div>

        {/* LIVE ALLOCATION */}
        <div style={f.card}>
          <div style={{ padding:'12px 16px', borderBottom:'0.5px solid #f5f5f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:13, fontWeight:500 }}>Live Allocation</span>
              <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#22c55e' }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block' }} className="pulse"/>
                Live
              </span>
            </div>
            <Link to="/planning" style={{ ...f.btn(), textDecoration:'none', fontSize:11 }}>Πλάνο Βάρδιας →</Link>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${roleGroups.length},1fr)` }}>
            {roleGroups.map(({ role, active, rc, cap }) => {
              const cfg = ROLE_CONFIG[role]
              const pct = rc ? Math.min(100, (active.length / Math.max(rc.required_count, 1)) * 100) : 100
              return (
                <div key={role} style={{ padding:'12px 14px', borderRight:'0.5px solid #f5f5f0' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:cfg.color }}>{cfg.label}</span>
                    <span style={{ fontSize:11, color:'#9ca3af', fontFamily:'monospace' }}>{active.length}/{rc?.required_count ?? active.length}</span>
                  </div>
                  <div style={{ height:2, background:'#f5f5f0', borderRadius:1, overflow:'hidden', marginBottom:10 }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:cfg.color, borderRadius:1 }}/>
                  </div>
                  {active.slice(0, 4).map(emp => {
                    const uph = emp.productivity?.find(p => p.role === role)?.units_per_hour ?? 110
                    return (
                      <div key={emp.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ width:22, height:22, borderRadius:'50%', background:cfg.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:500, color:'white', flexShrink:0 }}>
                            {initials(emp.full_name)}
                          </div>
                          <span style={{ fontSize:11, color:'#374151', maxWidth:85, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {emp.full_name.split(' ').slice(0,2).join(' ')}
                          </span>
                        </div>
                        <span style={{ fontSize:11, fontWeight:500, color:cfg.color, fontFamily:'monospace' }}>{uph}</span>
                      </div>
                    )
                  })}
                  {active.length > 4 && <div style={{ fontSize:10, color:'#9ca3af', marginBottom:6 }}>+{active.length-4} ακόμα</div>}
                  <div style={{ borderTop:'0.5px solid #f5f5f0', paddingTop:8, marginTop:4, display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.3, fontWeight:600 }}>Σύνολο</span>
                    <span style={{ fontSize:12, fontWeight:500, color:cfg.color, fontFamily:'monospace' }}>{cap.toLocaleString()} u/h</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* BOTTOM */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>

          {/* WORKLOAD */}
          <div style={f.card}>
            <div style={{ padding:'12px 14px', borderBottom:'0.5px solid #f5f5f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:500 }}>Workload</span>
              <Link to="/ops" style={{ fontSize:11, color:'#9ca3af', textDecoration:'none' }}>Update →</Link>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
              {[
                { label:'Pending Picking', val: latestOps?.pending_picking?.toLocaleString()??'—', color:'#3b82f6' },
                { label:'Pending Packing', val: latestOps?.pending_packing?.toLocaleString()??'—', color:'#22c55e' },
                { label:'Pending Sorting', val: latestOps?.pending_sorting?.toLocaleString()??'—', color:'#8b5cf6' },
                { label:'Due Date restant', val: latestOps?.remaining_due_date?.toLocaleString()??'—', color:'#f97316' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ padding:'12px 14px', borderBottom:'0.5px solid #f9f9f7', borderRight:'0.5px solid #f9f9f7' }}>
                  <div style={{ fontSize:9, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.4, marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:20, fontWeight:500, color, fontFamily:'monospace' }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'10px 14px', textAlign:'center', fontSize:11, color:'#9ca3af' }}>
              Τελευταίο snapshot: {latestOps ? new Date(latestOps.recorded_at).toLocaleTimeString('el-GR', { hour:'2-digit', minute:'2-digit' }) : '—'}
            </div>
          </div>

          {/* AI SUGGESTIONS */}
          <div style={f.card}>
            <div style={{ padding:'12px 14px', borderBottom:'0.5px solid #f5f5f0', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:'#1a1a1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>🤖</div>
              <span style={{ fontSize:13, fontWeight:500 }}>AI Προτάσεις</span>
            </div>
            {suggestions.length > 0 ? suggestions.slice(0,3).map((s, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'10px 14px', borderBottom:'0.5px solid #f9f9f7' }}>
                <div style={{ width:28, height:28, borderRadius:8, background:i===0?'#f0fdf4':i===1?'#fff7ed':'#f5f5f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>
                  {i===0?'↑':i===1?'⚠':'📈'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, fontWeight:500, color:i===0?'#16a34a':i===1?'#f97316':'#6b7280', marginBottom:2 }}>
                    {i===0?'Μετακίνηση':i===1?'SLA Risk':'Πρόβλεψη'}
                  </div>
                  <div style={{ fontSize:10, color:'#6b7280', lineHeight:1.4 }}>
                    <strong>{s.employee.full_name.split(' ')[0]}</strong>: {ROLE_CONFIG[s.from_role].label} → {ROLE_CONFIG[s.to_role].label}
                  </div>
                  <div style={{ fontSize:10, color:'#22c55e', fontWeight:500, marginTop:2 }}>+{s.capacity_gain} u/h</div>
                </div>
                <button
                  onClick={() => handleApply(s)}
                  disabled={applied.includes(s.employee.id)}
                  style={{ ...f.btn(true), fontSize:10, padding:'4px 10px', opacity: applied.includes(s.employee.id)?0.5:1 }}>
                  {applied.includes(s.employee.id) ? '✓' : 'Εφάρμοσε'}
                </button>
              </div>
            )) : (
              <div style={{ padding:'20px 14px', textAlign:'center' }}>
                <div style={{ fontSize:12, color:'#9ca3af', marginBottom:8 }}>Ενημέρωσε το Ops Snapshot για AI προτάσεις</div>
                <Link to="/ops" style={{ ...f.btn(true), textDecoration:'none', display:'inline-block', fontSize:11 }}>Ops Snapshot →</Link>
              </div>
            )}
            <div style={{ padding:'10px 14px', borderTop:'0.5px solid #f5f5f0' }}>
              <input type="text" placeholder="Ρώτα τον Copilot..." style={{ width:'100%', border:'0.5px solid #e5e5e5', borderRadius:20, padding:'7px 14px', fontSize:11, outline:'none', color:'#1a1a1a' }}
                onKeyDown={e => { if(e.key==='Enter') { window.location.href='/copilot' } }} />
            </div>
          </div>

          {/* TOP PERFORMANCE */}
          <div style={f.card}>
            <div style={{ padding:'12px 14px', borderBottom:'0.5px solid #f5f5f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:13, fontWeight:500 }}>🏆 Top Απόδοση</span>
              <span style={{ fontSize:11, color:'#9ca3af' }}>Σήμερα</span>
            </div>
            {topPerformers.length > 0 ? topPerformers.map(({ emp, uph }, i) => {
              const cfg = ROLE_CONFIG[emp.primary_role]
              return (
                <div key={emp.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderBottom:'0.5px solid #f9f9f7' }}>
                  <span style={{ fontSize:11, color:'#9ca3af', width:16 }}>{i+1}</span>
                  <div style={{ width:26, height:26, borderRadius:'50%', background:cfg.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:500, color:'white', flexShrink:0 }}>
                    {initials(emp.full_name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:11, fontWeight:500, color:'#1a1a1a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {emp.full_name.split(' ')[0]} {emp.full_name.split(' ')[1]?.[0]}.
                    </div>
                    <span style={{ fontSize:9, padding:'1px 6px', borderRadius:10, background:cfg.bg, color:cfg.color, fontWeight:500 }}>{cfg.label}</span>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:12, fontWeight:500, fontFamily:'monospace' }}>{uph}</div>
                    <div style={{ fontSize:9, color:'#22c55e' }}>u/h</div>
                  </div>
                </div>
              )
            }) : (
              <div style={{ padding:'24px', textAlign:'center', fontSize:12, color:'#9ca3af' }}>Δεν υπάρχουν δεδομένα</div>
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      <Link to="/copilot" style={{ position:'fixed', bottom:24, right:24, background:'#1a1a1a', color:'white', padding:'11px 20px', borderRadius:24, fontSize:12, fontWeight:500, display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 20px rgba(0,0,0,0.15)', textDecoration:'none', zIndex:50 }}>
        💬 Copilot
      </Link>
    </div>
  )
}

