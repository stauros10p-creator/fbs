import { useState, useRef } from 'react'
import { Upload, Calendar, Download } from 'lucide-react'
import { useShifts, useUpsertShifts } from '@/hooks'
import { PageHeader } from '@/components/ui/PageHeader'
import { RoleBadge } from '@/components/ui/Badge'
import { WAREHOUSE_ID } from '@/lib/supabase'
import type { EmployeeRole } from '@/types'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

export function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const { data: shifts = [], isLoading } = useShifts(selectedDate)
  const upsertShifts = useUpsertShifts()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()
    const data = [
      ['employee_code', 'shift_date', 'start_time', 'end_time', 'assigned_role'],
      ['PA001', '2026-06-02', '08:00', '17:00', 'packer'],
      ['PK001', '2026-06-02', '08:00', '17:00', 'picker'],
      ['SO001', '2026-06-02', '08:00', '17:00', 'sorter'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Shifts')
    XLSX.writeFile(wb, 'shift_template.xlsx')
    toast.success('Template downloaded')
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)

      if (rows.length === 0) {
        toast.error('No data found in file')
        return
      }

      // Validate and transform
      const validRoles: EmployeeRole[] = ['operator', 'picker', 'packer', 'validator', 'sorter', 'transporter']
      const shifts = rows
        .filter(row => row.employee_code && row.shift_date && row.start_time && row.end_time && row.assigned_role)
        .map(row => ({
          employee_id: row.employee_id ?? '',  // Will be resolved by employee_code lookup
          warehouse_id: WAREHOUSE_ID,
          shift_date: row.shift_date,
          start_time: row.start_time,
          end_time: row.end_time,
          assigned_role: (validRoles.includes(row.assigned_role as EmployeeRole) ? row.assigned_role : 'packer') as EmployeeRole,
        }))

      toast(`Parsed ${shifts.length} shifts. Note: employee_id lookup requires backend resolver.`, { icon: 'ℹ️' })
    } catch (err) {
      toast.error('Failed to parse Excel file')
      console.error(err)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Week navigation
  const currentDate = new Date(selectedDate)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() - d.getDay() + i + 1)
    return d.toISOString().split('T')[0]
  })

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Planning"
        title="SCHEDULE"
        subtitle="Weekly shift schedule — view by day"
        actions={
          <div className="flex gap-2">
            <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> Template
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-primary flex items-center gap-2">
              <Upload className="w-3.5 h-3.5" /> {importing ? 'Importing…' : 'Import Excel'}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </div>
        }
      />

      <div className="p-8">
        {/* Week view */}
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-4 h-4 text-muted" />
          <div className="flex gap-1 bg-surface2 border border-border rounded-lg p-1">
            {weekDays.map(day => {
              const d = new Date(day)
              const isSelected = day === selectedDate
              const isToday = day === new Date().toISOString().split('T')[0]
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'px-3 py-2 rounded text-xs font-semibold transition-all',
                    isSelected ? 'bg-success text-bg'
                    : isToday ? 'text-success border border-success/30'
                    : 'text-muted hover:text-slate-200',
                  )}
                >
                  <div>{d.toLocaleDateString('en', { weekday: 'short' })}</div>
                  <div className="font-mono">{d.getDate()}</div>
                </button>
              )
            })}
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="input w-40 text-xs ml-2"
          />
        </div>

        {/* Shifts table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16 text-muted text-sm">Loading shifts…</div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No shifts scheduled for this day</p>
              <p className="text-xs mt-1">Import an Excel file to add shifts</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface2 border-b border-border">
                <tr>
                  {['Employee', 'Code', 'Start', 'End', 'Hours', 'Role'].map(h => (
                    <th key={h} className="text-left font-mono text-[10px] tracking-widest text-muted uppercase px-4 py-3 font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {shifts.map(shift => {
                  const start = shift.start_time
                  const end = shift.end_time
                  const [sh, sm] = start.split(':').map(Number)
                  const [eh, em] = end.split(':').map(Number)
                  const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60

                  return (
                    <tr key={shift.id} className="hover:bg-surface2/50">
                      <td className="px-4 py-3 font-medium text-slate-200">
                        {shift.employee?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {shift.employee?.employee_code ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{shift.start_time}</td>
                      <td className="px-4 py-3 font-mono text-xs">{shift.end_time}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{hours.toFixed(1)}h</td>
                      <td className="px-4 py-3"><RoleBadge role={shift.assigned_role} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Excel format info */}
        <div className="mt-6 panel bg-surface3/50">
          <div className="text-xs font-bold tracking-widest text-muted uppercase mb-3">Excel Import Format</div>
          <div className="overflow-x-auto">
            <table className="text-xs font-mono">
              <thead>
                <tr className="text-muted">
                  <th className="pr-6 pb-1 font-normal text-left">employee_code</th>
                  <th className="pr-6 pb-1 font-normal text-left">shift_date</th>
                  <th className="pr-6 pb-1 font-normal text-left">start_time</th>
                  <th className="pr-6 pb-1 font-normal text-left">end_time</th>
                  <th className="pr-6 pb-1 font-normal text-left">assigned_role</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-success">
                  <td className="pr-6">PA001</td>
                  <td className="pr-6">2026-06-02</td>
                  <td className="pr-6">08:00</td>
                  <td className="pr-6">17:00</td>
                  <td className="pr-6">packer</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-2">Valid roles: operator, picker, packer, validator, sorter, transporter</p>
        </div>
      </div>
    </div>
  )
}
