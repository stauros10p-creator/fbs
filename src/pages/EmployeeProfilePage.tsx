import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, Coffee, UserX } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { useAppStore } from '@/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { RoleBadge, StatusBadge } from '@/components/ui/Badge'
import {
  ROLE_CONFIG, STATUS_CONFIG, SKILL_LABELS, SKILL_MULTIPLIERS,
} from '@/types'
import type { EmployeeRole } from '@/types'
import { initials, cn } from '@/lib/utils'
import {
  useEmployeeShifts,
  useUpdateEmployeeStatus,
  useRequestBreak,
} from '@/hooks'
import { EmployeeModal } from '@/components/team/EmployeeModal'
import toast from 'react-hot-toast'

// ── helpers ────────────────────────────────────────────────────────────────

function SkillPips({ level }: { level: string }) {
  const n = parseInt(level)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={cn(
            'w-3 h-3 rounded-sm',
            n >= i ? 'bg-success' : 'bg-surface3',
          )}
        />
      ))}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[10px] tracking-widest text-muted uppercase mb-3">
      {children}
    </h3>
  )
}

// Custom tooltip for recharts
function UphTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { role: string } }[] }) {
  if (!active || !payload?.length) return null
  const { role } = payload[0].payload
  const cfg = ROLE_CONFIG[role as EmployeeRole]
  return (
    <div className="bg-surface border border-border2 rounded px-3 py-2 text-xs">
      <div className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</div>
      <div className="text-slate-200 font-mono">{payload[0].value} UPH</div>
    </div>
  )
}

// ── component ──────────────────────────────────────────────────────────────

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const employees = useAppStore(s => s.employees)
  const emp = employees.find(e => e.id === id)

  const [showModal, setShowModal] = useState(false)
  const updateStatus = useUpdateEmployeeStatus()
  const requestBreak = useRequestBreak()
  const { data: shifts, isLoading: shiftsLoading } = useEmployeeShifts(id, 30)

  if (!emp) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted text-sm">Employee not found</div>
          <button onClick={() => navigate('/team')} className="btn-secondary mt-4 text-xs">
            Back to Team
          </button>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[emp.current_status]
  const roleCfg = ROLE_CONFIG[emp.primary_role]

  // UPH chart data — show all roles with recorded productivity
  const uphData = (emp.productivity ?? [])
    .slice()
    .sort((a, b) => b.units_per_hour - a.units_per_hour)
    .map(p => ({
      role: p.role,
      uph: p.units_per_hour,
      label: ROLE_CONFIG[p.role].label,
    }))

  // Roles summary
  const roles = [
    { label: 'Primary', role: emp.primary_role },
    ...(emp.secondary_role ? [{ label: 'Secondary', role: emp.secondary_role }] : []),
    ...(emp.tertiary_role ? [{ label: 'Tertiary', role: emp.tertiary_role }] : []),
  ] as { label: string; role: EmployeeRole }[]

  async function handleBreakRequest() {
    try {
      await requestBreak.mutateAsync({ employee_id: emp!.id })
      toast.success(`Break requested for ${emp!.full_name}`)
    } catch {
      toast.error('Failed to request break')
    }
  }

  async function handleMarkSick() {
    if (!confirm(`Mark ${emp!.full_name} as sick?`)) return
    await updateStatus.mutateAsync({ id: emp!.id, status: 'sick' })
    toast.success(`${emp!.full_name} marked as sick`)
  }

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Workforce"
        title="EMPLOYEE PROFILE"
        subtitle={`${emp.employee_code} · ${emp.full_name}`}
        actions={
          <div className="flex items-center gap-2">
            {emp.current_status === 'working' && (
              <>
                <button
                  onClick={handleBreakRequest}
                  className="btn-secondary flex items-center gap-1.5 text-xs"
                  title="Request break"
                >
                  <Coffee className="w-3.5 h-3.5" /> Break
                </button>
                <button
                  onClick={handleMarkSick}
                  className="btn-secondary flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300"
                  title="Mark sick"
                >
                  <UserX className="w-3.5 h-3.5" /> Sick
                </button>
              </>
            )}
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary flex items-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {/* Back link */}
        <button
          onClick={() => navigate('/team')}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Team
        </button>

        {/* ── Hero card ─────────────────────────────────────────────── */}
        <div className="card p-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold font-mono flex-shrink-0"
              style={{
                background: `${roleCfg.color}15`,
                color: roleCfg.color,
                border: `1px solid ${roleCfg.color}30`,
              }}
            >
              {initials(emp.full_name)}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-100">{emp.full_name}</h1>
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', statusCfg.dot)} />
                  <span className={cn('text-xs font-semibold', statusCfg.color)}>{statusCfg.label}</span>
                </div>
              </div>
              <div className="font-mono text-sm text-muted mt-0.5">{emp.employee_code}</div>

              {/* Roles */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {roles.map(({ label, role }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted font-mono uppercase tracking-wider">{label}</span>
                    <RoleBadge role={role} />
                  </div>
                ))}
              </div>
            </div>

            {/* Skill level */}
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-muted mb-1.5">Skill Level</div>
              <div className="text-lg font-bold text-slate-200">{SKILL_LABELS[emp.skill_level]}</div>
              <SkillPips level={emp.skill_level} />
              <div className="text-xs text-muted mt-1.5 font-mono">
                ×{SKILL_MULTIPLIERS[emp.skill_level].toFixed(1)} multiplier
              </div>
            </div>
          </div>
        </div>

        {/* ── Main grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-5 gap-6">

          {/* UPH chart — 3 cols */}
          <div className="col-span-3 card p-6">
            <SectionTitle>Productivity (UPH per role)</SectionTitle>
            {uphData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted text-sm">
                No productivity data recorded
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={uphData} barSize={32} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<UphTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="uph" radius={[4, 4, 0, 0]}>
                    {uphData.map((entry) => (
                      <Cell
                        key={entry.role}
                        fill={ROLE_CONFIG[entry.role as EmployeeRole].color}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* UPH detail rows */}
            {uphData.length > 0 && (
              <div className="mt-4 divide-y divide-border/40">
                {uphData.map(entry => {
                  const cfg = ROLE_CONFIG[entry.role as EmployeeRole]
                  return (
                    <div key={entry.role} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-sm" style={{ background: cfg.color }} />
                        <span className="text-xs text-slate-300">{cfg.label}</span>
                      </div>
                      <span className="font-mono text-xs text-slate-200">{entry.uph} <span className="text-muted">UPH</span></span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Roles + skill detail — 2 cols */}
          <div className="col-span-2 space-y-4">
            {/* Role assignments */}
            <div className="card p-5">
              <SectionTitle>Role Assignments</SectionTitle>
              <div className="space-y-3">
                {roles.map(({ label, role }) => {
                  const cfg = ROLE_CONFIG[role]
                  const prod = emp.productivity?.find(p => p.role === role)
                  return (
                    <div
                      key={label}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: `${cfg.color}08`, border: `1px solid ${cfg.color}20` }}
                    >
                      <div>
                        <div className="text-[10px] text-muted font-mono uppercase tracking-wider mb-1">{label}</div>
                        <div className="font-semibold text-sm" style={{ color: cfg.color }}>{cfg.label}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm text-slate-200">
                          {prod ? `${prod.units_per_hour}` : '—'}
                        </div>
                        <div className="text-[10px] text-muted">UPH</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Quick stats */}
            <div className="card p-5">
              <SectionTitle>Quick Stats</SectionTitle>
              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Roles trained</span>
                  <span className="font-mono text-slate-200">{roles.length}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Productivity records</span>
                  <span className="font-mono text-slate-200">{emp.productivity?.length ?? 0}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Recent shifts</span>
                  <span className="font-mono text-slate-200">{shifts?.length ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted">Member since</span>
                  <span className="font-mono text-slate-200">
                    {new Date(emp.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Shift history ─────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <SectionTitle>Shift History</SectionTitle>
            <span className="text-xs text-muted font-mono">Last 30 shifts</span>
          </div>
          {shiftsLoading ? (
            <div className="px-6 py-10 text-center text-muted text-sm">Loading shifts…</div>
          ) : !shifts?.length ? (
            <div className="px-6 py-10 text-center text-muted text-sm">No shifts recorded</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface2 border-b border-border">
                <tr>
                  {['Date', 'Role', 'Start', 'End', 'Duration'].map(h => (
                    <th
                      key={h}
                      className="text-left font-mono text-[10px] tracking-widest text-muted uppercase px-5 py-3 font-normal"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {shifts.map(shift => {
                  const cfg = ROLE_CONFIG[shift.assigned_role]
                  const start = shift.start_time.slice(0, 5)
                  const end = shift.end_time.slice(0, 5)
                  // compute duration in hours
                  const [sh, sm] = start.split(':').map(Number)
                  const [eh, em] = end.split(':').map(Number)
                  const mins = (eh * 60 + em) - (sh * 60 + sm)
                  const dur = mins > 0 ? `${(mins / 60).toFixed(1)}h` : '—'
                  return (
                    <tr key={shift.id} className="hover:bg-surface2/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-slate-300">
                        {new Date(shift.shift_date).toLocaleDateString('el-GR', {
                          weekday: 'short', day: '2-digit', month: 'short',
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <RoleBadge role={shift.assigned_role} />
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted">{start}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted">{end}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted">{dur}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <EmployeeModal
          employee={emp}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
