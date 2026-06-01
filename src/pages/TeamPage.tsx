import { useState } from 'react'
import { Search, Plus, Coffee, UserX } from 'lucide-react'
import { useAppStore } from '@/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { RoleBadge, StatusBadge } from '@/components/ui/Badge'
import { ROLE_CONFIG, STATUS_CONFIG, SKILL_LABELS } from '@/types'
import type { Employee, EmployeeRole, EmployeeStatus } from '@/types'
import { initials, cn } from '@/lib/utils'
import { useUpdateEmployeeStatus, useRequestBreak } from '@/hooks'
import { EmployeeModal } from '@/components/team/EmployeeModal'
import toast from 'react-hot-toast'

const STATUS_TABS: { key: 'all' | EmployeeStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'working', label: 'Working' },
  { key: 'break', label: 'Break' },
  { key: 'sick', label: 'Sick' },
  { key: 'vacation', label: 'Vacation' },
  { key: 'off', label: 'Off' },
]

export function TeamPage() {
  const employees = useAppStore(s => s.employees)
  const [tab, setTab] = useState<'all' | EmployeeStatus>('all')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<EmployeeRole | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)

  const updateStatus = useUpdateEmployeeStatus()
  const requestBreak = useRequestBreak()

  const filtered = employees.filter(e => {
    if (tab !== 'all' && e.current_status !== tab) return false
    if (roleFilter !== 'all' && e.primary_role !== roleFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return e.full_name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q)
    }
    return true
  })

  // Stats
  const byStatus = (s: EmployeeStatus) => employees.filter(e => e.current_status === s).length

  async function handleBreakRequest(emp: Employee) {
    try {
      await requestBreak.mutateAsync({ employee_id: emp.id })
      toast.success(`Break requested for ${emp.full_name}`)
    } catch {
      toast.error('Failed to request break')
    }
  }

  async function handleMarkSick(emp: Employee) {
    if (!confirm(`Mark ${emp.full_name} as sick?`)) return
    await updateStatus.mutateAsync({ id: emp.id, status: 'sick' })
    toast.success(`${emp.full_name} marked as sick`)
  }

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Workforce"
        title="TEAM"
        subtitle={`${employees.length} employees · ${byStatus('working')} working`}
        actions={
          <button onClick={() => { setEditEmployee(null); setShowModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        }
      />

      <div className="p-8">
        {/* Status summary */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          {[
            { status: 'working', color: 'text-success', label: 'Working' },
            { status: 'break',   color: 'text-yellow', label: 'Break' },
            { status: 'sick',    color: 'text-red',    label: 'Sick' },
            { status: 'vacation',color: 'text-blue',   label: 'Vacation' },
            { status: 'off',     color: 'text-muted',  label: 'Off' },
            { status: 'redeployed', color: 'text-info', label: 'Redeployed' },
          ].map(({ status, color, label }) => (
            <div key={status} className="panel text-center cursor-pointer hover:border-border2" onClick={() => setTab(status as EmployeeStatus)}>
              <div className={cn('font-mono text-2xl font-bold', color)}>
                {employees.filter(e => e.current_status === status).length}
              </div>
              <div className="text-xs text-muted mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-5">
          {/* Status tabs */}
          <div className="flex gap-1 bg-surface2 border border-border rounded-lg p-1">
            {STATUS_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-semibold transition-all',
                  tab === key ? 'bg-success text-bg' : 'text-muted hover:text-slate-200',
                )}
              >
                {label} ({key === 'all' ? employees.length : employees.filter(e => e.current_status === key).length})
              </button>
            ))}
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as EmployeeRole | 'all')}
            className="input w-40 text-xs"
          >
            <option value="all">All Roles</option>
            {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
              <option key={role} value={role}>{cfg.label}</option>
            ))}
          </select>

          {/* Search */}
          <div className="flex-1 relative max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or code…"
              className="input pl-8 text-xs"
            />
          </div>

          <div className="ml-auto text-xs text-muted">{filtered.length} shown</div>
        </div>

        {/* Employee table */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface2 border-b border-border">
              <tr>
                {['Employee', 'Code', 'Primary Role', 'Secondary', 'Skill', 'Status', 'Productivity', 'Actions'].map(h => (
                  <th key={h} className="text-left font-mono text-[10px] tracking-widest text-muted uppercase px-4 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(emp => {
                const cfg = STATUS_CONFIG[emp.current_status]
                const primaryProd = emp.productivity?.find(p => p.role === emp.primary_role)

                return (
                  <tr key={emp.id} className="hover:bg-surface2/50 transition-colors">
                    {/* Name + avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono flex-shrink-0"
                          style={{
                            background: `${ROLE_CONFIG[emp.primary_role].color}15`,
                            color: ROLE_CONFIG[emp.primary_role].color,
                            border: `1px solid ${ROLE_CONFIG[emp.primary_role].color}30`,
                          }}
                        >
                          {initials(emp.full_name)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200">{emp.full_name}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-muted">{emp.employee_code}</td>

                    <td className="px-4 py-3"><RoleBadge role={emp.primary_role} /></td>

                    <td className="px-4 py-3">
                      {emp.secondary_role ? <RoleBadge role={emp.secondary_role} /> : <span className="text-muted text-xs">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-xs text-muted">{SKILL_LABELS[emp.skill_level]}</div>
                      <div className="flex gap-0.5 mt-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div
                            key={n}
                            className={cn('w-2 h-2 rounded-sm', parseInt(emp.skill_level) >= n ? 'bg-success' : 'bg-surface3')}
                          />
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                        <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {primaryProd ? `${primaryProd.units_per_hour}/hr` : 'default'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditEmployee(emp); setShowModal(true) }}
                          className="btn-secondary text-xs py-1 px-2"
                        >
                          Edit
                        </button>
                        {emp.current_status === 'working' && (
                          <button
                            onClick={() => handleBreakRequest(emp)}
                            className="p-1.5 rounded text-muted hover:text-yellow hover:bg-yellow/10 transition-colors"
                            title="Request break"
                          >
                            <Coffee className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {emp.current_status === 'working' && (
                          <button
                            onClick={() => handleMarkSick(emp)}
                            className="p-1.5 rounded text-muted hover:text-red hover:bg-red/10 transition-colors"
                            title="Mark sick"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted text-sm">
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <EmployeeModal
          employee={editEmployee}
          onClose={() => { setShowModal(false); setEditEmployee(null) }}
        />
      )}
    </div>
  )
}
