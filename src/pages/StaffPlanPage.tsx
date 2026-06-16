import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────────
interface CalendarNote {
  date: string
  note: string
  adjustment: number
  type: 'increase' | 'decrease' | 'closed' | 'peak' | 'promo' | 'info'
}
type StaffMap = Record<string, number>

// ── Constants ──────────────────────────────────────────────────────────────────
const AS_SPLIT: Record<number, number> = {
  6: 0.70, 7: 0.80,
  8: 0.90, 9: 0.90, 10: 0.90, 11: 0.90, 12: 0.90,
}
const OPERATOR_UPH = 190  // target 200 UPH × 95% efficiency (7h36 productive/8h shift)
const PICKER_UPH   = 77
const PACKER_UPH   = 80

const ROLE_LABELS: Record<string, string> = {
  operator: 'Operator', picker: 'Picker', packer: 'Packer',
  sorter: 'Sorter', transporter: 'Transporter',
}
const ROLE_COLORS: Record<string, string> = {
  picker: '#378ADD', packer: '#1D9E75', sorter: '#D85A30',
  operator: '#7F77DD', transporter: '#9ca3af',
}
const ROLES = ['operator', 'picker', 'packer', 'sorter', 'transporter']

const DD_BASE: Record<number, { mon: number; twt: number; fri: number; sat: number; sun: number }> = {
  6:  { mon: 11267, twt: 10332, fri:  8650, sat:  6055, sun:  7798 },
  7:  { mon: 13135, twt: 12044, fri: 10084, sat:  7059, sun:  9091 },
  8:  { mon: 11566, twt: 10606, fri:  8880, sat:  6216, sun:  8005 },
  9:  { mon: 12989, twt: 11911, fri:  9972, sat:  6980, sun:  8990 },
  10: { mon: 13317, twt: 12212, fri: 10224, sat:  7157, sun:  9217 },
  11: { mon: 17112, twt: 15691, fri: 13137, sat:  9196, sun: 11843 },
  12: { mon: 18243, twt: 16728, fri: 14006, sat:  9804, sun: 12626 },
}
const INTRADAY_BASE: Record<number, { mon: number; twt: number; sun: number }> = {
  6:  { mon: 1600, twt: 1500, sun: 1746 },
  7:  { mon: 1865, twt: 1749, sun: 2035 },
  8:  { mon: 1642, twt: 1540, sun: 1792 },
  9:  { mon: 1845, twt: 1729, sun: 2013 },
  10: { mon: 1891, twt: 1773, sun: 2064 },
  11: { mon: 2430, twt: 2278, sun: 2652 },
  12: { mon: 2591, twt: 2429, sun: 2827 },
}
const SPECIAL_DAYS: Record<string, number> = {
  '2026-08-15': 1200,
  '2026-10-28': 0,
  '2026-11-27': 38000,
  '2026-11-28': 28000,
  '2026-12-25': 0,
  '2026-12-26': 0,
  '2026-12-31': 4500,
}

const MONTHS_GR: Record<number, string> = {
  6: 'Ιούνιος', 7: 'Ιούλιος', 8: 'Αύγουστος', 9: 'Σεπτέμβριος',
  10: 'Οκτώβριος', 11: 'Νοέμβριος', 12: 'Δεκέμβριος',
}
const DOW_GR = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ']

// ── Forecast builder ───────────────────────────────────────────────────────────
function buildForecast(): Record<string, { total: number; due_date: number; intraday: number }> {
  const out: Record<string, { total: number; due_date: number; intraday: number }> = {}
  const end = new Date('2026-12-31')
  for (let d = new Date('2026-06-01'); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    const m = d.getMonth() + 1
    const dow = (d.getDay() + 6) % 7
    const ddRow = DD_BASE[m]
    const idRow = INTRADAY_BASE[m]
    const normDD = dow === 0 ? ddRow.mon : dow <= 3 ? ddRow.twt : dow === 4 ? ddRow.fri : dow === 5 ? ddRow.sat : ddRow.sun
    const normID = dow === 0 ? idRow.mon : dow <= 3 ? idRow.twt : dow === 4 ? 0 : dow === 5 ? 0 : idRow.sun
    let due_date: number, intraday: number
    if (SPECIAL_DAYS[key] !== undefined) {
      const sp = SPECIAL_DAYS[key]
      if (sp === 0) { due_date = 0; intraday = 0 }
      else {
        const nt = normDD + normID
        due_date = nt > 0 ? Math.round(sp * normDD / nt) : sp
        intraday = nt > 0 ? Math.round(sp * normID / nt) : 0
      }
    } else {
      const j = 1 + Math.sin(d.getTime() / 86_400_000 * 3.7) * 0.03
      due_date = Math.round(normDD * j)
      intraday = Math.round(normID * j)
    }
    out[key] = { total: due_date + intraday, due_date, intraday }
  }
  return out
}
const FORECAST = buildForecast()

function getForDay(key: string, notes: CalendarNote[]) {
  const base = FORECAST[key] ?? { total: 0, due_date: 0, intraday: 0 }
  const note = notes.find(n => n.date === key)
  if (!note || note.adjustment === 0) return base
  const mult = 1 + note.adjustment / 100
  return {
    total:    Math.round(base.total * mult),
    due_date: Math.round(base.due_date * mult),
    intraday: Math.round(base.intraday * mult),
  }
}

// Per-shift staffing (8h window, fixed sorter/transporter per DD shift)
function staffForDDShift(halfOrders: number, dateKey: string): StaffMap {
  const H = 8
  const month = parseInt(dateKey.slice(5, 7))
  const asPct = AS_SPLIT[month] ?? 0.85
  const asOrders = Math.round(halfOrders * asPct)
  const rafi = halfOrders - asOrders
  const dow = new Date(dateKey + 'T12:00:00').getDay()
  // Fixed sorter/transporter per DD shift
  // Mon-Fri: 3 sorters + 1 transporter per shift (total for 2 shifts = 6s/2t)
  // Sat/Sun: 1 sorter + 1 transporter per shift
  const sorter      = (dow === 6 || dow === 0) ? 1 : 3
  const transporter = (dow === 6 || dow === 0) ? 1 : 1
  return {
    operator:    Math.max(1, Math.ceil(asOrders / (OPERATOR_UPH * H))),
    picker:      Math.max(1, Math.ceil(rafi     / (PICKER_UPH   * H))),
    packer:      Math.max(1, Math.ceil(halfOrders / (PACKER_UPH * H))),
    sorter,
    transporter,
  }
}

function staffForIntraday(idOrders: number, month: number): StaffMap {
  const H = 8
  const asPct = AS_SPLIT[month] ?? 0.85
  const asOrders = Math.round(idOrders * asPct)
  const rafi = idOrders - asOrders
  return {
    operator:    Math.max(1, Math.ceil(asOrders / (OPERATOR_UPH * H))),
    picker:      Math.max(1, Math.ceil(rafi     / (PICKER_UPH   * H))),
    packer:      Math.max(1, Math.ceil(idOrders / (PACKER_UPH   * H))),
    sorter:      1,
    transporter: 1,
  }
}

function total(s: StaffMap) { return Object.values(s).reduce((a, b) => a + b, 0) }
function fmt(n: number) { return n.toLocaleString('el-GR') }

interface DayRow {
  key: string
  dow: number
  forecast: { total: number; due_date: number; intraday: number }
  s1: StaffMap         // DD Βάρδια 1 (07-15 weekday / 09-17 Sat / 11-19 Sun)
  s2: StaffMap | null  // DD Βάρδια 2 (13-21) — null on Sat/Sun (single shift day)
  si: StaffMap | null  // Intraday (18-02)
  hasIntraday: boolean
  s1Total: number
  s2Total: number
  siTotal: number
  grandTotal: number
}

function buildMonthRows(year: number, month: number, notes: CalendarNote[]): DayRow[] {
  const daysInMonth = new Date(year, month, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    const forecast = getForDay(key, notes)
    const dow = new Date(key + 'T12:00:00').getDay()
    // Intraday: Sun–Thu only (not Fri=5, not Sat=6)
    const hasIntraday = forecast.intraday > 0 && dow !== 5 && dow !== 6
    // Sat (6) and Sun (0): single DD shift with full orders
    // Weekdays (Mon–Fri): two shifts split 50/50
    const isSatOrSun = dow === 6 || dow === 0
    const s1Orders = isSatOrSun ? forecast.due_date : Math.round(forecast.due_date / 2)
    const s1 = staffForDDShift(s1Orders, key)
    const s2 = isSatOrSun ? null : staffForDDShift(Math.round(forecast.due_date / 2), key)
    const si = hasIntraday ? staffForIntraday(forecast.intraday, month) : null

    const s1Total = total(s1)
    const s2Total = s2 ? total(s2) : 0
    const siTotal = si ? total(si) : 0

    return { key, dow, forecast, s1, s2, si, hasIntraday, s1Total, s2Total, siTotal, grandTotal: s1Total + s2Total + siTotal }
  })
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function ShiftCard({ label, time, color, bg, staff, avg }: {
  label: string; time: string; color: string; bg: string
  staff: StaffMap; avg: number
}) {
  return (
    <div style={{ background: bg, borderRadius: 12, padding: '12px 14px', flex: 1 }}>
      <div style={{ fontSize: 10, color, textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>{time}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ROLES.map(r => (
          <div key={r} style={{ textAlign: 'center', minWidth: 36 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color, fontFamily: 'monospace' }}>{staff[r] ?? 0}</div>
            <div style={{ fontSize: 9, color: '#9ca3af' }}>{ROLE_LABELS[r]}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color, fontWeight: 600 }}>
        Σύνολο: {total(staff)} · μ.ο. {avg}/ημέρα
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function StaffPlanPage() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [activeMonth, setActiveMonth] = useState(() => {
    const today = new Date()
    const nm = today.getMonth() + 2
    return nm > 12 ? 1 : nm
  })
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('forecast_notes')
      if (raw) setNotes(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const year = 2026
  const rows = buildMonthRows(year, activeMonth, notes)
  const openRows = rows.filter(r => r.forecast.total > 0)

  // Averages per shift for summary
  const avgS1 = ROLES.reduce((acc, r) => {
    acc[r] = openRows.length
      ? Math.round(openRows.reduce((s, row) => s + (row.s1[r] ?? 0), 0) / openRows.length)
      : 0
    return acc
  }, {} as StaffMap)
  const s2Rows = openRows.filter(r => r.s2 !== null)
  const avgS2 = ROLES.reduce((acc, r) => {
    acc[r] = s2Rows.length
      ? Math.round(s2Rows.reduce((s, row) => s + (row.s2![r] ?? 0), 0) / s2Rows.length)
      : 0
    return acc
  }, {} as StaffMap)
  const avgS2Total = s2Rows.length ? Math.round(s2Rows.reduce((s, r) => s + r.s2Total, 0) / s2Rows.length) : 0
  const intradayRows = openRows.filter(r => r.hasIntraday)
  const avgSi = ROLES.reduce((acc, r) => {
    acc[r] = intradayRows.length
      ? Math.round(intradayRows.reduce((s, row) => s + (row.si?.[r] ?? 0), 0) / intradayRows.length)
      : 0
    return acc
  }, {} as StaffMap)

  const avgS1Total = openRows.length ? Math.round(openRows.reduce((s, r) => s + r.s1Total, 0) / openRows.length) : 0
  const avgSiTotal = intradayRows.length ? Math.round(intradayRows.reduce((s, r) => s + r.siTotal, 0) / intradayRows.length) : 0
  const maxGrand = Math.max(...rows.map(r => r.grandTotal), 1)

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/forecast')}
          style={{
            background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 8,
            padding: '6px 12px', fontSize: 13, color: '#6b7280', cursor: 'pointer',
          }}
        >
          ← Forecast
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>
            Σχεδιασμός Προσωπικού ανά Βάρδια
          </h1>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Δευ–Παρ: Β1 07–15 + Β2 13–21 + Intraday 18–02 · Σαβ: 09–17 (1 βάρδια) · Κυρ: 11–19 DD + Intraday 18–02
          </div>
        </div>
      </div>

      {/* Month tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[6, 7, 8, 9, 10, 11, 12].map(m => (
          <button
            key={m}
            onClick={() => { setActiveMonth(m); setExpandedRow(null) }}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              border: 'none',
              background: activeMonth === m ? '#1a1a1a' : '#f5f5f3',
              color: activeMonth === m ? 'white' : '#6b7280',
            }}
          >
            {MONTHS_GR[m]}
          </button>
        ))}
      </div>

      {/* Shift summary cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <ShiftCard
          label="DD Βάρδια 1"
          time="07:00 – 15:00"
          color="#378ADD"
          bg="#f0f6fe"
          staff={avgS1}
          avg={avgS1Total}
        />
        <ShiftCard
          label="DD Βάρδια 2"
          time="13:00 – 21:00"
          color="#1D9E75"
          bg="#f0faf5"
          staff={avgS2}
          avg={avgS2Total}
        />
        {intradayRows.length > 0 && (
          <ShiftCard
            label="Intraday"
            time="18:00 – 02:00"
            color="#7F77DD"
            bg="#f4f3fe"
            staff={avgSi}
            avg={avgSiTotal}
          />
        )}
        <div style={{
          background: '#1a1a1a', borderRadius: 12, padding: '12px 14px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          minWidth: 100,
        }}>
          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            Μ.Ο. Σύνολο
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>
            {openRows.length ? Math.round(openRows.reduce((s, r) => s + r.grandTotal, 0) / openRows.length) : 0}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>άτομα/ημέρα</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f9f9f7', borderBottom: '0.5px solid #e5e5e5' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', color: '#9ca3af', fontWeight: 500 }}>Ημ/νία</th>
              <th style={{ padding: '10px 8px', color: '#9ca3af', fontWeight: 500, textAlign: 'center' }}>Ημέρα</th>
              <th style={{ padding: '10px 8px', color: '#378ADD', fontWeight: 500, textAlign: 'center' }}>DD παρ.</th>
              <th style={{ padding: '10px 8px', color: '#7F77DD', fontWeight: 500, textAlign: 'center' }}>Intra παρ.</th>
              <th style={{ padding: '10px 10px', color: '#378ADD', fontWeight: 600, textAlign: 'center', background: '#f0f6fe' }}>
                Β1 07–15
              </th>
              <th style={{ padding: '10px 10px', color: '#1D9E75', fontWeight: 600, textAlign: 'center', background: '#f0faf5' }}>
                Β2 13–21
              </th>
              <th style={{ padding: '10px 10px', color: '#7F77DD', fontWeight: 600, textAlign: 'center', background: '#f4f3fe' }}>
                Intraday
              </th>
              <th style={{ padding: '10px 14px', color: '#1a1a1a', fontWeight: 700, textAlign: 'center' }}>Σύνολο</th>
              <th style={{ padding: '10px 14px', width: 140 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSun  = row.dow === 0
              const isSat  = row.dow === 6
              const isClosed = row.forecast.total === 0
              const isBF   = row.key === '2026-11-27' || row.key === '2026-11-28'
              const isHigh = row.forecast.total > 15000
              const isExp  = expandedRow === row.key
              const rowBg  = isClosed ? '#fef9f9' : isBF ? '#fffbeb' : isHigh ? '#fefce8' : idx % 2 === 0 ? 'white' : '#fcfcfb'
              const barPct = isClosed ? 0 : Math.round((row.grandTotal / maxGrand) * 100)

              return (
                <>
                  <tr
                    key={row.key}
                    style={{ background: rowBg, borderBottom: isExp ? 'none' : '0.5px solid #f5f5f5', cursor: isClosed ? 'default' : 'pointer' }}
                    onClick={() => !isClosed && setExpandedRow(prev => prev === row.key ? null : row.key)}
                  >
                    <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#1a1a1a', fontWeight: 500 }}>
                      {row.key.slice(5)}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: isSun || isSat ? '#7F77DD' : '#6b7280', fontSize: 11 }}>
                      {DOW_GR[row.dow]}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: '#378ADD', fontFamily: 'monospace' }}>
                      {isClosed ? '—' : fmt(row.forecast.due_date)}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'center', color: '#7F77DD', fontFamily: 'monospace' }}>
                      {row.hasIntraday ? fmt(row.forecast.intraday) : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', background: isClosed ? rowBg : '#f8fbff', fontFamily: 'monospace', fontWeight: 600, color: '#378ADD', fontSize: 14 }}>
                      {isClosed ? '—' : row.s1Total}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', background: isClosed ? rowBg : '#f7fdf9', fontFamily: 'monospace', fontWeight: 600, color: '#1D9E75', fontSize: 14 }}>
                      {isClosed || row.s2 === null ? '—' : row.s2Total}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', background: isClosed ? rowBg : '#faf9ff', fontFamily: 'monospace', fontWeight: 600, color: '#7F77DD', fontSize: 14 }}>
                      {isClosed ? '—' : row.hasIntraday ? row.siTotal : '—'}
                    </td>
                    <td style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: isClosed ? '#d1d5db' : isBF ? '#b45309' : '#1a1a1a' }}>
                      {isClosed ? 'ΚΛΕΙΣΤΟ' : row.grandTotal}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      {!isClosed && (
                        <>
                          <div style={{ height: 6, background: '#f5f5f3', borderRadius: 3, overflow: 'hidden', marginBottom: 2 }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${barPct}%`, background: isBF ? '#f59e0b' : isHigh ? '#f97316' : '#378ADD' }} />
                          </div>
                          <div style={{ fontSize: 9, color: '#d1d5db', textAlign: 'right' }}>{isExp ? '▲' : '▼ ανάλυση'}</div>
                        </>
                      )}
                      {isBF && <div style={{ fontSize: 9, color: '#b45309' }}>🔥 Black Friday</div>}
                    </td>
                  </tr>

                  {/* Expanded per-role breakdown */}
                  {isExp && (
                    <tr key={`${row.key}-exp`} style={{ background: rowBg, borderBottom: '0.5px solid #f5f5f5' }}>
                      <td colSpan={9} style={{ padding: '0 14px 12px' }}>
                        <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>

                          {/* DD Shift 1 */}
                          <div style={{ flex: 1, background: '#f0f6fe', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, color: '#378ADD', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                              DD Βάρδια 1 · {isSat ? '09:00–17:00' : isSun ? '11:00–19:00' : '07:00–15:00'} · {fmt(isSat || isSun ? row.forecast.due_date : Math.round(row.forecast.due_date / 2))} παρ.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                              {ROLES.map(r => (
                                <div key={r} style={{ textAlign: 'center', background: 'white', borderRadius: 8, padding: '6px 4px' }}>
                                  <div style={{ fontSize: 16, fontWeight: 600, color: ROLE_COLORS[r], fontFamily: 'monospace' }}>{row.s1[r] ?? 0}</div>
                                  <div style={{ fontSize: 9, color: '#9ca3af' }}>{ROLE_LABELS[r]}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* DD Shift 2 — weekdays only */}
                          {row.s2 && (
                          <div style={{ flex: 1, background: '#f0faf5', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ fontSize: 10, color: '#1D9E75', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                              DD Βάρδια 2 · 13:00–21:00 · {fmt(Math.round(row.forecast.due_date / 2))} παρ.
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                              {ROLES.map(r => (
                                <div key={r} style={{ textAlign: 'center', background: 'white', borderRadius: 8, padding: '6px 4px' }}>
                                  <div style={{ fontSize: 16, fontWeight: 600, color: ROLE_COLORS[r], fontFamily: 'monospace' }}>{row.s2![r] ?? 0}</div>
                                  <div style={{ fontSize: 9, color: '#9ca3af' }}>{ROLE_LABELS[r]}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          )}

                          {/* Intraday */}
                          {row.hasIntraday && row.si && (
                            <div style={{ flex: 1, background: '#f4f3fe', borderRadius: 10, padding: '10px 12px' }}>
                              <div style={{ fontSize: 10, color: '#7F77DD', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
                                Intraday · 18:00–02:00 · {fmt(row.forecast.intraday)} παρ.
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                                {ROLES.map(r => (
                                  <div key={r} style={{ textAlign: 'center', background: 'white', borderRadius: 8, padding: '6px 4px' }}>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: ROLE_COLORS[r], fontFamily: 'monospace' }}>{row.si![r] ?? 0}</div>
                                    <div style={{ fontSize: 9, color: '#9ca3af' }}>{ROLE_LABELS[r]}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f9f9f7', borderTop: '1px solid #e5e5e5' }}>
              <td colSpan={4} style={{ padding: '8px 14px', fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                Μέσος όρος — {openRows.length} ανοιχτές ημέρες
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center', background: '#f0f6fe', fontFamily: 'monospace', fontWeight: 700, color: '#378ADD' }}>
                {avgS1Total}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center', background: '#f0faf5', fontFamily: 'monospace', fontWeight: 700, color: '#1D9E75' }}>
                {avgS1Total}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center', background: '#f4f3fe', fontFamily: 'monospace', fontWeight: 700, color: '#7F77DD' }}>
                {avgSiTotal || '—'}
              </td>
              <td style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#1a1a1a' }}>
                {openRows.length ? Math.round(openRows.reduce((s, r) => s + r.grandTotal, 0) / openRows.length) : 0}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
        Κλίκ σε γραμμή για ανάλυση ανά ρόλο · Σάββατο: 1 βάρδια 09–17 · Κυριακή: DD 11–19 + Intraday 18–02
      </div>
    </div>
  )
}
