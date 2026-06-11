import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

const DD_BASE: Record<number, { mon: number; twt: number; fri: number; sat: number; sun: number }> = {
  6:  { mon: 11267, twt: 10332, fri:  8650, sat:  6055, sun:  7798 },
  7:  { mon: 13135, twt: 12044, fri: 10084, sat:  7059, sun:  9091 },
  8:  { mon: 11566, twt: 10606, fri:  8880, sat:  6216, sun:  8005 },
  9:  { mon: 12989, twt: 11911, fri:  9972, sat:  6980, sun:  8990 },
  10: { mon: 13317, twt: 12212, fri: 10224, sat:  7157, sun:  9217 },
  11: { mon: 17112, twt: 15691, fri: 13137, sat:  9196, sun: 11843 },
  12: { mon: 18243, twt: 16728, fri: 14006, sat:  9804, sun: 12626 },
}
const INTRADAY_BASE: Record<number, { mon: number; twt: number; sun: number }> = {
  6:  { mon: 1600, twt: 1500, sun: 1746 },
  7:  { mon: 1865, twt: 1749, sun: 2035 },
  8:  { mon: 1642, twt: 1540, sun: 1792 },
  9:  { mon: 1845, twt: 1729, sun: 2013 },
  10: { mon: 1891, twt: 1773, sun: 2064 },
  11: { mon: 2430, twt: 2278, sun: 2652 },
  12: { mon: 2591, twt: 2429, sun: 2827 },
}
const SPECIAL_DAYS: Record<string, number> = {
  '2026-08-15': 1200, '2026-10-28': 0,
  '2026-11-27': 38000, '2026-11-28': 28000,
  '2026-12-25': 0, '2026-12-26': 0, '2026-12-31': 4500,
}

// DD hourly % distribution — from real data (Total Orders - Intraday per hour)
const DD_HOURLY: Record<number, number[]> = {
  1: [3.9,2.2,1.0,0.5,0.4,0.3,0.6,1.4,2.8,4.7,6.4,7.5,7.6,7.1,7.0,6.3,6.3,6.2,6.3,3.9,4.1,4.6,4.5,4.3],
  2: [3.7,2.1,1.0,0.6,0.4,0.4,0.7,1.6,3.3,5.3,6.7,7.0,7.8,7.0,6.6,6.0,6.2,6.9,6.8,3.7,3.9,4.1,4.2,3.8],
  3: [4.1,2.3,1.2,0.7,0.4,0.4,0.7,1.9,3.5,5.4,6.9,7.3,7.7,7.1,6.8,5.5,7.7,6.4,6.0,3.7,3.3,3.7,4.0,3.5],
  4: [4.2,2.3,1.1,0.7,0.4,0.4,0.7,2.1,3.7,5.6,6.7,7.6,7.8,7.4,6.9,6.8,6.2,6.2,6.1,3.4,3.2,3.8,3.7,3.1],
  5: [3.2,2.1,1.0,0.6,0.4,0.3,0.8,1.8,3.1,4.9,6.1,7.2,7.3,6.5,6.4,6.1,5.9,6.3,6.1,5.1,4.8,4.8,4.7,4.3],
  6: [3.7,2.0,1.1,0.7,0.5,0.3,0.7,1.1,2.5,4.3,5.9,6.6,7.5,6.9,6.3,5.9,5.9,5.9,5.7,5.9,5.8,5.4,4.8,4.4],
  0: [3.5,2.3,1.4,0.8,0.5,0.3,0.4,0.9,2.2,4.3,5.8,7.3,8.1,7.9,7.6,6.9,7.0,7.5,4.4,3.9,3.9,4.6,4.5,4.2],
}
// Intraday hourly % — Mon-Thu/Sun active, Fri/Sat = 0
const ID_HOURLY: Record<number, number[]> = {
  1: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,15.9,18.1,19.1,23.4,20.9],
  2: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18.2,17.8,19.0,23.3,20.8],
  3: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,17.2,16.8,19.3,22.2,22.8],
  4: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18.0,16.7,19.0,22.0,22.3],
  5: Array(24).fill(0),
  6: Array(24).fill(0),
  0: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14.7,16.8,15.9,17.3,18.8,16.4],
}

const MONTHS_GR: Record<number, string> = {
  6:'Ιούνιος',7:'Ιούλιος',8:'Αύγουστος',9:'Σεπτέμβριος',
  10:'Οκτώβριος',11:'Νοέμβριος',12:'Δεκέμβριος',
}
const DOW_GR = ['Κυρ','Δευ','Τρι','Τετ','Πεμ','Παρ','Σαβ']
const HOURS = Array.from({length:24}, (_,i) => `${String(i).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`)

function fmt(n: number) { return Math.round(n).toLocaleString('el-GR') }

function buildForecast() {
  const out: Record<string, {due_date: number; intraday: number}> = {}
  const end = new Date('2026-12-31')
  for (let d = new Date('2026-06-01'); d <= end; d.setDate(d.getDate()+1)) {
    const key = d.toISOString().slice(0,10)
    const m = d.getMonth()+1
    const dow = (d.getDay()+6)%7
    const ddRow = DD_BASE[m]; const idRow = INTRADAY_BASE[m]
    const normDD = dow===0?ddRow.mon:dow<=3?ddRow.twt:dow===4?ddRow.fri:dow===5?ddRow.sat:ddRow.sun
    const normID = dow===0?idRow.mon:dow<=3?idRow.twt:dow===4?0:dow===5?0:idRow.sun
    let dd: number, id: number
    if (SPECIAL_DAYS[key] !== undefined) {
      const sp = SPECIAL_DAYS[key]
      if (sp===0) { dd=0; id=0 }
      else { const nt=normDD+normID; dd=nt>0?Math.round(sp*normDD/nt):sp; id=nt>0?Math.round(sp*normID/nt):0 }
    } else {
      const j = 1+Math.sin(d.getTime()/86_400_000*3.7)*0.03
      dd=Math.round(normDD*j); id=Math.round(normID*j)
    }
    out[key] = {due_date: dd, intraday: id}
  }
  return out
}
const FORECAST = buildForecast()

function getHourlyData(dateKey: string) {
  const f = FORECAST[dateKey] ?? {due_date:0, intraday:0}
  const dow = new Date(dateKey+'T12:00:00').getDay()
  const ddDist = DD_HOURLY[dow] ?? Array(24).fill(0)
  const idDist = ID_HOURLY[dow] ?? Array(24).fill(0)
  const ddSum = ddDist.reduce((a:number,b:number)=>a+b,0)
  const idSum = idDist.reduce((a:number,b:number)=>a+b,0)
  let cumDD = 0, cumID = 0
  return HOURS.map((hr, i) => {
    const dd = ddSum>0 ? Math.round(f.due_date * ddDist[i]/ddSum) : 0
    const id = idSum>0 ? Math.round(f.intraday * idDist[i]/idSum) : 0
    // Backlog hours: 00-06 (overnight) and 19-23
    const isBacklogHour = i < 7 || i >= 19
    cumDD += dd; cumID += id
    return { hr, dd, id, total: dd+id, cumDD, cumID, isBacklogHour }
  })
}

function getDaysInMonth(year: number, month: number): (number | null)[] {
  const days: (number | null)[] = []
  const first = new Date(year, month-1, 1).getDay()
  const total = new Date(year, month, 0).getDate()
  const offset = (first+6)%7
  for (let i=0;i<offset;i++) days.push(null)
  for (let d=1;d<=total;d++) days.push(d)
  return days
}

export function HourlyForecastPage() {
  const navigate = useNavigate()
  const today = new Date()
  const initMonth = Math.min(12, Math.max(6, today.getMonth()+1))
  const [activeMonth, setActiveMonth] = useState(initMonth)
  const [selectedDay, setSelectedDay] = useState<string|null>(null)

  const year = 2026
  const days = getDaysInMonth(year, activeMonth)
  const hourlyData = useMemo(() => selectedDay ? getHourlyData(selectedDay) : [], [selectedDay])

  const selForecast = selectedDay ? (FORECAST[selectedDay]??{due_date:0,intraday:0}) : null
  const selDow = selectedDay ? new Date(selectedDay+'T12:00:00').getDay() : -1
  const peakHour = hourlyData.length ? hourlyData.reduce((a,b)=>b.total>a.total?b:a) : null

  // Totals from hourly breakdown
  const totalDD = hourlyData.reduce((s,r)=>s+r.dd,0)
  const totalID = hourlyData.reduce((s,r)=>s+r.id,0)
  const totalAll = totalDD + totalID

  // Backlog = DD orders in hours 00-06 and 19-23
  const backlog = hourlyData.filter(r=>r.isBacklogHour).reduce((s,r)=>s+r.dd,0)

  function getDayTotal(d: number) {
    const key = `${year}-${String(activeMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const f = FORECAST[key]
    return f ? f.due_date+f.intraday : 0
  }
  const maxTotal = Math.max(...days.filter(Boolean).map(d=>getDayTotal(d as number)), 1)

  function exportToExcel() {
    if (!selectedDay || !selForecast) return
    const rows = hourlyData.map(r => ({
      'Ώρα': r.hr,
      'Due Date': r.dd,
      'Intraday': r.id,
      'Σύνολο': r.total,
      'Αθροιστικό DD': r.cumDD,
      'Αθροιστικό Intraday': r.cumID,
      'Backlog ώρα': r.isBacklogHour ? r.dd : 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{wch:12},{wch:10},{wch:10},{wch:10},{wch:14},{wch:18},{wch:14}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, selectedDay)
    XLSX.writeFile(wb, `hourly_forecast_${selectedDay}.xlsx`)
  }

  const CustomTooltip = ({active, payload, label}: any) => {
    if (!active||!payload?.length) return null
    return (
      <div style={{background:'white',border:'0.5px solid #e5e5e5',borderRadius:10,padding:'10px 14px',fontSize:12}}>
        <div style={{fontWeight:500,marginBottom:6,color:'#1a1a1a'}}>{label}</div>
        {payload.map((p:any) => p.value>0 && (
          <div key={p.dataKey} style={{display:'flex',justifyContent:'space-between',gap:16}}>
            <span style={{color:p.fill||p.stroke}}>{p.name}</span>
            <span style={{fontFamily:'monospace',fontWeight:500,color:'#1a1a1a'}}>{fmt(p.value)}</span>
          </div>
        ))}
        <div style={{borderTop:'0.5px solid #f0f0f0',marginTop:6,paddingTop:6,display:'flex',justifyContent:'space-between'}}>
          <span style={{color:'#9ca3af'}}>Σύνολο</span>
          <span style={{fontFamily:'monospace',fontWeight:600,color:'#1a1a1a'}}>
            {fmt(payload.reduce((s:number,p:any)=>s+(p.value||0),0))}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{height:'100%',overflowY:'auto',background:'#f5f5f0',fontFamily:'Inter, sans-serif'}}>
      <div style={{padding:'20px 24px',maxWidth:1200,margin:'0 auto'}}>

        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
          <button onClick={()=>navigate('/forecast')}
            style={{background:'none',border:'0.5px solid #e5e5e5',borderRadius:8,padding:'6px 12px',fontSize:13,color:'#6b7280',cursor:'pointer'}}>
            ← Forecast
          </button>
          <div>
            <h1 style={{margin:0,fontSize:20,fontWeight:600,color:'#1a1a1a'}}>Forecast Hourly Throughput</h1>
            <div style={{fontSize:12,color:'#9ca3af',marginTop:2}}>
              Ωριαία πρόβλεψη παραγγελιών ανά ημέρα — Ιούνιος–Δεκέμβριος 2026
            </div>
          </div>
        </div>

        <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
          {[6,7,8,9,10,11,12].map(m => (
            <button key={m} onClick={()=>{setActiveMonth(m);setSelectedDay(null)}}
              style={{padding:'6px 16px',borderRadius:20,fontSize:13,fontWeight:500,cursor:'pointer',border:'none',
                background:activeMonth===m?'#1a1a1a':'#f5f5f3',color:activeMonth===m?'white':'#6b7280'}}>
              {MONTHS_GR[m]}
            </button>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:selectedDay?'280px 1fr':'360px',gap:16,alignItems:'start'}}>

          <div style={{background:'white',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'16px'}}>
            <div style={{fontSize:13,fontWeight:500,color:'#1a1a1a',marginBottom:12,textAlign:'center'}}>
              {MONTHS_GR[activeMonth]} {year}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
              {['Δε','Τρ','Τε','Πε','Πα','Σα','Κυ'].map(d=>(
                <div key={d} style={{textAlign:'center',fontSize:10,color:'#9ca3af',padding:'4px 0'}}>{d}</div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
              {days.map((d,i)=>{
                if (!d) return <div key={i}/>
                const key=`${year}-${String(activeMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                const total=getDayTotal(d)
                const isClosed=total===0
                const isSel=selectedDay===key
                const intensity=Math.min(1,total/maxTotal)
                const bg=isSel?'#1a1a1a':isClosed?'#fef9f9':`rgba(55,138,221,${0.08+intensity*0.55})`
                const color=isSel?'white':isClosed?'#d1d5db':intensity>0.6?'white':'#1a1a1a'
                const isSpecial=SPECIAL_DAYS[key]!==undefined && SPECIAL_DAYS[key]>15000
                return (
                  <button key={i} onClick={()=>!isClosed&&setSelectedDay(isSel?null:key)}
                    style={{background:bg,border:isSpecial?'1.5px solid #f59e0b':'0.5px solid transparent',
                      borderRadius:8,padding:'6px 2px',textAlign:'center',cursor:isClosed?'default':'pointer',
                      transition:'all 0.15s'}}>
                    <div style={{fontSize:12,fontWeight:500,color}}>{d}</div>
                    {total>0&&(
                      <div style={{fontSize:9,color:isSel?'rgba(255,255,255,0.7)':intensity>0.6?'rgba(255,255,255,0.8)':'#6b7280',marginTop:1}}>
                        {total>=1000?`${(total/1000).toFixed(0)}k`:total}
                      </div>
                    )}
                    {isClosed&&<div style={{fontSize:9,color:'#d1d5db'}}>—</div>}
                  </button>
                )
              })}
            </div>
            <div style={{marginTop:12,display:'flex',alignItems:'center',gap:8,justifyContent:'center'}}>
              <div style={{height:8,width:80,borderRadius:4,background:'linear-gradient(to right, rgba(55,138,221,0.08), rgba(55,138,221,0.65))'}}></div>
              <span style={{fontSize:10,color:'#9ca3af'}}>χαμηλό → υψηλό</span>
            </div>
          </div>

          {selectedDay && selForecast ? (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>

              {/* Day header card */}
              <div style={{background:'white',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'14px 18px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <div>
                      <div style={{fontSize:15,fontWeight:600,color:'#1a1a1a'}}>
                        {new Date(selectedDay+'T12:00:00').toLocaleDateString('el-GR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                      </div>
                      <div style={{fontSize:12,color:'#9ca3af',marginTop:2}}>
                        {DOW_GR[selDow]} · {MONTHS_GR[activeMonth]} {year}
                      </div>
                    </div>
                    <button onClick={exportToExcel}
                      style={{marginTop:2,padding:'5px 12px',background:'#f0fdf4',border:'0.5px solid #86efac',borderRadius:8,fontSize:12,color:'#16a34a',cursor:'pointer',fontWeight:500,whiteSpace:'nowrap'}}>
                      ⬇ Excel
                    </button>
                  </div>
                  <div style={{display:'flex',gap:20,flexWrap:'wrap',alignItems:'flex-start'}}>
                    {/* Due Date */}
                    <div style={{textAlign:'center',minWidth:70}}>
                      <div style={{fontSize:11,color:'#378ADD',textTransform:'uppercase',letterSpacing:0.3}}>Due Date</div>
                      <div style={{fontSize:22,fontWeight:700,color:'#378ADD',fontFamily:'monospace',lineHeight:1.2}}>{fmt(totalDD)}</div>
                      <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>παραγγελίες</div>
                    </div>
                    {/* Intraday */}
                    {selForecast.intraday>0&&(
                      <div style={{textAlign:'center',minWidth:70}}>
                        <div style={{fontSize:11,color:'#7F77DD',textTransform:'uppercase',letterSpacing:0.3}}>Intraday</div>
                        <div style={{fontSize:22,fontWeight:700,color:'#7F77DD',fontFamily:'monospace',lineHeight:1.2}}>{fmt(totalID)}</div>
                        <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>παραγγελίες</div>
                      </div>
                    )}
                    {/* Σύνολο */}
                    <div style={{textAlign:'center',minWidth:70}}>
                      <div style={{fontSize:11,color:'#1a1a1a',textTransform:'uppercase',letterSpacing:0.3}}>Σύνολο</div>
                      <div style={{fontSize:22,fontWeight:700,color:'#1a1a1a',fontFamily:'monospace',lineHeight:1.2}}>{fmt(totalAll)}</div>
                      <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>παραγγελίες</div>
                    </div>
                    {/* Backlog */}
                    <div style={{textAlign:'center',minWidth:70,background:'#fffbeb',borderRadius:8,padding:'6px 10px',border:'0.5px solid #fde68a'}}>
                      <div style={{fontSize:11,color:'#b45309',textTransform:'uppercase',letterSpacing:0.3}}>Backlog αύριο</div>
                      <div style={{fontSize:22,fontWeight:700,color:'#b45309',fontFamily:'monospace',lineHeight:1.2}}>{fmt(backlog)}</div>
                      <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>{totalDD>0?`${Math.round(backlog/totalDD*100)}% του DD`:''}</div>
                    </div>
                    {/* Peak */}
                    {peakHour&&peakHour.total>0&&(
                      <div style={{textAlign:'center',minWidth:60}}>
                        <div style={{fontSize:11,color:'#D85A30',textTransform:'uppercase',letterSpacing:0.3}}>Peak ώρα</div>
                        <div style={{fontSize:16,fontWeight:700,color:'#D85A30',lineHeight:1.2}}>{peakHour.hr}</div>
                        <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>{fmt(peakHour.total)} παρ.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div style={{background:'white',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'16px 18px'}}>
                <div style={{fontSize:11,color:'#9ca3af',textTransform:'uppercase',letterSpacing:0.5,marginBottom:14}}>
                  Ωριαία Κατανομή Παραγγελιών
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={hourlyData} barGap={0}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                    <XAxis dataKey="hr" tick={{fontSize:9,fill:'#9ca3af'}} axisLine={false} tickLine={false}
                      interval={1} angle={-45} textAnchor="end" height={44}/>
                    <YAxis tick={{fontSize:10,fill:'#9ca3af'}} axisLine={false} tickLine={false} width={40}
                      tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="dd" name="Due Date" fill="#378ADD" stackId="a" radius={[2,2,0,0]}/>
                    {selForecast.intraday>0&&(
                      <Bar dataKey="id" name="Intraday" fill="#7F77DD" stackId="a" radius={[2,2,0,0]}/>
                    )}
                    <Line dataKey="cumDD" name="Αθροιστικό DD" stroke="#D85A30"
                      strokeWidth={1.5} dot={false} strokeDasharray="4 2" yAxisId={0}/>
                  </ComposedChart>
                </ResponsiveContainer>
                <div style={{display:'flex',gap:16,marginTop:8,fontSize:11,color:'#6b7280',flexWrap:'wrap'}}>
                  <span><span style={{display:'inline-block',width:10,height:10,background:'#378ADD',borderRadius:2,marginRight:4}}></span>Due Date</span>
                  {selForecast.intraday>0&&<span><span style={{display:'inline-block',width:10,height:10,background:'#7F77DD',borderRadius:2,marginRight:4}}></span>Intraday</span>}
                  <span><span style={{display:'inline-block',width:24,height:2,background:'#D85A30',marginRight:4,verticalAlign:'middle'}}></span>Αθροιστικό DD</span>
                  <span style={{color:'#b45309'}}>🕗 Backlog: ώρες 00-06 & 19-23</span>
                </div>
              </div>

              {/* Hourly table */}
              <div style={{background:'white',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'16px 18px'}}>
                <div style={{fontSize:11,color:'#9ca3af',textTransform:'uppercase',letterSpacing:0.5,marginBottom:12}}>
                  Αναλυτικός Πίνακας ανά Ώρα
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr style={{background:'#f9f9f7',borderBottom:'0.5px solid #e5e5e5'}}>
                        <th style={{textAlign:'left',padding:'6px 10px',color:'#9ca3af',fontWeight:500}}>Ώρα</th>
                        <th style={{textAlign:'right',padding:'6px 10px',color:'#378ADD',fontWeight:500}}>Due Date</th>
                        {selForecast.intraday>0&&<th style={{textAlign:'right',padding:'6px 10px',color:'#7F77DD',fontWeight:500}}>Intraday</th>}
                        <th style={{textAlign:'right',padding:'6px 10px',color:'#1a1a1a',fontWeight:600}}>Σύνολο</th>
                        <th style={{textAlign:'right',padding:'6px 10px',color:'#D85A30',fontWeight:500}}>Αθρ. DD</th>
                        <th style={{textAlign:'right',padding:'6px 10px',color:'#b45309',fontWeight:500}}>Backlog</th>
                        <th style={{padding:'6px 10px',width:100}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {hourlyData.filter(r=>r.total>0).map((r,i)=>{
                        const isPeak=peakHour&&r.hr===peakHour.hr
                        const barPct=peakHour?Math.round(r.total/peakHour.total*100):0
                        return (
                          <tr key={r.hr} style={{background:r.isBacklogHour?'#fffdf5':isPeak?'#fffbeb':i%2===0?'white':'#fcfcfb',borderBottom:'0.5px solid #f5f5f5'}}>
                            <td style={{padding:'6px 10px',fontFamily:'monospace',fontWeight:isPeak?600:400,color:'#1a1a1a'}}>
                              {r.hr}
                              {r.isBacklogHour&&<span style={{marginLeft:4,fontSize:9,color:'#b45309',background:'#fef9c3',borderRadius:3,padding:'1px 4px'}}>backlog</span>}
                            </td>
                            <td style={{padding:'6px 10px',textAlign:'right',fontFamily:'monospace',color:'#378ADD'}}>{r.dd>0?fmt(r.dd):'—'}</td>
                            {selForecast.intraday>0&&<td style={{padding:'6px 10px',textAlign:'right',fontFamily:'monospace',color:'#7F77DD'}}>{r.id>0?fmt(r.id):'—'}</td>}
                            <td style={{padding:'6px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:600,color:isPeak?'#b45309':'#1a1a1a'}}>{fmt(r.total)}</td>
                            <td style={{padding:'6px 10px',textAlign:'right',fontFamily:'monospace',color:'#D85A30',fontSize:11}}>{fmt(r.cumDD)}</td>
                            <td style={{padding:'6px 10px',textAlign:'right',fontFamily:'monospace',color:'#b45309',fontSize:11}}>{r.isBacklogHour&&r.dd>0?fmt(r.dd):'—'}</td>
                            <td style={{padding:'6px 10px'}}>
                              <div style={{height:6,background:'#f5f5f3',borderRadius:3,overflow:'hidden'}}>
                                <div style={{height:'100%',borderRadius:3,width:`${barPct}%`,background:isPeak?'#f59e0b':r.isBacklogHour?'#fbbf24':'#378ADD'}}></div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {/* Totals row */}
                    <tfoot>
                      <tr style={{background:'#f0f4ff',borderTop:'1.5px solid #c7d2fe',fontWeight:700}}>
                        <td style={{padding:'8px 10px',fontSize:12,color:'#3730a3'}}>Σύνολο ημέρας</td>
                        <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',color:'#378ADD',fontSize:13}}>{fmt(totalDD)}</td>
                        {selForecast.intraday>0&&<td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',color:'#7F77DD',fontSize:13}}>{fmt(totalID)}</td>}
                        <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',color:'#1a1a1a',fontSize:13}}>{fmt(totalAll)}</td>
                        <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',color:'#D85A30',fontSize:11}}>{fmt(totalDD)}</td>
                        <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',color:'#b45309',fontSize:13}}>{fmt(backlog)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            !selectedDay && (
              <div style={{background:'white',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'60px 24px',textAlign:'center',color:'#9ca3af'}}>
                <div style={{fontSize:32,marginBottom:12}}>📅</div>
                <div style={{fontSize:14}}>Επίλεξε μία ημέρα από το ημερολόγιο</div>
                <div style={{fontSize:12,marginTop:4}}>για να δεις την ωριαία πρόβλεψη παραγγελιών</div>
              </div>
            )
          )}

        </div>
      </div>
    </div>
  )
}
