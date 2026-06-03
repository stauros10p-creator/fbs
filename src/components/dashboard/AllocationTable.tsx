import type { RoleCapacity } from '@/types' import { ROLE_CONFIG } from '@/types' function formatTTE(minutes: number | null): string { if (minutes === null || minutes >= 9999) return 'â€”' if (minutes < 60) return `${minutes}m` const h = Math.floor(minutes / 60) const m = minutes % 60 return m > 0 ? `${h}h ${m}m` : `${h}h` } const STATUS_STYLES: Record = { ok: { label: 'OK', color: '#16a34a', bg: '#f0fdf4' }, watch: { label: 'WATCH', color: '#f59e0b', bg: '#fffbeb' }, risk: { label: 'RISK', color: '#f97316', bg: '#fff7ed' }, critical: { label: 'CRITICAL', color: '#ef4444', bg: '#fef2f2' }, surplus: { label: 'SURPLUS', color: '#3b82f6', bg: '#eff6ff' }, } export function AllocationTable({ roleCapacity }: { roleCapacity: RoleCapacity[] }) { if (!roleCapacity.length) return null return ( 
{['Î¡ÏŒÎ»Î¿Ï‚','Active','Needed','Queue','Cap/hr','TTE','Status'].map(h => ( 
{h}
))} {roleCapacity.map(rc => { const cfg = ROLE_CONFIG[rc.role] const st = STATUS_STYLES[rc.status] ?? STATUS_STYLES.ok return ( 
{cfg.label} 	{rc.active_count}	{rc.required_count}	{rc.queue_depth?.toLocaleString() ?? 'â€”'}	{rc.effective_capacity_per_hour > 0 ? `${rc.effective_capacity_per_hour.toLocaleString()}` : 'â€”'}	< 30 ? '#22c55e' : rc.tte_minutes && rc.tte_minutes < 60 ? '#f59e0b' : '#ef4444' }}> {formatTTE(rc.tte_minutes)} 	{st.label} 
) })} 
) } 
