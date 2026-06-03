import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import { useUpsertForecast } from '@/hooks'
import toast from 'react-hot-toast'

const S = {
  page: { display:'flex', flexDirection:'column' as const, height:'100%', overflow:'hidden', background:'#f5f5f0', fontFamily:'Inter,sans-serif' },
  header: { background:'white', borderBottom:'0.5px solid #e5e5e5', padding:'16px 24px', flexShrink:0 },
  content: { flex:1, overflowY:'auto' as const, padding:20 },
  card: { background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', marginBottom:16 },
  cardHeader: { padding:'14px 18px', borderBottom:'0.5px solid #f5f5f0', fontSize:13, fontWeight:500 },
  row: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'0.5px solid #f9f9f7' },
  input: { border:'0.5px solid #e5e5e5', borderRadius:8, padding:'8px 12px', fontSize:18, fontWeight:500, width:140, textAlign:'right' as const, fontFamily:'monospace', outline:'none' },
  btn: { background:'#1a1a1a', color:'white', border:'none', padding:'10px 24px', borderRadius:20, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'Inter,sans-serif' },
}

export function ForecastPage() {
  const forecast = useAppStore(s => s.todayForecast)
  const engineResult = useAppStore(s => s.engineResult)
  const upsert = useUpsertForecast()

  const [form, setForm] = useState({
    due_date_orders: forecast?.due_date_orders ?? 0,
    intraday_orders: forecast?.intraday_orders ?? 0,
  })

  useEffect(() => {
    if (forecast) setForm({ due_date_orders: forecast.due_date_orders, intraday_orders: forecast.intraday_orders })
  }, [forecast?.id])

  const total = form.due_date_orders + form.intraday_orders

  async function handleSave() {
    try {
      await upsert.mutateAsync(form)
      toast.success('Forecast αποθηκεύτηκε')
    } catch { toast.error('Αποτυχία') }
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Planning</div>
        <div style={{ fontSize:24, fontWeight:500 }}>Forecast</div>
        <div style={{ fontSize:13, color:'#9ca3af', marginTop:4 }}>{new Date().toLocaleDateString('el-GR', { weekday:'long', day:'numeric', month:'long' })}</div>
      </div>

      <div style={S.content}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div>
            <div style={S.card}>
              <div style={S.cardHeader}>📦 Παραγγελίες Ημέρας</div>
              <div style={S.row}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:'#3b82f6' }}>Due Date</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>Cutoff → 19:00</div>
                </div>
                <input type="number" min={0} value={form.due_date_orders}
                  onChange={e => setForm(p => ({ ...p, due_date_orders: Math.max(0, parseInt(e.target.value)||0) }))}
                  style={{ ...S.input, color:'#3b82f6' }} />
              </div>
              <div style={S.row}>
                <div>
                  <div style={{ fontSize:13, fontWeight:500, color:'#8b5cf6' }}>Intraday</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>Cutoff → 01:30</div>
                </div>
                <input type="number" min={0} value={form.intraday_orders}
                  onChange={e => setForm(p => ({ ...p, intraday_orders: Math.max(0, parseInt(e.target.value)||0) }))}
                  style={{ ...S.input, color:'#8b5cf6' }} />
              </div>
              <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>Σύνολο</div>
                  <div style={{ fontSize:22, fontWeight:500 }}>{total.toLocaleString()}</div>
                </div>
                <button onClick={handleSave} disabled={upsert.isPending} style={S.btn}>
                  {upsert.isPending ? 'Αποθήκευση...' : 'Αποθήκευση'}
                </button>
              </div>
            </div>
          </div>

          <div>
            <div style={S.card}>
              <div style={S.cardHeader}>👥 Απαιτούμενη Στελέχωση</div>
              {engineResult ? engineResult.role_capacity.map(rc => (
                <div key={rc.role} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 18px', borderBottom:'0.5px solid #f9f9f7' }}>
                  <span style={{ fontSize:13, textTransform:'capitalize' }}>{rc.role}</span>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:12, color:'#9ca3af' }}>{rc.active_count} active</span>
                    <span style={{ fontSize:13, fontWeight:500, color: rc.active_count >= rc.required_count ? '#22c55e' : '#ef4444', fontFamily:'monospace' }}>
                      {rc.required_count} needed
                    </span>
                  </div>
                </div>
              )) : (
                <div style={{ padding:'24px', textAlign:'center', fontSize:12, color:'#9ca3af' }}>Αποθήκευσε forecast για υπολογισμό</div>
              )}
            </div>

            {engineResult && (
              <div style={S.card}>
                <div style={S.cardHeader}>🎯 SLA Risk</div>
                {[
                  { type: 'due_date', label:'Due Date → 19:00', color:'#3b82f6' },
                  { type: 'intraday', label:'Intraday → 01:30', color:'#8b5cf6' },
                ].map(({ type, label, color }) => {
                  const risk = engineResult.sla_risk[type as keyof typeof engineResult.sla_risk] ?? 0
                  const pct = Math.round(risk * 100)
                  return (
                    <div key={type} style={{ padding:'12px 18px', borderBottom:'0.5px solid #f9f9f7' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:12 }}>
                        <span style={{ color:'#6b7280' }}>{label}</span>
                        <span style={{ fontWeight:500, color }}>{pct}%</span>
                      </div>
                      <div style={{ height:3, background:'#f0f0f0', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:2 }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

