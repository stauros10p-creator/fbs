import { useState, useRef } from 'react'
import { useAppStore } from '@/store'
import { ROLE_CONFIG, SKILL_LABELS } from '@/types'
import type { Employee } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedEmployee {
  full_name: string
  employee_id: string
  role: string
  shift: string // e.g. "07:00-15:00"
}

interface PlanningInput {
  due_date_orders: number
  intraday_orders: number
  due_date_backlog: number
  current_time: string
  break1: string
  break2: string
}

interface Assignment {
  employee: Employee
  zone: string
  position: string
  role: string
  uph: number
  shift: string
  withValidator?: string
}

// ─── Zone config ──────────────────────────────────────────────────────────────

const ZONES = {
  OG1:  { label: 'Ογκώδη',        color: '#f59e0b', bg: '#fffbeb', capacity: 80,  maxPackers: 1 },
  RED1: { label: 'Κόκκ. Π1',      color: '#ef4444', bg: '#fef2f2', capacity: 90,  maxPackers: 1 },
  RED2: { label: 'Κόκκ. Π2',      color: '#ef4444', bg: '#fef2f2', capacity: 90,  maxPackers: 1 },
  RED3: { label: 'Κόκκ. Π3',      color: '#ef4444', bg: '#fef2f2', capacity: 90,  maxPackers: 1 },
  RED4: { label: 'Κόκκ. Π4',      color: '#ef4444', bg: '#fef2f2', capacity: 90,  maxPackers: 1 },
  L1:   { label: 'Πράσ. L1',      color: '#22c55e', bg: '#f0fdf4', capacity: 110, maxPackers: 1 },
  L2:   { label: 'Πράσ. L2',      color: '#22c55e', bg: '#f0fdf4', capacity: 110, maxPackers: 1 },
  L3:   { label: 'Πράσ. L3',      color: '#22c55e', bg: '#f0fdf4', capacity: 110, maxPackers: 1 },
  L4:   { label: 'Πράσ. L4',      color: '#22c55e', bg: '#f0fdf4', capacity: 110, maxPackers: 1 },
  L5:   { label: 'Πράσ. L5',      color: '#22c55e', bg: '#f0fdf4', capacity: 110, maxPackers: 1 },
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

async function parsePapakiasExcel(file: File, targetDate: Date): Promise<ParsedEmployee[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]

  // Header row: fbs_type, employee_name, Date1..Date7, days_per_week
  // We need to figure out which column corresponds to targetDate
  // The file covers a week — we use day of week (Mon=1..Sun=7)
  // Date1=col2, Date2=col3 ... Date7=col8
  const dow = targetDate.getDay() // 0=Sun,1=Mon,...,6=Sat
  // Map: Mon=Date1(col2), Tue=Date2(col3)...Sun=Date7(col8)
  const colIndex = dow === 0 ? 8 : dow + 1 // 0-based + 2 offset

  const result: ParsedEmployee[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || !row[1]) continue
    const roleRaw = String(row[0] ?? '').toLowerCase().trim()
    const nameRaw = String(row[1] ?? '').trim()
    const shiftRaw = String(row[colIndex] ?? '').trim()

    if (!nameRaw || shiftRaw === 'day_off' || shiftRaw === 'unexcused') continue

    // Extract clean name (remove id part)
    const name = nameRaw.replace(/\s*\(id:\d+\)\s*$/, '').trim()
    // Extract employee id
    const idMatch = nameRaw.match(/\(id:(\d+)\)/)
    const empId = idMatch ? idMatch[1] : ''

    // Normalize role
    let role = roleRaw
    if (role === 'operator') role = 'operator'
    else if (role === 'palletizing') role = 'sorter'

    result.push({ full_name: name, employee_id: empId, role, shift: shiftRaw })
  }

  return result
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

function runAlgorithm(
  present: ParsedEmployee[],
  employees: Employee[],
  input: PlanningInput
): { assignments: Assignment[]; summary: string[]; totalCapacity: number; needed: number } {

  const now = input.current_time.split(':').map(Number)
  const nowMins = now[0] * 60 + now[1]
  const dueCutoff = 19 * 60
  const intradayCutoff = 24 * 60 + 90 // 01:30
  const hoursUntilDue = Math.max(0, (dueCutoff - nowMins) / 60)

  const totalOrders = input.due_date_orders + input.due_date_backlog
  const neededCapacity = hoursUntilDue > 0 ? Math.ceil(totalOrders / hoursUntilDue) : 9999

  // Match present employees to Supabase records
  const matched: Array<{ parsed: ParsedEmployee; emp: Employee; uph: number }> = []

  for (const p of present) {
    const emp = employees.find(e =>
      e.full_name === p.full_name ||
      e.full_name.toLowerCase() === p.full_name.toLowerCase()
    )
    if (!emp) continue

    // Get best uph for role
    let uph = emp.productivity?.find(pr => pr.role === emp.primary_role)?.units_per_hour
      ?? emp.productivity?.[0]?.units_per_hour
      ?? 100

    matched.push({ parsed: p, emp, uph })
  }

  // Separate by role
  const packers   = matched.filter(m => m.parsed.role === 'packer').sort((a, b) => b.uph - a.uph)
  const validators = matched.filter(m => m.parsed.role === 'validator').sort((a, b) => b.uph - a.uph)
  const operators = matched.filter(m => m.parsed.role === 'operator' || m.emp.primary_role === 'operator')
  const pickers   = matched.filter(m => m.parsed.role === 'picker')
  const sorters   = matched.filter(m => m.parsed.role === 'sorter' || m.parsed.role === 'palletizing')

  const assignments: Assignment[] = []
  const usedPackers = new Set<string>()
  const usedValidators = new Set<string>()

  // 1. Operators → AutoStore
  operators.forEach((m, i) => {
    assignments.push({
      employee: m.emp, zone: 'AutoStore', position: `Op${i + 1}`,
      role: 'operator', uph: m.uph, shift: m.parsed.shift,
    })
  })

  // 2. Pickers → Picking
  pickers.forEach((m, i) => {
    assignments.push({
      employee: m.emp, zone: 'Picking', position: `PK${i + 1}`,
      role: 'picker', uph: m.uph, shift: m.parsed.shift,
    })
  })

  // 3. Sorters → Sorting
  sorters.forEach((m, i) => {
    assignments.push({
      employee: m.emp, zone: 'Sorting', position: `SR${i + 1}`,
      role: 'sorter', uph: m.uph, shift: m.parsed.shift,
    })
  })

  // 4. Assign 1 packer to OG1 (lowest performer — save best for red/green)
  const ogPacker = packers[packers.length - 1]
  if (ogPacker && !usedPackers.has(ogPacker.emp.id)) {
    usedPackers.add(ogPacker.emp.id)
    assignments.push({
      employee: ogPacker.emp, zone: 'OG1', position: 'Og1',
      role: 'packer', uph: 80, shift: ogPacker.parsed.shift,
    })
  }

  // 5. RED zone: pair best packers with validators (145/hr) or alone (90/hr)
  const redPositions = ['RED1', 'RED2', 'RED3', 'RED4']
  const availPackers = packers.filter(m => !usedPackers.has(m.emp.id))
  const availValidators = [...validators]

  for (const pos of redPositions) {
    const packer = availPackers.find(m => !usedPackers.has(m.emp.id))
    if (!packer) break
    usedPackers.add(packer.emp.id)

    const validator = availValidators.find(v => !usedValidators.has(v.emp.id))
    let capacity = 90
    let validatorName: string | undefined

    if (validator) {
      usedValidators.add(validator.emp.id)
      capacity = 145
      validatorName = validator.emp.full_name.split(' ').slice(0, 2).join(' ')
      assignments.push({
        employee: validator.emp, zone: pos, position: pos.replace('RED', 'Π'),
        role: 'validator', uph: 145, shift: validator.parsed.shift,
        withValidator: undefined,
      })
    }

    assignments.push({
      employee: packer.emp, zone: pos, position: pos.replace('RED', 'Π'),
      role: 'packer', uph: capacity, shift: packer.parsed.shift,
      withValidator: validatorName,
    })
  }

  // 6. GREEN zone L1-L5: remaining packers by performance
  const greenPositions = ['L1', 'L2', 'L3', 'L4', 'L5']
  const greenPackers = packers.filter(m => !usedPackers.has(m.emp.id))

  greenPackers.forEach((packer, i) => {
    if (i >= greenPositions.length) return
    const pos = greenPositions[i]
    usedPackers.add(packer.emp.id)
    assignments.push({
      employee: packer.emp, zone: pos, position: pos,
      role: 'packer', uph: 110, shift: packer.parsed.shift,
    })
  })

  // 7. Remaining validators without a packer pair
  validators.filter(v => !usedValidators.has(v.emp.id)).forEach((v, i) => {
    assignments.push({
      employee: v.emp, zone: 'Validator', position: `VA${i + 1}`,
      role: 'validator', uph: 0, shift: v.parsed.shift,
    })
  })

  // Calculate total packing capacity
  const packingAssignments = assignments.filter(a => a.role === 'packer')
  const totalCapacity = packingAssignments.reduce((s, a) => s + a.uph, 0)

  // Summary messages
  const summary: string[] = []
  const gap = totalCapacity - neededCapacity
  if (hoursUntilDue > 0) {
    summary.push(`Στόχος: ${neededCapacity} παρ/ώρα για Due Date έως 19:00 (${hoursUntilDue.toFixed(1)}h)`)
    if (gap >= 0) {
      summary.push(`✅ Capacity OK — πλεόνασμα ${gap} παρ/ώρα`)
    } else {
      summary.push(`⚠️ Έλλειμμα ${Math.abs(gap)} παρ/ώρα — χρειάζεσαι ${Math.ceil(Math.abs(gap) / 110)} επιπλέον packer`)
    }
  }
  summary.push(`Intraday: ~${input.intraday_orders} παρ. — cutoff 01:30`)

  return { assignments, summary, totalCapacity, needed: neededCapacity }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const ZONE_GROUPS = [
  { key: 'AutoStore', label: 'AutoStore', color: '#06b6d4', bg: '#ecfeff' },
  { key: 'Picking',  label: 'Picking',   color: '#3b82f6', bg: '#eff6ff' },
  { key: 'OG1',      label: 'Ογκώδη',   color: '#f59e0b', bg: '#fffbeb' },
  { key: 'RED1',     label: 'Κόκκινη Ζώνη', color: '#ef4444', bg: '#fef2f2' },
  { key: 'RED2',     label: '',          color: '#ef4444', bg: '#fef2f2' },
  { key: 'RED3',     label: '',          color: '#ef4444', bg: '#fef2f2' },
  { key: 'RED4',     label: '',          color: '#ef4444', bg: '#fef2f2' },
  { key: 'L1',       label: 'Πράσινη Ζώνη', color: '#22c55e', bg: '#f0fdf4' },
  { key: 'L2',       label: '',          color: '#22c55e', bg: '#f0fdf4' },
  { key: 'L3',       label: '',          color: '#22c55e', bg: '#f0fdf4' },
  { key: 'L4',       label: '',          color: '#22c55e', bg: '#f0fdf4' },
  { key: 'L5',       label: '',          color: '#22c55e', bg: '#f0fdf4' },
  { key: 'Sorting',  label: 'Sorting',   color: '#f97316', bg: '#fff7ed' },
  { key: 'Validator',label: 'Validator', color: '#8b5cf6', bg: '#f5f3ff' },
]

const ROLE_COLOR: Record<string, { color: string; bg: string }> = {
  operator:  { color: '#06b6d4', bg: '#ecfeff' },
  picker:    { color: '#3b82f6', bg: '#eff6ff' },
  packer:    { color: '#22c55e', bg: '#f0fdf4' },
  validator: { color: '#8b5cf6', bg: '#f5f3ff' },
  sorter:    { color: '#f97316', bg: '#fff7ed' },
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PlanningPage() {
  const employees = useAppStore(s => s.employees)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [parsedEmployees, setParsedEmployees] = useState<ParsedEmployee[]>([])
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  })
  const [input, setInput] = useState<PlanningInput>({
    due_date_orders: 0,
    intraday_orders: 0,
    due_date_backlog: 0,
    current_time: new Date().toTimeString().slice(0, 5),
    break1: '10:00',
    break2: '13:00',
  })
  const [result, setResult] = useState<ReturnType<typeof runAlgorithm> | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const printRef = useRef<HTMLDivElement>(null)

  // ── Step 1: Upload ──
  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const date = new Date(selectedDate + 'T12:00:00')
      const parsed = await parsePapakiasExcel(file, date)
      if (parsed.length === 0) {
        setError('Δεν βρέθηκαν εργαζόμενοι για αυτή την ημέρα (όλοι day_off)')
        setUploading(false)
        return
      }
      setUploadedFile(file)
      setParsedEmployees(parsed)
      setStep(2)
    } catch (e) {
      setError('Σφάλμα ανάγνωσης αρχείου')
    }
    setUploading(false)
  }

  // ── Step 2: Calculate ──
  function handleCalculate() {
    const res = runAlgorithm(parsedEmployees, employees, input)
    setResult(res)
    setStep(3)
  }

  // ── Print ──
  function handlePrint() {
    window.print()
  }

  const inp = (field: keyof PlanningInput, val: string | number) =>
    setInput(prev => ({ ...prev, [field]: val }))

  const inputStyle: React.CSSProperties = {
    border: '0.5px solid #e5e5e5', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, outline: 'none',
    fontFamily: 'Inter, sans-serif', width: '100%',
    color: '#1a1a1a', background: 'white',
  }

  // ── Group assignments by zone ──
  const groupedAssignments = () => {
    if (!result) return []
    const groups: Record<string, Assignment[]> = {}
    for (const a of result.assignments) {
      if (!groups[a.zone]) groups[a.zone] = []
      groups[a.zone].push(a)
    }
    return groups
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#f5f5f0', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '0.5px solid #e5e5e5', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Προγραμματισμός</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#1a1a1a' }}>Daily Planning</div>
          {step === 3 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setStep(1); setResult(null); setParsedEmployees([]); setUploadedFile(null) }}
                style={{ border: '0.5px solid #e5e5e5', background: 'white', padding: '8px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer' }}>
                ← Νέο Πλάνο
              </button>
              <button onClick={handlePrint}
                style={{ background: '#1a1a1a', color: 'white', border: 'none', padding: '8px 18px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                🖨️ Print PDF
              </button>
            </div>
          )}
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14, alignItems: 'center' }}>
          {['Upload Πρόγραμμα', 'Παραγγελίες & Ώρες', 'Πλάνο Βάρδιας'].map((label, i) => {
            const s = i + 1
            const active = step === s
            const done = step > s
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: active ? '#1a1a1a' : done ? '#f0fdf4' : '#f9f9f7',
                  borderRadius: 20, padding: '4px 12px 4px 6px',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: active ? 'white' : done ? '#22c55e' : '#e5e5e5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600,
                    color: active ? '#1a1a1a' : done ? 'white' : '#9ca3af',
                  }}>{done ? '✓' : s}</div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: active ? 'white' : done ? '#15803d' : '#9ca3af' }}>{label}</span>
                </div>
                {i < 2 && <span style={{ color: '#e5e5e5', fontSize: 14 }}>→</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e5e5', padding: 28 }}>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: '#1a1a1a' }}>Ημερομηνία βάρδιας</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>Επίλεξε για ποια μέρα θέλεις να βγάλεις πλάνο</div>
              <input type="date" value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ ...inputStyle, marginBottom: 24 }}
              />

              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, color: '#1a1a1a' }}>Αρχείο Papakias</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>Ανέβασε το εβδομαδιαίο πρόγραμμα από το Papakias (xlsx)</div>

              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                style={{
                  border: '1.5px dashed #e5e5e5', borderRadius: 12, padding: '32px 24px',
                  textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s',
                  background: '#fafafa',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#1a1a1a')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#e5e5e5')}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a', marginBottom: 4 }}>
                  {uploading ? 'Φόρτωση...' : 'Drag & Drop ή κλικ'}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>fbs_papakias_view_*.xlsx</div>
                <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: Orders ── */}
        {step === 2 && (
          <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Employees preview */}
            <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e5e5', padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14, color: '#1a1a1a' }}>
                Εργαζόμενοι σήμερα — {parsedEmployees.length} άτομα
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {parsedEmployees.map((p, i) => {
                  const rc = ROLE_COLOR[p.role] ?? ROLE_COLOR.packer
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: rc.bg, borderRadius: 20, padding: '4px 10px 4px 6px',
                    }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', background: rc.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 600, color: 'white',
                      }}>{initials(p.full_name)}</div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: '#1a1a1a' }}>
                          {p.full_name.split(' ').slice(0, 2).join(' ')}
                        </div>
                        <div style={{ fontSize: 9, color: '#9ca3af' }}>{p.shift}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Orders input */}
            <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e5e5', padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16, color: '#1a1a1a' }}>Παραγγελίες ημέρας</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { key: 'due_date_orders', label: 'Due Date (νέες)', hint: 'Παρ. έως 19:00', color: '#3b82f6' },
                  { key: 'due_date_backlog', label: 'Backlog', hint: 'Εκκρεμείς Due Date', color: '#f97316' },
                  { key: 'intraday_orders', label: 'Intraday', hint: 'Παρ. έως 01:30', color: '#8b5cf6' },
                ].map(({ key, label, hint, color }) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, fontWeight: 500, color, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>{hint}</div>
                    <input
                      type="number" min={0}
                      value={(input as any)[key]}
                      onChange={e => inp(key as keyof PlanningInput, parseInt(e.target.value) || 0)}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Time & Breaks */}
            <div style={{ background: 'white', borderRadius: 16, border: '0.5px solid #e5e5e5', padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 16, color: '#1a1a1a' }}>Ώρα & Διαλείμματα</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { key: 'current_time', label: 'Τρέχουσα ώρα', type: 'time' },
                  { key: 'break1', label: '1ο Διάλειμμα (30\')', type: 'time' },
                  { key: 'break2', label: '2ο Διάλειμμα (30\')', type: 'time' },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>{label}</div>
                    <input
                      type={type}
                      value={(input as any)[key]}
                      onChange={e => inp(key as keyof PlanningInput, e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleCalculate} style={{
              background: '#1a1a1a', color: 'white', border: 'none',
              padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 500,
              cursor: 'pointer', width: '100%',
            }}>
              Δημιουργία Πλάνου →
            </button>
          </div>
        )}

        {/* ── STEP 3: Plan ── */}
        {step === 3 && result && (
          <div ref={printRef} style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Summary bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Εργαζόμενοι', val: parsedEmployees.length, color: '#1a1a1a' },
                { label: 'Packing capacity', val: `${result.totalCapacity}/h`, color: '#22c55e' },
                { label: 'Στόχος', val: `${result.needed}/h`, color: '#3b82f6' },
                { label: 'Κατάσταση', val: result.totalCapacity >= result.needed ? '✅ OK' : '⚠️ Έλλειμμα', color: result.totalCapacity >= result.needed ? '#22c55e' : '#ef4444' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e5e5', padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color }}>{val}</div>
                </div>
              ))}
            </div>

            {/* AI Summary */}
            <div style={{ background: '#f9f9f7', borderRadius: 12, border: '0.5px solid #e5e5e5', padding: '14px 18px' }}>
              <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Ανάλυση Πλάνου</div>
              {result.summary.map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: '#1a1a1a', marginBottom: 4 }}>{s}</div>
              ))}
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                Διαλείμματα: {input.break1} και {input.break2} (30 λεπτά)
              </div>
            </div>

            {/* Assignments by zone */}
            {(() => {
              const groups = groupedAssignments()
              const zoneOrder = ['AutoStore', 'Picking', 'OG1', 'RED1', 'RED2', 'RED3', 'RED4', 'L1', 'L2', 'L3', 'L4', 'L5', 'Sorting', 'Validator']

              // Group red together, green together
              const sections: { title: string; color: string; bg: string; zones: string[] }[] = [
                { title: 'AutoStore', color: '#06b6d4', bg: '#ecfeff', zones: ['AutoStore'] },
                { title: 'Picking', color: '#3b82f6', bg: '#eff6ff', zones: ['Picking'] },
                { title: '🟡 Ογκώδη', color: '#f59e0b', bg: '#fffbeb', zones: ['OG1'] },
                { title: '🔴 Κόκκινη Ζώνη', color: '#ef4444', bg: '#fef2f2', zones: ['RED1', 'RED2', 'RED3', 'RED4'] },
                { title: '🟢 Πράσινη Ζώνη', color: '#22c55e', bg: '#f0fdf4', zones: ['L1', 'L2', 'L3', 'L4', 'L5'] },
                { title: 'Sorting / Palletizing', color: '#f97316', bg: '#fff7ed', zones: ['Sorting'] },
                { title: 'Validators (διαθέσιμοι)', color: '#8b5cf6', bg: '#f5f3ff', zones: ['Validator'] },
              ]

              return sections.map(section => {
                const sectionAssignments = section.zones.flatMap(z => (groups as Record<string, Assignment[]>)[z] ?? [])
                if (sectionAssignments.length === 0) return null

                return (
                  <div key={section.title} style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e5e5', overflow: 'hidden' }}>
                    <div style={{ background: section.bg, borderBottom: '0.5px solid #e5e5e5', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: section.color }}>{section.title}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>
                        {sectionAssignments.filter(a => a.role === 'packer').reduce((s, a) => s + a.uph, 0) > 0
                          ? `${sectionAssignments.filter(a => a.role === 'packer').reduce((s, a) => s + a.uph, 0)} παρ/ώρα`
                          : `${sectionAssignments.length} άτομα`}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1, background: '#f9f9f7' }}>
                      {sectionAssignments.map((a, i) => {
                        const rc = ROLE_COLOR[a.role] ?? ROLE_COLOR.packer
                        const skill = a.employee.skill_level
                        const skillLabel = SKILL_LABELS[skill as keyof typeof SKILL_LABELS]
                        return (
                          <div key={i} style={{ background: 'white', padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: '50%', background: rc.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 500, color: 'white', flexShrink: 0,
                              }}>{initials(a.employee.full_name)}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {a.employee.full_name.split(' ').slice(0, 2).join(' ')}
                                </div>
                                <div style={{ fontSize: 10, color: '#9ca3af' }}>{a.shift}</div>
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 600, color: rc.color, background: rc.bg, padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
                                {a.position}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <span style={{ fontSize: 10, color: '#9ca3af', background: '#f9f9f7', padding: '2px 7px', borderRadius: 10 }}>
                                {skillLabel}
                              </span>
                              {a.uph > 0 && (
                                <span style={{ fontSize: 10, color: '#9ca3af', background: '#f9f9f7', padding: '2px 7px', borderRadius: 10, fontFamily: 'monospace' }}>
                                  {a.uph} u/h
                                </span>
                              )}
                              {a.withValidator && (
                                <span style={{ fontSize: 10, color: '#8b5cf6', background: '#f5f3ff', padding: '2px 7px', borderRadius: 10 }}>
                                  +{a.withValidator.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  )
}
