import { Link } from 'react-router-dom'
import { useAppStore } from '@/store'
import { formatTTE } from '@/lib/engine'

export function OpsSnapshotPanel() {
  const ops = useAppStore(s => s.latestOpsSnapshot)
  const engineResult = useAppStore(s => s.engineResult)

  if (!ops) {
    return (
      <div style={{ background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', padding:16 }}>
        <div style={{ fontSize:12, fontWeight:500, marginBottom:8 }}>📸 Ops Snapshot</div>
        <p style={{ fontSize:11, color:'#9ca3af', marginBottom:12 }}>Δεν υπάρχει snapshot.</p>
        <Link to="/ops" style={{ display:'block', textAlign:'center', background:'#1a1a1a', color:'white', padding:'8px', borderRadius:8, fontSize:11, textDecoration:'none' }}>
          Καταγραφή →
        </Link>
      </div>
    )
  }

  const pickerRC = engineResult?.role_capacity.find(r => r.role === 'picker')
  const packerRC = engineResult?.role_capacity.find(r => r.role === 'packer')
  const sorterRC = engineResult?.role_capacity.find(r => r.role === 'sorter')

  return (
    <div style={{ background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', overflow:'hidden' }}>
      <div style={{ padding:'10px 14px', borderBottom:'0.5px solid #f5f5f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:12, fontWeight:500 }}>📸 Ops Snapshot</span>
        <span style={{ fontSize:10, color:'#9ca3af' }}>{new Date(ops.recorded_at).toLocaleTimeString('el-GR', { hour:'2-digit', minute:'2-digit' })}</span>
      </div>
      <div style={{ padding:'10px 14px' }}>
        {[
          { label:'Pending Picking', val:ops.pending_picking, tte:pickerRC?.tte_minutes, color:'#3b82f6' },
          { label:'Pending Packing', val:ops.pending_packing, tte:packerRC?.tte_minutes, color:'#22c55e' },
          { label:'Pending Sorting', val:ops.pending_sorting, tte:sorterRC?.tte_minutes, color:'#8b5cf6' },
        ].map(({ label, val, tte, color }) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'0.5px solid #f9f9f7' }}>
            <span style={{ fontSize:11, color:'#6b7280' }}>{label}</span>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:13, fontWeight:500, color, fontFamily:'monospace' }}>{val.toLocaleString()}</div>
              {tte !== null && tte !== undefined && (
                <div style={{ fontSize:9, color: tte<30?'#22c55e':tte<60?'#f59e0b':'#ef4444' }}>TTE {formatTTE(tte)}</div>
              )}
            </div>
          </div>
        ))}
        <div style={{ marginTop:10 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>Υπόλοιπα SLA</div>
          {[
            { label:'Due Date → 19:00', val:ops.remaining_due_date, color:'#3b82f6' },
            { label:'Intraday → 01:30', val:ops.remaining_intraday, color:'#8b5cf6' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0' }}>
              <span style={{ fontSize:10, color:'#9ca3af' }}>{label}</span>
              <span style={{ fontSize:12, fontWeight:500, color, fontFamily:'monospace' }}>{val.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <Link to="/ops" style={{ display:'block', textAlign:'center', border:'0.5px solid #e5e5e5', color:'#6b7280', padding:'7px', borderRadius:8, fontSize:11, textDecoration:'none', marginTop:10 }}>
          + Ενημέρωση
        </Link>
      </div>
    </div>
  )
}

