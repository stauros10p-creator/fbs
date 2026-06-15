import { useState, useCallback, useRef } from 'react'
import { Upload, X, Check, AlertTriangle, Loader2, FileSpreadsheet, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase, WAREHOUSE_ID } from '@/lib/supabase'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { EmployeeRole, EmployeeStatus } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseShiftStr(s: string | null | undefined): { start: string; end: string } | 'sick' | null {
  if (!s || s === 'day_off') return null
  if (s === 'sick') return 'sick'
  if (s === 'regular') return { start: '07:00:00', end: '15:00:00' }
  if (s === 'student') return { start: '13:00:00', end: '21:00:00' }
  const m = s.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/)
  if (!m) return null
  return { start: `${m[1]}:00`, end: `${m[2]}:00` }
}

function getWeekDates(): string[] {
  const d = new Date()
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd.toISOString().slice(0, 10)
  })
}

const MONTHS_GR = ['Ιαν','Φεβ','Μαρ','Απρ','Μαϊ','Ιουν','Ιουλ','Αυγ','Σεπ','Οκτ','Νοε','Δεκ']
function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00')
  return `${d.getDate()} ${MONTHS_GR[d.getMonth()]}`
}

interface ParsedEmployee {
  papakiasId: string
  rawName: string
  employeeId: string | null
  employeeCode: string | null
  primaryRole: EmployeeRole | null
  days: (string | null)[]   // [Mon…Sun]: 'HH:MM-HH:MM' | 'sick' | null(=off)
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ScheduleImportModal({ onClose }: { onClose: () => void }) {
  const employees = useAppStore(s => s.employees)
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [rows, setRows]       = useState<ParsedEmployee[]>([])
  const [isDragging, setDrag] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [done, setDone]       = useState(false)

  const weekDates = getWeekDates()
  const todayIdx  = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1  // 0=Mon

  // ── Parse Excel ──────────────────────────────────────────────────────────────
  const parseFile = useCallback((file: File) => {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const wb = XLSX.read(e.target!.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]

      const parsed: ParsedEmployee[] = []
      for (let i = 1; i < raw.length; i++) {
        const row = raw[i]
        if (!row[0]) continue
        const nameRaw = String(row[0]).trim()
        const idMatch = nameRaw.match(/\(id:(\d+)\)/)
        if (!idMatch) continue
        const papakiasId = idMatch[1]
        const code = `EMP${papakiasId}`
        const emp = employees.find(e => e.employee_code === code)

        const days = [row[1], row[2], row[3], row[4], row[5], row[6], row[7]]
          .map(v => {
            const s = String(v ?? '').trim().toLowerCase()
            if (!s || s === 'day_off') return null
            if (s === 'sick') return 'sick'
            if (s === 'regular') return '07:00-15:00'
            if (s === 'student') return '13:00-21:00'
            // time range like "07:00-15:00"
            if (/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(s)) return s
            return null
          }) as (string | null)[]

        parsed.push({
          papakiasId,
          rawName: nameRaw.replace(/\s*\(id:\d+\)/, '').trim(),
          employeeId:   emp?.id ?? null,
          employeeCode: emp?.employee_code ?? null,
          primaryRole:  emp?.primary_role ?? null,
          days,
        })
      }
      setRows(parsed)
    }
    reader.readAsBinaryString(file)
  }, [employees])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [parseFile])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const matched   = rows.filter(r => r.employeeId)
  const unmatched = rows.filter(r => !r.employeeId)
  const totalShifts = matched.reduce((n, r) => n + r.days.filter(d => d && d !== 'sick').length, 0)
  const sickEmp   = matched.filter(r => r.days[todayIdx] === 'sick')
  const offEmp    = matched.filter(r => r.days[todayIdx] === null)
  const workEmp   = matched.filter(r => r.days[todayIdx] && r.days[todayIdx] !== 'sick')

  // ── Import ───────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!matched.length) return
    setImporting(true)

    try {
      const batchId = crypto.randomUUID()
      const shiftRows: object[] = []

      for (const row of matched) {
        for (let i = 0; i < 7; i++) {
          const s = parseShiftStr(row.days[i])
          if (!s || s === 'sick') continue
          shiftRows.push({
            employee_id:     row.employeeId,
            warehouse_id:    WAREHOUSE_ID,
            shift_date:      weekDates[i],
            start_time:      s.start,
            end_time:        s.end,
            assigned_role:   row.primaryRole ?? 'operator',
            import_batch_id: batchId,
          })
        }
      }

      // Upsert shifts
      if (shiftRows.length) {
        const { error } = await supabase
          .from('shifts')
          .upsert(shiftRows, { onConflict: 'employee_id,shift_date' })
        if (error) throw error
      }

      // Update statuses for today
      const statusUpdates: { id: string; status: EmployeeStatus }[] = [
        ...sickEmp.map(r => ({ id: r.employeeId!, status: 'sick' as EmployeeStatus })),
        ...offEmp.map(r  => ({ id: r.employeeId!, status: 'off' as EmployeeStatus })),
        ...workEmp.map(r => ({ id: r.employeeId!, status: 'working' as EmployeeStatus })),
      ]

      for (const upd of statusUpdates) {
        await supabase
          .from('employees')
          .update({ current_status: upd.status, updated_at: new Date().toISOString() })
          .eq('id', upd.id)
      }

      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['week-shifts'] })

      setDone(true)
      toast.success(`Εισήχθησαν ${shiftRows.length} βάρδιες · ${matched.length} εργαζόμενοι ενημερώθηκαν`)
    } catch (err: any) {
      toast.error(err.message ?? 'Σφάλμα κατά το import')
    } finally {
      setImporting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800">Import Εβδομαδιαίου Προγράμματος</div>
              <div className="text-xs text-slate-400">
                {weekDates[0] && `${fmtDate(weekDates[0])} – ${fmtDate(weekDates[6])}`}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Drop zone */}
          {!rows.length && (
            <div
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
              )}
            >
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <div className="text-sm font-medium text-slate-600">
                Σύρε το papakias_calendar.xlsx εδώ
              </div>
              <div className="text-xs text-slate-400 mt-1">ή κλικ για επιλογή αρχείου</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFileChange} />
            </div>
          )}

          {/* Stats after parse */}
          {rows.length > 0 && (
            <>
              <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                {fileName}
                <button onClick={() => { setRows([]); setFileName(null); setDone(false) }}
                  className="ml-auto text-xs text-slate-400 hover:text-slate-600">Αλλαγή</button>
              </div>

              {done ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <div className="text-sm text-green-700 font-medium">
                    Το πρόγραμμα αποθηκεύτηκε επιτυχώς!
                  </div>
                </div>
              ) : (
                <>
                  {/* Match summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold font-mono text-slate-800">{rows.length}</div>
                      <div className="text-[10px] text-slate-400">Εγγραφές Excel</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <div className="text-2xl font-bold font-mono text-green-600">{matched.length}</div>
                      <div className="text-[10px] text-slate-400">Ταίριαξαν</div>
                    </div>
                    <div className={cn('rounded-xl p-3 text-center', unmatched.length ? 'bg-amber-50' : 'bg-slate-50')}>
                      <div className={cn('text-2xl font-bold font-mono', unmatched.length ? 'text-amber-600' : 'text-slate-400')}>
                        {unmatched.length}
                      </div>
                      <div className="text-[10px] text-slate-400">Δεν βρέθηκαν</div>
                    </div>
                  </div>

                  {/* Today preview */}
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-500 mb-2">Status για σήμερα</div>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-slate-600">{workEmp.length} εργάζονται</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="text-slate-600">{offEmp.length} ρεπό</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="text-slate-600">{sickEmp.length} άρρωστοι</span>
                      </div>
                    </div>
                  </div>

                  {/* Unmatched list */}
                  {unmatched.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Δεν βρέθηκαν στη βάση
                      </div>
                      <div className="space-y-0.5">
                        {unmatched.slice(0, 5).map(r => (
                          <div key={r.papakiasId} className="text-xs text-amber-700">
                            • {r.rawName} (id:{r.papakiasId})
                          </div>
                        ))}
                        {unmatched.length > 5 && (
                          <div className="text-xs text-amber-500">+{unmatched.length - 5} ακόμα</div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary flex-1">
            {done ? 'Κλείσιμο' : 'Ακύρωση'}
          </button>
          {!done && rows.length > 0 && (
            <button
              onClick={handleImport}
              disabled={importing || !matched.length}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {importing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Αποθήκευση...</>
              ) : (
                <><Upload className="w-4 h-4" /> Import {matched.length} εργαζόμενων</>
              )}
            </button>
          )}
        </div>
      </div>
    </d
