// ── Shared Forecast Engine ────────────────────────────────────────────────────
// Used by ForecastPage + DashboardPage. DO NOT import from ForecastPage directly.

export const CAPACITY_LIMIT = 22000

export const AS_SPLIT: Record<number, number> = {
  6: 0.70, 7: 0.80,
  8: 0.90, 9: 0.90, 10: 0.90, 11: 0.90, 12: 0.90,
}

export const OPERATOR_UPH = 190
export const PICKER_UPH   = 77
export const PACKER_UPH   = 80
export const SORTER_UPH   = 150
export const UNITS_PER_ORDER = 7.5  // avg units per order (warehouse benchmark)

export const EFF_HOURS_BY_DOW: Record<number, number> = {
  0: 8,   // Κυριακή
  1: 13,  // Δευτέρα
  2: 13,  // Τρίτη
  3: 13,  // Τετάρτη
  4: 13,  // Πέμπτη
  5: 15,  // Παρασκευή
  6: 8,   // Σάββατο
}

// Due Date orders per day-of-week per month
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

export const SPECIAL_DAYS: Record<string, number> = {
  '2026-08-15': 1200,
  '2026-10-28': 0,
  '2026-11-27': 38000,
  '2026-11-28': 28000,
  '2026-12-25': 0,
  '2026-12-26': 0,
  '2026-12-31': 4500,
}

export const HOURLY_DIST = [
  { hour: '07:00', recv: 0.04, comp: 0.02 },
  { hour: '08:00', recv: 0.08, comp: 0.07 },
  { hour: '09:00', recv: 0.10, comp: 0.09 },
  { hour: '10:00', recv: 0.11, comp: 0.11 },
  { hour: '11:00', recv: 0.10, comp: 0.11 },
  { hour: '12:00', recv: 0.09, comp: 0.10 },
  { hour: '13:00', recv: 0.07, comp: 0.07 },
  { hour: '14:00', recv: 0.10, comp: 0.10 },
  { hour: '15:00', recv: 0.10, comp: 0.11 },
  { hour: '16:00', recv: 0.08, comp: 0.09 },
  { hour: '17:00', recv: 0.07, comp: 0.08 },
  { hour: '18:00', recv: 0.04, comp: 0.04 },
  { hour: '19:00', recv: 0.02, comp: 0.01 },
]

export function toKey(d: Date) { return d.toISOString().slice(0, 10) }
export function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

export function buildForecast(): Record<string, { total: number; due_date: number; intraday: number }> {
  const out: Record<string, { total: number; due_date: number; intraday: number }> = {}
  const end = new Date('2026-12-31')
  for (let d = new Date('2026-06-01'); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    const m = d.getMonth() + 1
    const dow = (d.getDay() + 6) % 7  // 0=Mon … 6=Sun

    const ddRow = DD_BASE[m]
    const idRow = INTRADAY_BASE[m]

    const normDD = dow === 0 ? ddRow.mon : dow <= 3 ? ddRow.twt : dow === 4 ? ddRow.fri : dow === 5 ? ddRow.sat : ddRow.sun
    const normID = dow === 0 ? idRow.mon : dow <= 3 ? idRow.twt : dow === 4 ? 0 : dow === 5 ? 0 : idRow.sun

    let due_date: number
    let intraday: number

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

export const FORECAST = buildForecast()

export function getForDay(key: string, adjustment = 0) {
  const base = FORECAST[key] ?? { total: 0, due_date: 0, intraday: 0 }
  if (!adjustment) return base
  const mult = 1 + adjustment / 100
  return {
    total:    Math.round(base.total * mult),
    due_date: Math.round(base.due_date * mult),
    intraday: Math.round(base.intraday * mult),
  }
}

export function staffForOrders(orders: number, dateKey?: string): Record<string, number> {
  const month   = dateKey ? parseInt(dateKey.slice(5, 7)) : undefined
  const asPct   = month ? (AS_SPLIT[month] ?? 0.85) : 0.85
  const asOrders = Math.round(orders * asPct)
  const rafi    = orders - asOrders
  const dow     = dateKey ? new Date(dateKey + 'T12:00:00').getDay() : 1
  const H       = EFF_HOURS_BY_DOW[dow] ?? 13
  const packer  = Math.ceil(orders / (PACKER_UPH * H))

  let sorter = 6, transporter = 2
  if (dateKey) {
    const d = new Date(dateKey + 'T12:00:00').getDay()
    if (d === 6) { sorter = 2; transporter = 1 }
    else if (d === 0) { sorter = 3; transporter = 2 }
    else if (d === 5) { sorter = 6; transporter = 2 }
    else { sorter = 7; transporter = 3 }
  }

  return {
    operator:    Math.max(2, Math.ceil(asOrders / (OPERATOR_UPH * H))),
    picker:      Math.max(1, Math.ceil(rafi     / (PICKER_UPH   * H))),
    packer,
    sorter,
    transporter,
  }
}

export function workHours(orders: number, month?: number) {
  const asPct    = month ? (AS_SPLIT[month] ?? 0.85) : 0.85
  const asOrders = Math.round(orders * asPct)
  const rafi     = orders - asOrders
  const h = asOrders / OPERATOR_UPH + rafi / PICKER_UPH
    + orders / PACKER_UPH + orders / SORTER_UPH
  return Math.round(h * 10) / 10
}

export function slaScore(orders: number, dateKey?: string): number {
  const staff  = staffForOrders(orders, dateKey)
  const needed = staffForOrders(orders)
  const coverages = Object.entries(needed).map(([role, req]) => {
    const avail = staff[role] ?? req
    return Math.min(1, avail / req)
  })
  return Math.round((coverages.reduce((a, b) => a + b, 0) / coverages.length) * 100)
}

export function fmt(n: number) { return n.toLocaleString('el-GR') }