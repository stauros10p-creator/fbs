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

// DD hourly % — from real data (Total Orders - Intraday)
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
  for (let d = new Date('2026-05-31'); d <= end; d.setDate(d.getDate()+1)) {
    const key = d.toISOString().slice(0,10)
    const m = d.getMonth()+1
    const dow = (d.getDay()+6)%7
    const ddRow = DD_BASE[m] ?? DD_BASE[6]
    const idRow = INTRADAY_BASE[m] ?? INTRADAY_BASE[6]
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

function getHourDD(dateKey: string, hour: number): number {
  const f = FORECAST[dateKey] ?? {due_date:0, intraday:0}
  const dow = new Date(dateKey+'T12:00:00').getDay()
  const ddDist = DD_HOURLY[dow] ?? Array(24).fill(0)
  const ddSum = ddDist.reduce((a:number,b:number)=>a+b,0)
  return ddSum>0 ? Math.round(f.due_date * ddDist[hour]/ddSum) : 0
}

function getHourID(dateKey: string, hour: number): number {
  const f = FORECAST[dateKey] ?? {due_date:0, intraday:0}
  const dow = new Date(dateKey+'T12:00:00').getDay()
  const idDist = ID_HOURLY[dow] ?? Array(24).fill(0)
  const idSum = idDist.reduce((a:number,b:number)=>a+b,0)
  return idSum>0 ? Math.round(f.intraday * idDist[hour]/idSum) : 0
}

function prevDateKey(dateKey: string): string {
  const d = new Date(dateKey+'T12:00:00')
  d.setDate(d.getDate()-1)
  return d.toISOString().slice(0,10)
}

// Returns the full day breakdown:
// - prevEvening: hours 19-23 of PREVIOUS day (DD only = total - intraday)
// - morningBacklog: hours 00-06 of this day (DD)
// - coreDD: hours 07-18 of this day (DD)
// - intraday: hours 19-23 of this day (ID only)
function getDayBreakdown(dateKey: string) {
  const prev = prevDateKey(dateKey)

  const prevEvening = Array.from({length:5}, (_,i) => {
    const hr = 19+i
    const dd = getHourDD(prev, hr)
    const id = getHourID(prev, hr)
    return { hr: HOURS[hr], dd, id, backlog: dd, day: 'prev' as const }
  })

  const morningBacklog = Array.from({length:7}, (_,i) => {
    const dd = getHourDD(dateKey, i)
    return { hr: HOURS[i], dd, id: 0, backlog: dd, day: 'today' as const }
  })

  const coreDD = Array.from({length:12}, (_,i) => {
    const hr = 7+i
    const dd = getHourDD(dateKey, hr)
    return { hr: HOURS[hr], dd, id: 0, backlog: 0, day: 'today' as const }
  })

  const intradayRows = Array.from({length:5}, (_,i) => {
    const hr = 19+i
    const id = getHourID(dateKey, hr)
    const dd = getHourDD(dateKey, hr)
    return { hr: HOURS[hr], dd, id, backlog: 0, day: 'today' as const }
  })

  const backlogTotal = prevEvening.reduce((s,r)=>s+r.backlog,0) + morningBacklog.reduce((s,r)=>s+r.backlog,0)
  const coreDDTotal = coreDD.reduce((s,r)=>s+r.dd,0)
  const dueDateTotal = backlogTotal + coreDDTotal
  const intradayTotal = intradayRows.reduce((s,r)=>s+r.id,0)
  const grandTotal = dueDateTotal + intradayTotal

  return { prevEvening, morningBacklog, coreDD, intradayRows, backlogTotal, coreDDTotal, dueDateTotal, intradayTotal, grandTotal }
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

function getDayCalTotal(dateKey: string) {
  const f = FORECAST[dateKey]
  return f ? f.due_date+f.intraday : 0
}

export function HourlyForecastPage() {
  const navigate = useNavigate()
  const today = new Date()
  const initMonth = Math.min(12, Math.max(6, today.getMonth()+1))
  const [activeMonth, setActiveMonth] = useState(initMonth)
  const [selectedDay, setSelectedDay] = useState<string|null>(null)

  const year = 2026
  const days = getDaysInMonth(year, activeMonth)

  const breakdown = useMemo(() => selectedDay ? getDayBreakdown(selectedDay) : null, [selectedDay])
  const selDow = selectedDay ? new Date(selectedDay+'T12:00:00').getDay() : -1
  const prev = selectedDay ? prevDateKey(selectedDay) : ''

  const maxTotal = useMemo(() => {
    const vals = days.filter(Boolean).map(d => {
      const k = `${year}-${String(activeMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      return getDayCalTotal(k)
    })
    return Math.max(...vals, 1)
  }, [activeMonth, days])

  function exportToExcel() {
    if (!selectedDay || !breakdown) return
    const rows: object[] = []
    breakdown.prevEvening.forEach(r => rows.push({'Ώρα': r.hr, 'Κατηγορία': 'Backlog από χθες βράδυ', 'DD': r.dd, 'Intraday': r.id, 'Backlog': r.backlog}))
    breakdown.morningBacklog.forEach(r => rows.push({'Ώρα': r.hr, 'Κατηγορία': 'Backlog πρωί', 'DD': r.dd, 'Intraday': 0, 'Backlog': r.backlog}))
    rows.push({'Ώρα': '—', 'Κατηγορία': 'ΣΥΝΟΛΟ BACKLOG', 'DD': '', 'Intraday': '', 'Backlog': breakdown.backlogTotal})
    breakdown.coreDD.forEach(r => rows.push({'Ώρα': r.hr, 'Κατηγορία': 'Due Date 07-19', 'DD': r.dd, 'Intraday': 0, 'Backlog': 0}))
    rows.push({'Ώρα': '—', 'Κατηγορία': 'DUE DATE ΣΥΝΟΛΟ', 'DD': breakdown.dueDateTotal, 'Intraday': '', 'Backlog': ''})
    breakdown.intradayRows.filter(r=>r.id>0).forEach(r => rows.push({'Ώρα': r.hr, 'Κατηγορία': 'Intraday', 'DD': 0, 'Intraday': r.id, 'Backlog': 0}))
    rows.push({'Ώρα': '—', 'Κατηγορία': 'ΣΥΝΟΛΟ ΑΠΟΘΗΚΗ', 'DD': breakdown.grandTotal, 'Intraday': '', 'Backlog': ''})
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{wch:12},{wch:26},{wch:10},{wch:10},{wch:10}]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, selectedDay)
    XLSX.writeFile(wb, `forecast_${selectedDay}.xlsx`)
  }

  const SectionHeader = ({label, bg, color}: {label:string; bg:string; color:string}) => (
    <tr>
      <td colSpan={5} style={{padding:'6px 10px',background:bg,color,fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>
        {label}
      </td>
    </tr>
  )

  const SubtotalRow = ({label, value, bg, color}: {label:string; value:number; bg:string; color:string}) => (
    <tr style={{background:bg,borderTop:`1.5px solid ${color}33`}}>
      <td colSpan={3} style={{padding:'8px 10px',fontWeight:700,color,fontSize:13}}>{label}</td>
      <td style={{padding:'8px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:700,color,fontSize:15}}>{fmt(value)}</td>
      <td></td>
    </tr>
  )

  return (
    <div style={{height:'100%',overflowY:'auto',background:'#f5f5f0',fontFamily:'Inter, sans-serif'}}>
      <div style={{padding:'20px 24px',maxWidth:1100,margin:'0 auto'}}>

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

        <div style={{display:'grid',gridTemplateColumns:selectedDay?'260px 1fr':'340px',gap:16,alignItems:'start'}}>

          {/* Calendar */}
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
                const total=getDayCalTotal(key)
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
                    {total>0&&<div style={{fontSize:9,color:isSel?'rgba(255,255,255,0.7)':intensity>0.6?'rgba(255,255,255,0.8)':'#6b7280',marginTop:1}}>
                      {total>=1000?`${(total/1000).toFixed(0)}k`:total}
                    </div>}
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

          {/* Detail panel */}
          {selectedDay && breakdown ? (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>

              {/* KPI cards */}
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
                  <div style={{display:'flex',gap:14,flexWrap:'wrap',alignItems:'stretch'}}>
                    <div style={{textAlign:'center',minWidth:72,background:'#f0fdf4',borderRadius:10,padding:'8px 12px',border:'0.5px solid #bbf7d0'}}>
                      <div style={{fontSize:10,color:'#15803d',textTransform:'uppercase',letterSpacing:0.3,fontWeight:600}}>Backlog</div>
                      <div style={{fontSize:11,color:'#9ca3af',marginBottom:2}}>από {DOW_GR[new Date(prev+'T12:00:00').getDay()]} 19:00</div>
                      <div style={{fontSize:22,fontWeight:700,color:'#15803d',fontFamily:'monospace',lineHeight:1.1}}>{fmt(breakdown.backlogTotal)}</div>
                    </div>
                    <div style={{textAlign:'center',minWidth:72,background:'#eff6ff',borderRadius:10,padding:'8px 12px',border:'0.5px solid #bfdbfe'}}>
                      <div style={{fontSize:10,color:'#1d4ed8',textTransform:'uppercase',letterSpacing:0.3,fontWeight:600}}>Due Date</div>
                      <div style={{fontSize:11,color:'#9ca3af',marginBottom:2}}>Backlog + 07:00–19:00</div>
                      <div style={{fontSize:22,fontWeight:700,color:'#1d4ed8',fontFamily:'monospace',lineHeight:1.1}}>{fmt(breakdown.dueDateTotal)}</div>
                    </div>
                    {breakdown.intradayTotal>0&&(
                      <div style={{textAlign:'center',minWidth:72,background:'#f5f3ff',borderRadius:10,padding:'8px 12px',border:'0.5px solid #ddd6fe'}}>
                        <div style={{fontSize:10,color:'#7c3aed',textTransform:'uppercase',letterSpacing:0.3,fontWeight:600}}>Intraday</div>
                        <div style={{fontSize:11,color:'#9ca3af',marginBottom:2}}>19:00–24:00</div>
                        <div style={{fontSize:22,fontWeight:700,color:'#7c3aed',fontFamily:'monospace',lineHeight:1.1}}>{fmt(breakdown.intradayTotal)}</div>
                      </div>
                    )}
                    <div style={{textAlign:'center',minWidth:72,background:'#1a1a1a',borderRadius:10,padding:'8px 12px',border:'none'}}>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.6)',textTransform:'uppercase',letterSpacing:0.3,fontWeight:600}}>Σύνολο αποθήκη</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:2}}>Due Date + Intraday</div>
                      <div style={{fontSize:22,fontWeight:700,color:'white',fontFamily:'monospace',lineHeight:1.1}}>{fmt(breakdown.grandTotal)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed table */}
              <div style={{background:'white',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'16px 18px'}}>
                <div style={{fontSize:11,color:'#9ca3af',textTransform:'uppercase',letterSpacing:0.5,marginBottom:12}}>
                  Αναλυτικός Πίνακας
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                    <thead>
                      <tr style={{background:'#f9f9f7',borderBottom:'0.5px solid #e5e5e5'}}>
                        <th style={{textAlign:'left',padding:'6px 10px',color:'#9ca3af',fontWeight:500,width:100}}>Ώρα</th>
                        <th style={{textAlign:'left',padding:'6px 10px',color:'#9ca3af',fontWeight:500}}>Κατηγορία</th>
                        <th style={{textAlign:'right',padding:'6px 10px',color:'#378ADD',fontWeight:500}}>DD</th>
                        <th style={{textAlign:'right',padding:'6px 10px',color:'#1a1a1a',fontWeight:600}}>Παραγγελίες</th>
                        <th style={{padding:'6px 10px',width:100}}></th>
                      </tr>
                    </thead>
                    <tbody>

                      {/* SECTION 1: Backlog από χθες βράδυ */}
                      <SectionHeader label={`🌙 Backlog από ${DOW_GR[new Date(prev+'T12:00:00').getDay()]} 19:00–24:00`} bg="#f0fdf4" color="#15803d"/>
                      {breakdown.prevEvening.map(r => (
                        <tr key={'pe'+r.hr} style={{background:'#f7fdf8',borderBottom:'0.5px solid #f0f0f0'}}>
                          <td style={{padding:'5px 10px',fontFamily:'monospace',color:'#6b7280'}}>{r.hr}</td>
                          <td style={{padding:'5px 10px',color:'#9ca3af',fontSize:11}}>total − intraday ({r.dd} − {r.id})</td>
                          <td style={{padding:'5px 10px',textAlign:'right',fontFamily:'monospace',color:'#378ADD'}}>{r.dd>0?fmt(r.dd):'—'}</td>
                          <td style={{padding:'5px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:600,color:'#15803d'}}>{r.backlog>0?fmt(r.backlog):'—'}</td>
                          <td style={{padding:'5px 10px'}}>
                            <div style={{height:5,background:'#dcfce7',borderRadius:3}}>
                              <div style={{height:'100%',borderRadius:3,width:`${Math.round(r.backlog/breakdown.backlogTotal*100)}%`,background:'#4ade80'}}></div>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* SECTION 2: Backlog πρωί */}
                      <SectionHeader label="🌅 Backlog πρωί 00:00–07:00" bg="#f0fdf4" color="#15803d"/>
                      {breakdown.morningBacklog.map(r => (
                        <tr key={'mb'+r.hr} style={{background:'#f7fdf8',borderBottom:'0.5px solid #f0f0f0'}}>
                          <td style={{padding:'5px 10px',fontFamily:'monospace',color:'#6b7280'}}>{r.hr}</td>
                          <td style={{padding:'5px 10px',color:'#9ca3af',fontSize:11}}>overnight backlog</td>
                          <td style={{padding:'5px 10px',textAlign:'right',fontFamily:'monospace',color:'#378ADD'}}>{r.dd>0?fmt(r.dd):'—'}</td>
                          <td style={{padding:'5px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:600,color:'#15803d'}}>{r.backlog>0?fmt(r.backlog):'—'}</td>
                          <td style={{padding:'5px 10px'}}>
                            <div style={{height:5,background:'#dcfce7',borderRadius:3}}>
                              <div style={{height:'100%',borderRadius:3,width:`${Math.round(r.backlog/breakdown.backlogTotal*100)}%`,background:'#4ade80'}}></div>
                            </div>
                          </td>
                        </tr>
                      ))}

                      <SubtotalRow label={`Σύνολο Backlog (07:00 ξεκινά η αποθήκη)`} value={breakdown.backlogTotal} bg="#dcfce7" color="#15803d"/>

                      {/* SECTION 3: Core DD 07-19 */}
                      <SectionHeader label="📦 Due Date — νέες παραγγελίες 07:00–19:00" bg="#eff6ff" color="#1d4ed8"/>
                      {breakdown.coreDD.map(r => {
                        const pct = breakdown.coreDDTotal>0 ? Math.round(r.dd/breakdown.coreDDTotal*100) : 0
                        return (
                          <tr key={'cd'+r.hr} style={{background:'#f8faff',borderBottom:'0.5px solid #f0f0f0'}}>
                            <td style={{padding:'5px 10px',fontFamily:'monospace',color:'#6b7280'}}>{r.hr}</td>
                            <td style={{padding:'5px 10px',color:'#9ca3af',fontSize:11}}>DD παραγγελίες</td>
                            <td style={{padding:'5px 10px',textAlign:'right',fontFamily:'monospace',color:'#378ADD'}}>{r.dd>0?fmt(r.dd):'—'}</td>
                            <td style={{padding:'5px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:600,color:'#1d4ed8'}}>{r.dd>0?fmt(r.dd):'—'}</td>
                            <td style={{padding:'5px 10px'}}>
                              <div style={{height:5,background:'#dbeafe',borderRadius:3}}>
                                <div style={{height:'100%',borderRadius:3,width:`${pct}%`,background:'#3b82f6'}}></div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}

                      <SubtotalRow label={`Due Date ${DOW_GR[new Date(selectedDay+'T12:00:00').getDay()]} = Backlog (${fmt(breakdown.backlogTotal)}) + 07–19 (${fmt(breakdown.coreDDTotal)})`} value={breakdown.dueDateTotal} bg="#dbeafe" color="#1d4ed8"/>

                      {/* SECTION 4: Intraday 19-24 */}
                      {breakdown.intradayTotal>0&&(
                        <>
                          <SectionHeader label="⚡ Intraday 19:00–24:00" bg="#f5f3ff" color="#7c3aed"/>
                          {breakdown.intradayRows.filter(r=>r.id>0).map(r => (
                            <tr key={'id'+r.hr} style={{background:'#faf5ff',borderBottom:'0.5px solid #f0f0f0'}}>
                              <td style={{padding:'5px 10px',fontFamily:'monospace',color:'#6b7280'}}>{r.hr}</td>
                              <td style={{padding:'5px 10px',color:'#9ca3af',fontSize:11}}>same-day intraday</td>
                              <td style={{padding:'5px 10px',textAlign:'right',fontFamily:'monospace',color:'#9ca3af'}}>—</td>
                              <td style={{padding:'5px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:600,color:'#7c3aed'}}>{fmt(r.id)}</td>
                              <td style={{padding:'5px 10px'}}>
                                <div style={{height:5,background:'#ede9fe',borderRadius:3}}>
                                  <div style={{height:'100%',borderRadius:3,width:`${Math.round(r.id/breakdown.intradayTotal*100)}%`,background:'#8b5cf6'}}></div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </>
                      )}

                    </tbody>
                    <tfoot>
                      <tr style={{background:'#1a1a1a'}}>
                        <td colSpan={3} style={{padding:'10px 10px',fontWeight:700,color:'white',fontSize:13}}>
                          Σύνολο αποθήκη {DOW_GR[new Date(selectedDay+'T12:00:00').getDay()]}
                        </td>
                        <td style={{padding:'10px 10px',textAlign:'right',fontFamily:'monospace',fontWeight:700,color:'white',fontSize:16}}>
                          {fmt(breakdown.grandTotal)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Mini chart */}
              <div style={{background:'white',border:'0.5px solid #e5e5e5',borderRadius:12,padding:'16px 18px'}}>
                <div style={{fontSize:11,color:'#9ca3af',textTransform:'uppercase',letterSpacing:0.5,marginBottom:10}}>
                  Ωριαία Ροή (Backlog χθες + σήμερα)
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={[
                    ...breakdown.prevEvening.map(r=>({hr:r.hr,backlog:r.backlog,section:'prev'})),
                    ...breakdown.morningBacklog.map(r=>({hr:r.hr,backlog:r.backlog,section:'morning'})),
                    ...breakdown.coreDD.map(r=>({hr:r.hr,dd:r.dd,section:'core'})),
                    ...breakdown.intradayRows.map(r=>({hr:r.hr,id:r.id,section:'intra'})),
                  ]} barGap={0}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                    <XAxis dataKey="hr" tick={{fontSize:8,fill:'#9ca3af'}} axisLine={false} tickLine={false} interval={2} angle={-45} textAnchor="end" height={36}/>
                    <YAxis tick={{fontSize:9,fill:'#9ca3af'}} axisLine={false} tickLine={false} width={36} tickFormatter={(v)=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                    <Tooltip formatter={(v:number,n:string)=>[fmt(v), n==='backlog'?'Backlog':n==='dd'?'Due Date':'Intraday']}/>
                    <Bar dataKey="backlog" fill="#4ade80" stackId="a" radius={[2,2,0,0]}/>
                    <Bar dataKey="dd" fill="#3b82f6" stackId="a" radius={[2,2,0,0]}/>
                    <Bar dataKey="id" fill="#8b5cf6" stackId="a" radius={[2,2,0,0]}/>
                  </ComposedChart>
                </ResponsiveContainer>
                <div style={{display:'flex',gap:14,marginTop:6,fontSize:11,color:'#6b7280',flexWrap:'wrap'}}>
                  <span><span style={{display:'inline-block',width:10,height:10,background:'#4ade80',borderRadius:2,marginRight:4}}></span>Backlog</span>
                  <span><span style={{display:'inline-block',width:10,height:10,background:'#3b82f6',borderRadius:2,marginRight:4}}></span>Due Date 07–19</span>
                  {breakdown.intradayTotal>0&&<span><span style={{display:'inline-block',width:10,height:10,background:'#8b5cf6',borderRadius:2,marginRight:4}}></span>Intraday</span>}
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
