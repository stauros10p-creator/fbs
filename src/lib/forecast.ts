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

// ── Real hourly throughput distributions (from throughput_download_packing_totalorders_1month.xlsx)
// Index = hour 0-23. Values = % of daily total. Key = JS day-of-week (0=Sun, 1=Mon ... 6=Sat)
export const PACKED_HOURLY: Record<number, number[]> = {
  1: [2.38,1.25,0.01,0.0,0.0,0.0,0.02,5.08,6.33,5.94,6.06,6.52,5.63,6.69,10.18,8.05,7.04,6.36,5.11,7.35,4.68,1.78,1.05,2.5],
  2: [2.95,1.47,0.0,0.0,0.0,0.0,0.01,4.99,6.89,6.64,6.69,6.41,5.66,6.59,8.96,6.0,6.62,5.79,4.76,7.47,4.88,2.31,1.41,3.49],
  3: [2.85,1.47,0.02,0.0,0.0,0.0,0.04,5.42,6.9,6.42,5.61,5.39,5.17,7.36,9.45,4.8,6.64,6.26,5.58,7.58,6.31,2.39,1.57,2.78],
  4: [3.08,2.38,0.0,0.0,0.0,0.0,0.0,4.22,5.8,6.2,6.31,5.45,5.6,8.56,9.64,7.67,6.68,5.55,4.38,7.34,4.07,2.33,1.28,3.45],
  5: [3.25,0.58,0.0,0.0,0.0,0.0,0.04,5.42,6.64,6.43,7.47,6.98,6.87,8.9,12.38,6.6,6.46,6.95,4.38,6.99,3.64,0.02,0.0,0.0],
  6: [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,8.98,14.35,14.08,13.04,13.22,9.66,15.41,10.88,0.38,0.0,0.0,0.0,0.0,0.0,0.0],
  0: [0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.03,0.0,0.0,7.9,12.88,11.84,11.12,10.75,7.39,12.91,8.27,3.26,3.57,3.62,1.69,4.78],
}

export const DOWNLOADED_HOURLY: Record<number, number[]> = {
  1: [3.71,1.93,0.93,0.45,0.39,0.28,0.51,1.27,2.49,4.16,5.73,6.7,6.78,6.32,6.27,5.65,5.62,5.52,5.66,5.22,5.62,6.13,6.55,6.12],
  2: [3.3,1.86,0.91,0.54,0.35,0.31,0.58,1.43,2.88,4.6,5.84,6.1,6.8,6.02,5.7,5.22,5.41,6.0,5.87,5.58,5.78,6.08,6.77,6.09],
  3: [3.74,1.98,1.05,0.64,0.38,0.35,0.6,1.65,3.03,4.7,5.96,6.31,6.65,6.14,5.9,4.75,6.64,5.54,5.16,5.48,5.14,5.76,6.44,6.04],
  4: [3.8,2.0,0.98,0.57,0.35,0.37,0.58,1.78,3.19,4.88,5.79,6.57,6.72,6.36,5.95,5.86,5.38,5.38,5.3,5.39,5.05,5.84,6.17,5.74],
  5: [3.36,2.06,1.0,0.59,0.44,0.34,0.78,1.84,3.12,4.94,6.12,7.22,7.27,6.52,6.36,6.1,5.9,6.29,6.05,5.11,4.79,4.83,4.68,4.28],
  6: [3.7,1.99,1.12,0.7,0.49,0.33,0.66,1.15,2.55,4.33,5.88,6.63,7.52,6.89,6.28,5.95,5.87,5.95,5.7,5.92,5.8,5.4,4.77,4.41],
  0: [2.82,1.86,1.15,0.66,0.38,0.28,0.34,0.71,1.75,3.51,4.72,5.92,6.56,6.39,6.2,5.57,5.67,6.11,6.3,6.3,6.17,6.97,7.15,6.5],
}

// Returns hourly chart data for a given date using real distributions
export function getHourlyChartData(dateKey: string) {
  const data  = FORECAST[dateKey] ?? { total: 0, due_date: 0, intraday: 0 }
  const dow   = new Date(dateKey + 'T12:00:00').getDay()
  const packedDist   = PACKED_HOURLY[dow]   ?? PACKED_HOURLY[1]
  const downloadDist = DOWNLOADED_HOURLY[dow] ?? DOWNLOADED_HOURLY[1]
  const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`)

  return HOURS.map((hour, i) => ({
    t:          hour,
    packed:     Math.round(data.total * packedDist[i] / 100),
    downloaded: Math.round(data.total * downloadDist[i] / 100),
  }))
}