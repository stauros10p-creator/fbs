import type { RoleCapacity } from '@/types'
import { ROLE_CONFIG } from '@/types'

function formatTTE(minutes: number | null): string {
  if (minutes === null || minutes >= 9999) return '—'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  ok:       { label: 'OK',       color: '#16a34a', bg: '#f0fdf4' },
  watch:    { label: 'WATCH',    color: '#f59e0b', bg: '#fffbeb' },
  risk:     { label: 'RISK',     color: '#f97316', bg: '#fff7ed' },
  critical: { label: 'CRITICAL', color: '#ef4444', bg: '#fef2f2' },
  surplus:  { label: 'SURPLUS',  color: '#3b82f6', bg: '#eff6ff' },
}

export function AllocationTable({ roleCapacity }: { roleCapacity: RoleCapacity[] }) {
  if (!roleCapacity.length) return null

  return (
    <div style={{ background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', overflow:'hidden' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead>
          <tr style={{ background:'#f9f9f7' }}>
            {['Ρόλος','Active','Needed','Queue','Cap/hr','TTE','Status'].map(h => (
              <th key={h} style={{ textAlign:'left', padding:'8px 14px', fontSize:10, color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, borderBottom:'0.5px solid #f0f0f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {roleCapacity.map(rc => {
            const cfg = ROLE_CONFIG[rc.role]
            const st = STATUS_STYLES[rc.status] ?? STATUS_STYLES.ok
            return (
              <tr key={rc.role} style={{ borderBottom:'0.5px solid #f9f9f7' }}>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:cfg.color, flexShrink:0 }}/>
                    <span style={{ fontWeight:500, color:cfg.color }}>{cfg.label}</span>
                  </div>
                </td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontWeight:500 }}>{rc.active_count}</td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', color:'#9ca3af' }}>{rc.required_count}</td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', color:'#3b82f6' }}>{rc.queue_depth?.toLocaleString() ?? '—'}</td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', color:'#6b7280' }}>{rc.effective_capacity_per_hour > 0 ? `${rc.effective_capacity_per_hour.toLocaleString()}` : '—'}</td>
                <td style={{ padding:'10px 14px', fontFamily:'monospace', color: rc.tte_minutes && rc.tte_minutes < 30 ? '#22c55e' : rc.tte_minutes && rc.tte_minutes < 60 ? '#f59e0b' : '#ef4444' }}>
                  {formatTTE(rc.tte_minutes)}
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:20 }}>{st.label}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
