import { useState } from 'react'
import { X } from 'lucide-react'
import type { Employee, EmployeeRole, SkillLevel } from '@/types'
import { ROLE_CONFIG, SKILL_LABELS } from '@/types'
import { useUpsertEmployee, useDeleteEmployee } from '@/hooks'
import { WAREHOUSE_ID } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface EmployeeModalProps {
  employee: Employee | null
  onClose: () => void
}

const ROLES = Object.keys(ROLE_CONFIG) as EmployeeRole[]
const SKILLS = ['1', '2', '3', '4', '5'] as SkillLevel[]

export function EmployeeModal({ employee, onClose }: EmployeeModalProps) {
  const isNew = !employee
  const upsert = useUpsertEmployee()
  const deleteEmp = useDeleteEmployee()

  const [form, setForm] = useState({
    full_name: employee?.full_name ?? '',
    employee_code: employee?.employee_code ?? '',
    primary_role: employee?.primary_role ?? 'packer' as EmployeeRole,
    secondary_role: employee?.secondary_role ?? '' as EmployeeRole | '',
    tertiary_role: employee?.tertiary_role ?? '' as EmployeeRole | '',
    skill_level: employee?.skill_level ?? '3' as SkillLevel,
    current_status: employee?.current_status ?? 'working',
  })

  function set<K extends keyof typeof form>(key: K, val: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleSave() {
    if (!form.full_name || !form.employee_code) {
      toast.error('Name and employee code are required')
      return
    }
    try {
      await upsert.mutateAsync({
        ...(employee ? { id: employee.id } : {}),
        warehouse_id: WAREHOUSE_ID,
        full_name: form.full_name,
        employee_code: form.employee_code,
        primary_role: form.primary_role,
        secondary_role: form.secondary_role || null,
        tertiary_role: form.tertiary_role || null,
        skill_level: form.skill_level,
        current_status: form.current_status as Employee['current_status'],
      })
      toast.success(isNew ? 'Employee added' : 'Employee updated')
      onClose()
    } catch (e: unknown) {
      toast.error((e as Error).message ?? 'Save failed')
    }
  }

  async function handleDelete() {
    if (!employee) return
    if (!confirm(`Delete ${employee.full_name}? This cannot be undone.`)) return
    try {
      await deleteEmp.mutateAsync(employee.id)
      toast.success('Employee deleted')
      onClose()
    } catch {
      toast.error('Delete failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border2 rounded-xl w-full max-w-md shadow-2xl animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-sans font-bold tracking-tight text-2xl tracking-wide text-slate-100">
            {isNew ? 'ADD EMPLOYEE' : 'EDIT EMPLOYEE'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1.5">Full Name</label>
              <input
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                className="input"
                placeholder="Maria Papadopoulos"
              />
            </div>
            <div>
              <label className="label block mb-1.5">Employee Code</label>
              <input
                value={form.employee_code}
                onChange={e => set('employee_code', e.target.value.toUpperCase())}
                className="input font-mono"
                placeholder="PA010"
              />
            </div>
          </div>

          <div>
            <label className="label block mb-1.5">Primary Role</label>
            <select value={form.primary_role} onChange={e => set('primary_role', e.target.value as EmployeeRole)} className="input">
              {ROLES.map(r => <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1.5">Secondary Role</label>
              <select value={form.secondary_role} onChange={e => set('secondary_role', e.target.value as EmployeeRole | '')} className="input">
                <option value="">None</option>
                {ROLES.filter(r => r !== form.primary_role).map(r => (
                  <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label block mb-1.5">Tertiary Role</label>
              <select value={form.tertiary_role} onChange={e => set('tertiary_role', e.target.value as EmployeeRole | '')} className="input">
                <option value="">None</option>
                {ROLES.filter(r => r !== form.primary_role && r !== form.secondary_role).map(r => (
                  <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1.5">Skill Level</label>
              <select value={form.skill_level} onChange={e => set('skill_level', e.target.value as SkillLevel)} className="input">
                {SKILLS.map(s => <option key={s} value={s}>{s} — {SKILL_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-1.5">Status</label>
              <select value={form.current_status} onChange={e => set('current_status', e.target.value as Employee['current_status'])} className="input">
                {['working', 'break', 'sick', 'vacation', 'off'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex items-center justify-between">
          {!isNew ? (
            <button onClick={handleDelete} disabled={deleteEmp.isPending} className="btn-danger">
              Delete
            </button>
          ) : <div />}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={upsert.isPending} className="btn-primary">
              {upsert.isPending ? 'Saving…' : isNew ? 'Add Employee' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
