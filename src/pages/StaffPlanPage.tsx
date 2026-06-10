import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────────
interface CalendarNote {
  date: string
  note: string
  adjustment: number
  type: 'increase' | 'decrease' | 'closed' | 'peak' | 'promo' | 'info'
}

// ── Constants (mirrored from ForecastPage) ─────────────────────────────────────
const AS_SPLIT: Record<number, number> = {
  6: 0.70, 7: 0.80,
  8: 0.90, 9: 0.90, 10: 0.90, 11: 0.90, 12: 0.90,
}
const EFF_HOURS_BY_DOW: Record<number, number> = {
  0: 8, 1: 13, 2: 13, 3: 13, 4: 13, 5: 15, 6: 8,
}
const OPERATOR_UPH = 161
const PICKER_UPH   = 77
const PACKER_UPH   = 80

const ROLE_LABELS: Record<string, string> = {
  picker: 'Picker', packer: 'Packer', sorter: 'Sorter',
  operator: 'Operator', transporter: 'Transporter',
}
const ROLE_COLORS: Record<string, string> = {
  picker: '#378ADD', packer: '#1D9E75', sorter: '#D85A30',
  operator: '#7F77DD', transporter: '#9ca3af',
}
const ROLES = ['picker', 'packer', 'sorter', 'operator', 'transporter']

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
const MONTHS_GEN: Record<number, string> = {
  6: 'Ιουνίου', 7: 'Ιουλίου', 8: 'Αυγούστου', 9: 'Σεπτεμβρίου',
  10: 'Οκτωβρίου', 11: 'Νοεμβρίου', 12: 'Δεκεμβρίου',
}
const DOW_GR = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ']

// ── Helpers ────────────────────────────────────────────────────────────────────
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
      const special = SPECIAL_DAYS[key]
      if (special === 0) { due_date = 0; intraday = 0 }
      else {
        const normTotal = normDD + normID
        due_date = normTotal > 0 ? Math.round(special * normDD / normTotal) : special
        intraday = normTotal > 0 ? Math.round(special * normID / normTotal) : 0
      }
    } else {
      const jitter = 1 + Math.sin(d.getTime() / 86_400_000 * 3.7) * 0.03
      due_date = Math.round(normDD * jitter)
      intraday = Math.round(normID * jitter)
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

function staffForOrders(orders: number, dateKey?: string): Record<string, number> {
  const month  = dateKey ? parseInt(dateKey.slice(5, 7)) : undefined
  const asPct  = month ? (AS_SPLIT[month] ?? 0.85) : 0.85
  const asOrders = Math.round(orders * asPct)
  const rafi   = orders - asOrders
  const dow    = dateKey ? new Date(dateKey + 'T12:00:00').getDay() : 1
  const H      = EFF_HOURS_BY_DOW[dow] ?? 13
  const packer = Math.ceil(orders / (PACKER_UPH * H))
  let sorter = 6, transporter = 2
  if (dateKey) {
    if (dow === 6) { sorter = 2; transporter = 1 }
    else if (dow === 0) { sorter = 3; transporter = 2 }
    else if (dow === 5) { sorter = 6; transporter = 2 }
    else { sorter = 7; transporter = 3 }
  }
  return {
    operator:    Math.max(2, Math.ceil(asOrders / (OPERATOR_UPH * H))),
    picker:      Math.max(1, Math.ceil(rafi     / (PICKER_UPH   * H))),
    packer, sorter, transporter,
  }
}

function fmt(n: number) { return n.toLocaleString('el-GR') }

function buildMonthRows(year: number, month: number, notes: CalendarNote[]) {
  const daysInMonth = new Date(year, month, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    const forecast = getForDay(key, notes)
    const ddStaff  = staffForOrders(forecast.due_date, key)
    const dow      = new Date(key + 'T12:00:00').getDay()
    const hasIntraday = forecast.intraday > 0 && dow !== 5 && dow !== 6
    // staffForOrders returns combined totals for sorter/transporter (DD + intraday).
    // Since we split shifts separately, subtract the intraday portion from ddStaff.
    if (hasIntraday) {
      ddStaff.sorter      = Math.max(0, ddStaff.sorter - 1)
      ddStaff.transporter = Math.max(0, ddStaff.transporter - 1)
    }
    let idStaff: Record<string, number> | null = null
    if (hasIntraday) {
      const asPct = AS_SPLIT[month] ?? 0.85
      const asOrders = Math.round(forecast.intraday * asPct)
      const rafi = forecast.intraday - asOrders
      idStaff = {
        operator:    Math.max(1, Math.ceil(asOrders / (OPERATOR_UPH * 8))),
        picker:      Math.max(1, Math.ceil(rafi     / (PICKER_UPH   * 8))),
        packer:      Math.ceil(forecast.intraday / (PACKER_UPH * 8)),
        sorter:      1,
        transporter: 1,
      }
    }
    const combined = ROLES.reduce((acc, r) => {
      acc[r] = (ddStaff[r] ?? 0) + (idStaff?.[r] ?? 0)
      return acc
    }, {} as Record<string, number>)
    const total = Object.values(combined).reduce((a, b) => a + b, 0)
    return { key, dow, forecast, ddStaff, idStaff, hasIntraday, combined, total }
  })
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function StaffPlanPage() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [activeMonth, setActiveMonth] = useState(() => {
    const today = new Date()
    const nm = today.getMonth() + 2  // next month (1-based)
    return nm > 12 ? 1 : nm
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem('forecast_notes')
      if (raw) setNotes(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const year = 2026
  const rows = buildMonthRows(year, activeMonth, notes)
  const openRows = rows.filter(r => r.forecast.total > 0)
  const avgTotal = openRows.length
    ? Math.round(openRows.reduce((s, r) => s + r.total, 0) / openRows.length)
    : 0
  const avgByRole = ROLES.reduce((acc, r) => {
    acc[r] = openRows.length
      ? Math.round(openRows.reduce((s, row) => s + (row.combined[r] ?? 0), 0) / openRows.length)
      : 0
    return acc
  }, {} as Record<string, number>)

  const maxTotal = Math.max(...rows.map(r => r.total), 1)

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button
          onClick={() => navigate('/forecast')}
          style={{
            background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 8,
            padding: '6px 12px', fontSize: 13, color: '#6b7280', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ← Forecast
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>
            Σχεδιασμός Προσωπικού
          </h1>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
            Απαιτούμενο προσωπικό ανά ημέρα — βάσει forecast
          </div>
        </div>
      </div>

      {/* Month tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {[6, 7, 8, 9, 10, 11, 12].map(m => (
          <button
            key={m}
            onClick={() => setActiveMonth(m)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              border: 'none',
              background: activeMonth === m ? '#1a1a1a' : '#f5f5f3',
              color: activeMonth === m ? 'white' : '#6b7280',
              transition: 'all 0.15s',
            }}
          >
            {MONTHS_GR[m]}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
        {ROLES.map(r => (
          <div key={r} style={{
            background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 10,
            padding: '10px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: ROLE_COLORS[r], textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
              {ROLE_LABELS[r]}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: ROLE_COLORS[r], fontFamily: 'monospace' }}>
              {avgByRole[r]}
            </div>
            <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>μ.ο./ημέρα</div>
          </div>
        ))}
        <div style={{
          background: '#1a1a1a', borderRadius: 10, padding: '10px 12px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
            Σύνολο
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'white', fontFamily: 'monospace' }}>
            {avgTotal}
          </div>
          <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2 }}>μ.ο./ημέρα</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9f9f7', borderBottom: '0.5px solid #e5e5e5' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#9ca3af', fontWeight: 500 }}>Ημ/νία</th>
                <th style={{ padding: '10px 8px', color: '#9ca3af', fontWeight: 500, textAlign: 'center' }}>Ημέρα</th>
                <th style={{ padding: '10px 8px', color: '#378ADD', fontWeight: 500, textAlign: 'center' }}>DD παρ.</th>
                <th style={{ padding: '10px 8px', color: '#7F77DD', fontWeight: 500, textAlign: 'center' }}>Intraday</th>
                {ROLES.map(r => (
                  <th key={r} style={{ padding: '10px 8px', color: ROLE_COLORS[r], fontWeight: 500, textAlign: 'center' }}>
                    {ROLE_LABELS[r]}
                  </th>
                ))}
                <th style={{ padding: '10px 14px', color: '#1a1a1a', fontWeight: 600, textAlign: 'center' }}>Σύνολο</th>
                <th style={{ padding: '10px 14px', color: '#9ca3af', fontWeight: 400, textAlign: 'left', width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isSun  = row.dow === 0
                const isSat  = row.dow === 6
                const isClosed = row.forecast.total === 0
                const isBlackFriday = row.key === '2026-11-27' || row.key === '2026-11-28'
                const isHighload = row.forecast.total > 15000
                const rowBg = isClosed
                  ? '#fef9f9'
                  : isBlackFriday ? '#fffbeb'
                  : isHighload ? '#fefce8'
                  : idx % 2 === 0 ? 'white' : '#fcfcfb'

                const barWidth = isClosed ? 0 : Math.round((row.total / maxTotal) * 100)

                return (
                  <tr key={row.key} style={{ background: rowBg, borderBottom: '0.5px solid #f5f5f5' }}>
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
                    {ROLES.map(r => (
                      <td key={r} style={{ padding: '8px 8px', textAlign: 'center', fontFamily: 'monospace', color: isClosed ? '#d1d5db' : ROLE_COLORS[r], fontWeight: 500 }}>
                        {isClosed ? '—' : row.combined[r]}
                      </td>
                    ))}
                    <td style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: isClosed ? '#d1d5db' : isBlackFriday ? '#b45309' : '#1a1a1a', fontSize: isClosed ? 11 : 14 }}>
                      {isClosed ? 'ΚΛΕΙΣΤΟ' : row.total}
                    </td>
                    <td style={{ padding: '8px 14px' }}>
                      {!isClosed && (
                        <div style={{ position: 'relative', height: 6, background: '#f5f5f3', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            width: `${barWidth}%`,
                            background: isBlackFriday ? '#f59e0b' : isHighload ? '#f97316' : '#378ADD',
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      )}
                      {isBlackFriday && (
                        <div style={{ fontSize: 9, color: '#b45309', marginTop: 2 }}>🔥 Black Friday</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f9f9f7', borderTop: '1px solid #e5e5e5' }}>
                <td colSpan={4} style={{ padding: '8px 14px', fontSize: 11, color: '#6b7280', fontWeight: 500 }}>
                  Μέσος όρος — {openRows.length} ανοιχτές ημέρες
                </td>
                {ROLES.map(r => (
                  <td key={r} style={{ padding: '8px 8px', textAlign: 'center', fontFamily: 'monospace', color: ROLE_COLORS[r], fontWeight: 600 }}>
                    {avgByRole[r]}
                  </td>
                ))}
                <td style={{ padding: '8px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#1a1a1a' }}>
                  {avgTotal}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
        Τα νούμερα προσωπικού συμπεριλαμβάνουν και τις δύο βάρδιες (Due Date + Intraday) εφόσον υπάρχουν.
        Sorter/Transporter είναι σταθερά ανά δομή βάρδιας.
      </div>
    </div>
  )
}
