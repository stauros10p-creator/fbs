import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import { useBreakRequests } from '@/hooks'
import { riskLabel } from '@/lib/engine'
import { Link } from 'react-router-dom'

const S = {
  page: { display:'flex', flexDirection:'column' as const, height:'100%', overflow:'hidden', background:'#f0f2f7', fontFamily:'Inter,sans-serif' },
  topbar: { background:'white', borderBottom:'1px solid #e2e6ef', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,0.04)' },
  content: { flex:1, overflowY:'auto' as const, padding:20, display:'flex', flexDirection:'column' as const, gap:16 },
  card: { background:'white', borderRadius:12, border:'1px solid #e2e6ef', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' },
  kpiGrid: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 300px', gap:12 },
  kpiCard: { background:'white', borderRadius:12, border:'1px solid #e2e6ef', padding:'16px 18px', display:'flex', gap:14, alignItems:'flex-start', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' },
  kpiIcon: { width:48, height:48, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 },
  label: { fontSize:11, color:'#9ca3af', fontWeight:500, marginBottom:2, textTransform:'uppercase' as const, letterSpacing:0.5 },
  bigNum: { fontSize:26, fontWeight:800, lineHeight:1, marginBottom:4 },
  bar: { height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden', marginBottom:4 },
  barFill: { height:'100%', borderRadius:2 },
  sub: { fontSize:11, color:'#6b7280' },
  sectionHeader: { padding:'14px 18px 12px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' },
  sectionTitle: { fontSize:13, fontWeight:700 },
  bottomGrid: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 },
  empRow: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 },
  avatar: { width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'white', flexShrink:0 },
  pill: { fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:5 },
}

function initials(name: string) {
  return name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)
}

function BreakTimer({ seconds }: { seconds: number }) {
  const [s, setS] = useState(seconds)
  useEffect(() => { const t = setInterval(()=>setS(p=>Math.max(0,p-1)),1000); return ()=>clearInterval(t) }, [])
  const m = String(Math.floor(s/60)).padStart(2,'0')
  const sec = String(s%60).padStart(2,'0')
  return <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:'#ef4444' }}>{m}:{sec}</span>
}

function Countdown() {
  const [s, setS] = useState(60)
  useEffect(() => { const t = setInterval(()=>setS(p=>p<=0?60:p-1),1000); return ()=>clearInterval(t) }, [])
  const m = String(Math.floor(s/60)).padStart(2,'0')
  const sec = String(s%60).padStart(2,'0')
  return <span style={{ fontFamily:'monospace', fontWeight:600, color:'#6b7280' }}>{m}:{sec}</span>
}

const ROLE_COLORS: Record<string,{text:string,bar:string,bg:string}> = {
  picker:      { text:'#3b82f6', bar:'#3b82f6', bg:'linear-gradient(135deg,#3b82f6,#1d4ed8)' },
  packer:      { text:'#22c55e', bar:'#22c55e', bg:'linear-gradient(135deg,#22c55e,#16a34a)' },
  sorter:      { text:'#8b5cf6', bar:'#8b5cf6', bg:'linear-gradient(135deg,#8b5cf6,#7c3aed)' },
  operator:    { text:'#06b6d4', bar:'#06b6d4', bg:'linear-gradient(135deg,#06b6d4,#0891b2)' },
  validator:   { text:'#f97316', bar:'#f97316', bg:'linear-gradient(135deg,#f97316,#ea580c)' },
  transporter: { text:'#ec4899', bar:'#ec4899', bg:'linear-gradient(135deg,#ec4899,#db2777)' },
}

const ROLE_LABELS: Record<string,string> = {
  picker:'Picking', packer:'Packing', sorter:'Sorteer',
  operator:'AutoStore', validator:'Validator', transporter:'Transport',
}

const PILL_COLORS: Record<string,{bg:string,color:string}> = {
  picker:    { bg:'#eff6ff', color:'#3b82f6' },
  packer:    { bg:'#f0fdf4', color:'#16a34a' },
  sorter:    { bg:'#f5f3ff', color:'#8b5cf6' },
  operator:  { bg:'#ecfeff', color:'#0891b2' },
  validator: { bg:'#fff7ed', color:'#ea580c' },
}

export function DashboardPage() {
  const employees    = useAppStore(s => s.employees)
  const alerts       = useAppStore(s => s.alerts)
  const engineResult = useAppStore(s => s.engineResult)
  const latestOps    = useAppStore(s => s.latestOpsSnapshot)
  const { data: breaks = [] } = useBreakRequests()
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t) }, [])

  const working  = employees.filter(e=>e.current_status==='working'||e.current_status==='redeployed').length
  const total    = employees.filter(e=>e.current_status!=='off').length
  const unacked  = alerts.filter(a=>!a.acknowledged_at).length
  const slaRisk  = engineResult?.sla_risk.same_day ?? 0
  const { label: riskLbl, color: riskClr } = riskLabel(slaRisk)
  const overallRisk = engineResult?.overall_risk ?? 0

  const DAYS = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο']
  const MONTHS = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου','Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου']
  const timeStr = now.toLocaleTimeString('el-GR',{hour:'2-digit',minute:'2-digit'})
  const dayStr  = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`

  const SHOW_ROLES = ['picker','packer','sorter','operator']
  const roleGroups = SHOW_ROLES.map(role => {
    const active = employees.filter(e=>(e.current_status==='working'||e.current_status==='redeployed')&&e.primary_role===role)
    const rc = engineResult?.role_capacity.find(r=>r.role===role)
    const totalCap = Math.round(active.reduce((sum,e)=>{
      const prod = e.productivity?.find(p=>p.role===role)
      return sum+(prod?.units_per_hour??110)
    },0))
    return { role, active, rc, totalCap }
  }).filter(g=>g.active.length>0)

  const suggestions = engineResult?.suggestions ?? []
  const activeBreaks = breaks.filter(b=>b.status==='active').slice(0,4)
  const pendingBreaks = breaks.filter(b=>b.status==='pending').slice(0,2)
  const allBreaks = [...activeBreaks,...pendingBreaks].slice(0,5)

  const topPerformers = employees
    .filter(e=>e.current_status==='working'&&e.productivity?.length)
    .map(e=>{ const prod=e.productivity?.find(p=>p.role===e.primary_role); return {emp:e,uph:prod?.units_per_hour??0} })
    .filter(x=>x.uph>0).sort((a,b)=>b.uph-a.uph).slice(0,5)

  const riskColor = overallRisk<0.3?'#22c55e':overallRisk<0.6?'#f59e0b':overallRisk<0.8?'#f97316':'#ef4444'

  return (
    <div style={S.page}>
      {/* TOPBAR */}
      <div style={S.topbar}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:20 }}>👋</span>
          <span style={{ fontSize:15, fontWeight:600 }}>
            Καλημέρα! <span style={{ color:'#6b7280', fontWeight:400, fontSize:13 }}>Σήμερα είναι </span>
            <span style={{ fontWeight:600, fontSize:13 }}>{dayStr}</span>
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {unacked>0 && (
            <div style={{ position:'relative' }}>
              <button style={{ width:36,height:36,border:'1px solid #e2e6ef',borderRadius:8,background:'white',cursor:'pointer',fontSize:16 }}>🔔</button>
              <div style={{ position:'absolute',top:-4,right:-4,background:'#ef4444',color:'white',fontSize:9,fontWeight:700,width:16,height:16,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center' }}>{unacked}</div>
            </div>
          )}
          <div style={{ border:'1px solid #e2e6ef',borderRadius:8,padding:'6px 14px',display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#6b7280' }}>
            Τώρα <strong style={{ fontFamily:'monospace', color:'#1a1f36', fontSize:14 }}>{timeStr}</strong>
          </div>
          <Link to="/ops" style={{ background:'#3b82f6',color:'white',padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:600,textDecoration:'none' }}>
            + Νέο Διάλειμμα
          </Link>
        </div>
      </div>

      {/* CONTENT */}
      <div style={S.content}>

        {/* KPI ROW */}
        <div style={S.kpiGrid}>
          {/* Διαθέσιμοι */}
          <div style={S.kpiCard}>
            <div style={{ ...S.kpiIcon, background:'#eff6ff' }}>👥</div>
            <div style={{ flex:1 }}>
              <div style={S.label}>Διαθέσιμοι</div>
              <div style={{ ...S.bigNum, color:'#3b82f6' }}>{working} <span style={{ fontSize:14,color:'#9ca3af',fontWeight:400 }}>/ {total}</span></div>
              <div style={S.bar}><div style={{ ...S.barFill, width:`${total>0?working/total*100:0}%`, background:'#3b82f6' }}/></div>
              <div style={S.sub}><strong style={{ color:'#3b82f6' }}>{total>0?Math.round(working/total*100):0}%</strong> Ενεργοί τώρα</div>
            </div>
          </div>

          {/* Απαιτούμενοι */}
          <div style={S.kpiCard}>
            <div style={{ ...S.kpiIcon, background:'#f0fdf4' }}>📋</div>
            <div style={{ flex:1 }}>
              <div style={S.label}>Απαιτούμενοι</div>
              <div style={{ ...S.bigNum, color:'#22c55e' }}>{engineResult?.role_capacity.reduce((s,r)=>s+r.required_count,0)??'—'} <span style={{ fontSize:12,color:'#9ca3af',fontWeight:400 }}>(Τώρα)</span></div>
              <div style={S.bar}><div style={{ ...S.barFill, width:'100%', background:'#22c55e' }}/></div>
              <div style={S.sub}>Στόχος κάλυψης <strong style={{ color:'#22c55e' }}>100%</strong></div>
            </div>
          </div>

          {/* SLA */}
          <div style={S.kpiCard}>
            <div style={{ ...S.kpiIcon, background:'#fff7ed' }}>🎯</div>
            <div style={{ flex:1 }}>
              <div style={S.label}>SLA Πρόβλεψη</div>
              <div style={{ ...S.bigNum, color:'#1a1f36', fontSize:22 }}>{Math.round((1-slaRisk)*100)}%</div>
              <div style={{ fontSize:12,fontWeight:600,color:'#22c55e' }}>▲ vs χτες</div>
              <div style={{ ...S.sub, marginTop:2 }}>SameDay: <strong style={{ color:'#f97316' }}>{latestOps?.remaining_same_day??'—'}</strong> υπόλοιπο</div>
            </div>
          </div>

          {/* Κίνδυνος */}
          <div style={S.kpiCard}>
            <div style={{ ...S.kpiIcon, background:'#f5f3ff' }}>🛡️</div>
            <div style={{ flex:1 }}>
              <div style={S.label}>Κίνδυνος</div>
              <div style={{ fontSize:18,fontWeight:800,color:riskColor,marginBottom:8 }}>{riskLbl}</div>
              <div style={{ ...S.sub, display:'flex',alignItems:'center',gap:5 }}>
                <div style={{ width:7,height:7,borderRadius:'50%',background:riskColor }} />
                {overallRisk<0.3?'Κανένα bottleneck':engineResult?.bottleneck_role??'Παρακολούθηση'}
              </div>
            </div>
          </div>

          {/* BREAKS */}
          <div style={{ ...S.card, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px 10px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:8 }}>
                ☕ Διαλείμματα (Τώρα)
                {allBreaks.length>0 && <span style={{ background:'#ef4444',color:'white',fontSize:10,fontWeight:700,width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center' }}>{allBreaks.length}</span>}
              </div>
            </div>
            {allBreaks.length===0 ? (
              <div style={{ padding:'16px',textAlign:'center',fontSize:12,color:'#9ca3af' }}>Κανένα ενεργό διάλειμμα</div>
            ) : allBreaks.map(b=>{
              const clr = ROLE_COLORS[b.employee?.primary_role??'picker']
              return (
                <div key={b.id} style={{ display:'flex',alignItems:'center',gap:9,padding:'8px 14px',borderBottom:'1px solid #f9fafb' }}>
                  <div style={{ width:30,height:30,borderRadius:'50%',background:clr?.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0 }}>
                    {initials(b.employee?.full_name??'?')}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:600,color:'#1a1f36' }}>{b.employee?.full_name?.split(' ').slice(0,2).join(' ')}</div>
                    <div style={{ fontSize:10,color:'#9ca3af',textTransform:'capitalize' }}>{b.employee?.primary_role} · {b.status==='active'?'Σε διάλειμμα':'Αναμονή'}</div>
                  </div>
                  {b.status==='active'&&b.break_end ? (
                    <BreakTimer seconds={Math.max(0,Math.floor((new Date(b.break_end).getTime()-Date.now())/1000))} />
                  ) : <span style={{ fontSize:10,color:'#f97316',fontWeight:600 }}>Pending</span>}
                </div>
              )
            })}
            <div style={{ textAlign:'center',padding:'8px',fontSize:11,color:'#3b82f6',fontWeight:500,borderTop:'1px solid #f1f5f9' }}>Δείτε όλα τα διαλείμματα →</div>
          </div>
        </div>

        {/* LIVE ALLOCATION */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <div style={{ display:'flex',alignItems:'center',gap:12 }}>
              <span style={S.sectionTitle}>Live Allocation</span>
              <span style={{ display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#3b82f6',fontWeight:500 }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:'#3b82f6',display:'inline-block',animation:'pulse2 2s infinite' }}/>
                Αυτόματος υπολογισμός
              </span>
            </div>
            <div style={{ fontSize:11,color:'#9ca3af',display:'flex',alignItems:'center',gap:6 }}>
              Επόμενη ενημέρωση σε <Countdown />
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${roleGroups.length},1fr)` }}>
            {roleGroups.map(({ role, active, rc, totalCap }) => {
              const clr = ROLE_COLORS[role]??ROLE_COLORS.picker
              const pct = rc?Math.min(100,(active.length/Math.max(rc.required_count,1))*100):100
              return (
                <div key={role} style={{ padding:14, borderRight:'1px solid #f1f5f9' }}>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                    <span style={{ fontSize:13,fontWeight:700,color:clr.text }}>{ROLE_LABELS[role]}</span>
                    <span style={{ fontSize:12,color:'#9ca3af',fontFamily:'monospace' }}>{active.length}/{rc?.required_count??active.length}</span>
                  </div>
                  <div style={{ height:3,background:'#f1f5f9',borderRadius:2,overflow:'hidden',marginBottom:10 }}>
                    <div style={{ height:'100%',borderRadius:2,background:clr.bar,width:`${pct}%` }}/>
                  </div>
                  {active.slice(0,4).map(emp=>{
                    const prod=emp.productivity?.find(p=>p.role===role)
                    const uph=prod?.units_per_hour??110
                    return (
                      <div key={emp.id} style={S.empRow}>
                        <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                          <div style={{ ...S.avatar,background:clr.bg }}>{initials(emp.full_name)}</div>
                          <span style={{ fontSize:11,color:'#374151',maxWidth:85,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                            {emp.full_name.split(' ').slice(0,2).join(' ')}
                          </span>
                        </div>
                        <span style={{ fontSize:11,fontWeight:700,color:clr.text,fontFamily:'monospace' }}>
                          {uph} <span style={{ color:'#9ca3af',fontWeight:400,fontSize:9 }}>u/h</span>
                        </span>
                      </div>
                    )
                  })}
                  {active.length>4&&<div style={{ fontSize:10,color:'#9ca3af',marginBottom:6 }}>... +{active.length-4} ακόμα</div>}
                  <div style={{ borderTop:'1px solid #f1f5f9',paddingTop:8,marginTop:4,display:'flex',justifyContent:'space-between' }}>
                    <span style={{ fontSize:10,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:0.3 }}>Σύνολο:</span>
                    <span style={{ fontSize:12,fontWeight:700,color:clr.text,fontFamily:'monospace' }}>{totalCap.toLocaleString()} u/h</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* BOTTOM ROW */}
        <div style={S.bottomGrid}>

          {/* WORKLOAD */}
          <div style={S.card}>
            <div style={S.sectionHeader}>
              <span style={S.sectionTitle}>Workload & Forecast</span>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:1 }}>
              {[
                { label:'Pending Orders', val:(latestOps?(latestOps.pending_picking+latestOps.pending_packing+latestOps.pending_sorting):0).toLocaleString(), color:'#1a1f36', sub:'' },
                { label:'Backlog', val:latestOps?.backlog_orders?.toLocaleString()??'—', color:'#ef4444', sub:'vs χτες' },
                { label:'Same Day', val:latestOps?.remaining_same_day?.toLocaleString()??'—', color:'#f97316', sub:'96% πρόβλεψη' },
                { label:'AutoStore', val:latestOps?.remaining_intraday?.toLocaleString()??'—', color:'#22c55e', sub:'98% πρόβλεψη' },
              ].map(({label,val,color,sub})=>(
                <div key={label} style={{ padding:'12px 14px',borderBottom:'1px solid #f9fafb',borderRight:'1px solid #f9fafb' }}>
                  <div style={{ fontSize:10,color:'#9ca3af',fontWeight:500,marginBottom:2,textTransform:'uppercase',letterSpacing:0.4 }}>{label}</div>
                  <div style={{ fontSize:20,fontWeight:800,color,fontFamily:'monospace',lineHeight:1 }}>{val}</div>
                  {sub&&<div style={{ fontSize:10,color,marginTop:2 }}>{sub}</div>}
                </div>
              ))}
            </div>
            <div style={{ padding:'10px 14px',textAlign:'center',fontSize:11,color:'#9ca3af' }}>
              📊 Ανέβασε WMS export για live γράφημα
            </div>
          </div>

          {/* AI SUGGESTIONS */}
          <div style={S.card}>
            <div style={S.sectionHeader}>
              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                <div style={{ width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>🤖</div>
                <span style={S.sectionTitle}>AI Προτάσεις <span style={{ fontSize:11,color:'#9ca3af',fontWeight:400 }}>(Τώρα)</span></span>
              </div>
            </div>
            {suggestions.length>0 ? suggestions.slice(0,3).map((s,i)=>(
              <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'11px 14px',borderBottom:'1px solid #f9fafb' }}>
                <div style={{ width:34,height:34,borderRadius:10,background:i===0?'#f0fdf4':i===1?'#fff7ed':'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>
                  {i===0?'⬆️':i===1?'📦':'ℹ️'}
                </div>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:i===0?'#22c55e':i===1?'#f97316':'#3b82f6',marginBottom:2 }}>
                    {i===0?'Μετακίνηση προτείνεται':i===1?'Ενίσχυση':'Πρόβλεψη'}
                  </div>
                  <div style={{ fontSize:11,color:'#6b7280',marginBottom:4,lineHeight:1.4 }}>
                    Μετακίνησε <strong>{s.employee.full_name.split(' ')[0]}</strong> από {s.from_role} → {s.to_role}
                  </div>
                  <div style={{ fontSize:11,fontWeight:600,color:'#22c55e' }}>Κέρδος: +{s.capacity_gain} u/h</div>
                </div>
                <button style={{ background:'#22c55e',color:'white',border:'none',padding:'5px 12px',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap' }}>Εφάρμοσε</button>
              </div>
            )) : (
              <>
                <div style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'11px 14px',borderBottom:'1px solid #f9fafb' }}>
                  <div style={{ width:34,height:34,borderRadius:10,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>⬆️</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:'#22c55e',marginBottom:2 }}>Σύστημα έτοιμο</div>
                    <div style={{ fontSize:11,color:'#6b7280',lineHeight:1.4 }}>Ενημέρωσε το Ops Snapshot για AI προτάσεις</div>
                  </div>
                  <Link to="/ops"><button style={{ background:'#3b82f6',color:'white',border:'none',padding:'5px 12px',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer' }}>Snapshot</button></Link>
                </div>
                <div style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'11px 14px' }}>
                  <div style={{ width:34,height:34,borderRadius:10,background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0 }}>ℹ️</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:'#3b82f6',marginBottom:2 }}>Πρόβλεψη SLA</div>
                    <div style={{ fontSize:11,color:'#6b7280' }}>Κίνδυνος SLA: <strong>{Math.round(slaRisk*100)}%</strong> — {riskLbl}</div>
                  </div>
                  <button style={{ background:'transparent',color:'#3b82f6',border:'1px solid #3b82f6',padding:'5px 12px',borderRadius:7,fontSize:11,fontWeight:700,cursor:'pointer' }}>Προβολή</button>
                </div>
              </>
            )}
          </div>

          {/* TOP PERFORMANCE */}
          <div style={S.card}>
            <div style={S.sectionHeader}>
              <span style={S.sectionTitle}>🏆 Top Απόδοση (Σήμερα)</span>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #f1f5f9' }}>
                  {['Εργαζόμενος','Ρόλος','Παραγωγικότητα'].map(h=>(
                    <th key={h} style={{ textAlign:'left',padding:'8px 14px',fontSize:10,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topPerformers.length>0 ? topPerformers.map(({emp,uph},i)=>{
                  const clr=ROLE_COLORS[emp.primary_role]
                  const pill=PILL_COLORS[emp.primary_role]??{bg:'#f1f5f9',color:'#6b7280'}
                  return (
                    <tr key={emp.id} style={{ borderBottom:'1px solid #f9fafb' }}>
                      <td style={{ padding:'9px 14px' }}>
                        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                          <span style={{ fontSize:13 }}>{i<2?'⭐':''}</span>
                          <div style={{ width:26,height:26,borderRadius:'50%',background:clr?.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:'white',flexShrink:0 }}>
                            {initials(emp.full_name)}
                          </div>
                          <span style={{ fontSize:12,color:'#374151',fontWeight:500 }}>
                            {emp.full_name.split(' ')[0]} {emp.full_name.split(' ')[1]?.[0]}.
                          </span>
                        </div>
                      </td>
                      <td style={{ padding:'9px 6px' }}>
                        <span style={{ ...S.pill, background:pill.bg, color:pill.color }}>
                          {ROLE_LABELS[emp.primary_role]}
                        </span>
                      </td>
                      <td style={{ padding:'9px 14px', textAlign:'right' }}>
                        <span style={{ fontFamily:'monospace',fontSize:12,fontWeight:700,color:'#1a1f36' }}>{uph} u/h</span>
                        <span style={{ fontSize:10,fontWeight:600,color:'#22c55e',marginLeft:4 }}>+{Math.round(Math.random()*10+2)}%</span>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={3} style={{ padding:'24px',textAlign:'center',fontSize:12,color:'#9ca3af' }}>Δεν υπάρχουν δεδομένα παραγωγικότητας</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* COPILOT FAB */}
      <Link to="/copilot" style={{
        position:'fixed',bottom:24,right:24,
        background:'#3b82f6',color:'white',
        padding:'12px 20px',borderRadius:50,
        fontSize:13,fontWeight:700,
        display:'flex',alignItems:'center',gap:8,
        boxShadow:'0 4px 20px rgba(59,130,246,0.4)',
        textDecoration:'none',
      }}>
        💬 Ρωτήστε τον Copilot
      </Link>
    </div>
  )
}

