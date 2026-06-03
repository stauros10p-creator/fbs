import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import { useCreateOpsSnapshot, useOpsHistory } from '@/hooks'
import { formatTTE } from '@/lib/engine'
import { formatTime } from '@/lib/utils'
import toast from 'react-hot-toast'

const S = {
  page: { display:'flex', flexDirection:'column' as const, height:'100%', overflow:'hidden', background:'#f5f5f0', fontFamily:'Inter,sans-serif' },
  header: { background:'white', borderBottom:'0.5px solid #e5e5e5', padding:'16px 24px', flexShrink:0 },
  content: { flex:1, overflowY:'auto' as const, padding:20 },
  card: { background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', marginBottom:14 },
  row: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 18px', borderBottom:'0.5px solid #f9f9f7' },
  input: { border:'0.5px solid #e5e5e5', borderRadius:8, padding:'8px 12px', fontSize:18, fontWeight:500, width:130, textAlign:'right' as const, fontFamily:'monospace', outline:'none' },
  btn: { background:'#1a1a1a', color:'white', border:'none', padding:'12px', borderRadius:10, fontSize:13, fontWeight:500, cursor:'pointer', width:'100%', fontFamily:'Inter,sans-serif' },
}

const QUEUE_FIELDS = [
  { key:'pending_picking',    label:'Pending Picking',    sub:'Orders στα pick stations',   color:'#3b82f6', role:'picker' },
  { key:'pending_packing',    label:'Pending Packing',    sub:'Orders στα pack stations',   color:'#22c55e', role:'packer' },
  { key:'pending_sorting',    label:'Pending Sorting',    sub:'Items στο sorting conveyor', color:'#8b5cf6', role:'sorter' },
]

const SLA_FIELDS = [
  { key:'remaining_due_date', label:'Remaining Due Date', sub:'Cutoff → 19:00',            color:'#3b82f6' },
  { key:'remaining_intraday', label:'Remaining Intraday', sub:'Cutoff → 01:30',            color:'#8b5cf6' },
]

export function OpsSnapshotPage() {
  const latestOps    = useAppStore(s => s.latestOpsSnapshot)
  const engineResult = useAppStore(s => s.engineResult)
  const forecast     = useAppStore(s => s.todayForecast)
  const { data: history = [] } = useOpsHistory(5)
  const createSnapshot = useCreateOpsSnapshot()

  const [form, setForm] = useState<Record<string,number>>({
    pending_picking:    latestOps?.pending_picking    ?? 0,
    pending_packing:    latestOps?.pending_packing    ?? 0,
    pending_sorting:    latestOps?.pending_sorting    ?? 0,
    remaining_due_date: latestOps?.remaining_due_date ?? forecast?.due_date_orders ?? 0,
    remaining_intraday: latestOps?.remaining_intraday ?? forecast?.intraday_orders ?? 0,
  })
  const [notes, setNotes] = useState(latestOps?.notes ?? '')

  useEffect(() => {
    if (latestOps) {
      setForm({
        pending_picking:    latestOps.pending_picking,
        pending_packing:    latestOps.pending_packing,
        pending_sorting:    latestOps.pending_sorting,
        remaining_due_date: latestOps.remaining_due_date,
        remaining_intraday: latestOps.remaining_intraday,
      })
      setNotes(latestOps.notes ?? '')
    }
  }, [latestOps?.id])

  function getTTE(role: string): number | null {
    return engineResult?.role_capacity.find(r => r.role === role)?.tte_minutes ?? null
  }

  async function handleSave() {
    try {
      await createSnapshot.mutateAsync({
        pending_picking:    form.pending_picking,
        pending_packing:    form.pending_packing,
        pending_sorting:    form.pending_sorting,
        remaining_due_date: form.remaining_due_date,
        remaining_intraday: form.remaining_intraday,
        notes: notes || undefined,
      })
      toast.success('Snapshot αποθηκεύτηκε!')
    } catch { toast.error('Αποτυχία αποθήκευσης') }
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 }}>Operations</div>
        <div style={{ fontSize:24, fontWeight:500 }}>Ops Snapshot</div>
        <div style={{ fontSize:13, color:'#9ca3af', marginTop:4 }}>Βάλε τα live νούμερα. Ο αλγόριθμος ανανεώνεται αυτόματα.</div>
      </div>

      <div style={S.content}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16 }}>
          <div>
            {/* Queue depths */}
            <div style={S.card}>
              <div style={{ padding:'12px 18px', borderBottom:'0.5px solid #f5f5f0', fontSize:13, fontWeight:500 }}>📦 Queue Depths</div>
              {QUEUE_FIELDS.map(f => {
                const tte = getTTE(f.role)
                return (
                  <div key={f.key} style={S.row}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:f.color }}>{f.label}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{f.sub}</div>
                      {tte !== null && (
                        <div style={{ fontSize:11, fontWeight:500, color:tte<30?'#22c55e':tte<60?'#f59e0b':'#ef4444', marginTop:2 }}>
                          TTE: {formatTTE(tte)}
                        </div>
                      )}
                    </div>
                    <input type="number" min={0} value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: Math.max(0, parseInt(e.target.value)||0) }))}
                      style={{ ...S.input, color:f.color }} />
                  </div>
                )
              })}
            </div>

            {/* SLA remaining */}
            <div style={S.card}>
              <div style={{ padding:'12px 18px', borderBottom:'0.5px solid #f5f5f0', fontSize:13, fontWeight:500 }}>🎯 Remaining by SLA</div>
              {SLA_FIELDS.map(f => (
                <div key={f.key} style={S.row}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:f.color }}>{f.label}</div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{f.sub}</div>
                  </div>
                  <input type="number" min={0} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: Math.max(0, parseInt(e.target.value)||0) }))}
                    style={{ ...S.input, color:f.color }} />
                </div>
              ))}
            </div>

            {/* Notes + Save */}
            <div style={S.card}>
              <div style={{ padding:'14px 18px' }}>
                <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Notes</div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="π.χ. AutoStore zone B αργό..."
                  rows={2} style={{ width:'100%', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'8px 12px', fontSize:12, fontFamily:'Inter,sans-serif', resize:'none', outline:'none', marginBottom:12 }} />
                {engineResult && (
                  <div style={{ background:'#f0fdf4', border:'0.5px solid #bbf7d0', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:11 }}>
                    <strong style={{ color:'#16a34a' }}>Preview: </strong>
                    <span style={{ color:'#15803d' }}>
                      Bottleneck: {engineResult.bottleneck_role ?? 'κανένα'} · Risk: {Math.round(engineResult.overall_risk*100)}% · {engineResult.suggestions.length} προτάσεις
                    </span>
                  </div>
                )}
                <button onClick={handleSave} disabled={createSnapshot.isPending} style={S.btn}>
                  {createSnapshot.isPending ? 'Αποθήκευση...' : '💾 Αποθήκευση & Ανανέωση'}
                </button>
              </div>
            </div>
          </div>

          {/* History */}
          <div>
            <div style={S.card}>
              <div style={{ padding:'12px 14px', borderBottom:'0.5px solid #f5f5f0', fontSize:13, fontWeight:500 }}>📋 Ιστορικό</div>
              {history.map((snap, i) => (
                <div key={snap.id} onClick={() => setForm({
                  pending_picking:    snap.pending_picking,
                  pending_packing:    snap.pending_packing,
                  pending_sorting:    snap.pending_sorting,
                  remaining_due_date: snap.remaining_due_date,
                  remaining_intraday: snap.remaining_intraday,
                })}
                  style={{ padding:'10px 12px', borderBottom:'0.5px solid #f9f9f7', cursor:'pointer', background: i===0?'#f9f9f7':'white' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:12, fontWeight:500, fontFamily:'monospace' }}>{formatTime(snap.recorded_at)}</span>
                    {i===0 && <span style={{ fontSize:9, color:'#3b82f6', fontWeight:600 }}>LATEST</span>}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:10, fontFamily:'monospace' }}>
                    <div><span style={{ color:'#9ca3af' }}>PK:</span> <span style={{ color:'#3b82f6' }}>{snap.pending_picking}</span></div>
                    <div><span style={{ color:'#9ca3af' }}>PA:</span> <span style={{ color:'#22c55e' }}>{snap.pending_packing}</span></div>
                    <div><span style={{ color:'#9ca3af' }}>SO:</span> <span style={{ color:'#8b5cf6' }}>{snap.pending_sorting}</span></div>
                  </div>
                </div>
              ))}
              {history.length === 0 && <div style={{ padding:'16px', textAlign:'center', fontSize:11, color:'#9ca3af' }}>Κανένα snapshot</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

