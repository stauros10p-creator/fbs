import { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
  ComposedChart, Area, ReferenceLine,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────
interface CalendarNote {
  date: string        // YYYY-MM-DD
  note: string
  adjustment: number  // % change, e.g. 40 = +40%, -100 = closed
  type: 'increase' | 'decrease' | 'closed' | 'peak' | 'promo' | 'info'
}

// ── Constants ──────────────────────────────────────────────────────────────────
const DOW_LABELS = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ']
const MONTHS_GR: Record<number, string> = {
  1: 'Ιανουάριος', 2: 'Φεβρουάριος', 3: 'Μάρτιος', 4: 'Απρίλιος',
  5: 'Μάιος', 6: 'Ιούνιος', 7: 'Ιούλιος', 8: 'Αύγουστος',
  9: 'Σεπτέμβριος', 10: 'Οκτώβριος', 11: 'Νοέμβριος', 12: 'Δεκέμβριος',
}
const MONTHS_SHORT: Record<number, string> = {
  6: 'Ιούν', 7: 'Ιούλ', 8: 'Αύγ', 9: 'Σεπ', 10: 'Οκτ', 11: 'Νοε', 12: 'Δεκ',
}

const CAPACITY_LIMIT = 22000 // max orders/day at full staffing

// AutoStore % per month (rest = shelf/ράφι)
const AS_SPLIT: Record<number, number> = {
  6: 0.70, 7: 0.80,
  8: 0.90, 9: 0.90, 10: 0.90, 11: 0.90, 12: 0.90,
}

const DEMAND_SPLIT = [
  { role: 'Picking',  key: 'picker',   pct: 0.45, color: '#378ADD' },
  { role: 'Packing',  key: 'packer',   pct: 0.25, color: '#1D9E75' },
  { role: 'Sorter',   key: 'sorter',   pct: 0.15, color: '#D85A30' },
  { role: 'Returns',  key: 'returns',  pct: 0.10, color: '#7F77DD' },
  { role: 'Άλλα',     key: 'other',    pct: 0.05, color: '#9ca3af' },
]

// Real UPH values (from productivity reports)
const OPERATOR_UPH  = 161  // avg from 1-month operators data
const PICKER_UPH    = 77   // avg from 3-month pickers data
const PACKER_UPH    = 80   // fixed (per operations)
const SORTER_UPH    = 150  // machine-assisted (belt feed + palletizing)
const VALIDATOR_UPH = 50   // packer in training (<55 UPH)
const EFF_HOURS     = 13   // effective daily hours for Due Date (06:00–19:00)
const ROLE_LABELS: Record<string, string> = {
  picker: 'Picker', packer: 'Packer', sorter: 'Sorter',
  operator: 'Operator', validator: 'Validator', transporter: 'Transporter',
}
const ROLE_COLORS: Record<string, string> = {
  picker: '#378ADD', packer: '#1D9E75', sorter: '#D85A30',
  operator: '#7F77DD', validator: '#BA7517', transporter: '#9ca3af',
}
const ROLE_BG: Record<string, string> = {
  picker: '#E6F1FB', packer: '#E1F5EE', sorter: '#FAECE7',
  operator: '#EEEDFE', validator: '#FAEEDA', transporter: '#F1EFE8',
}

// Hourly distribution (% of daily volume per hour)
const HOURLY_DIST = [
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

// ── Forecast 2026 (Jun–Dec) ────────────────────────────────────────────────────
// Due Date orders per day-of-week per month (from Forecast.xlsx — DD only, excl. intraday)
const DD_BASE: Record<number, { mon: number; twt: number; fri: number; sat: number; sun: number }> = {
  6:  { mon: 11267, twt: 10332, fri:  8650, sat:  6055, sun:  7798 },
  7:  { mon: 13135, twt: 12044, fri: 10084, sat:  7059, sun:  9091 },
  8:  { mon: 11566, twt: 10606, fri:  8880, sat:  6216, sun:  8005 },
  9:  { mon: 12989, twt: 11911, fri:  9972, sat:  6980, sun:  8990 },
  10: { mon: 13317, twt: 12212, fri: 10224, sat:  7157, sun:  9217 },
  11: { mon: 17112, twt: 15691, fri: 13137, sat:  9196, sun: 11843 },
  12: { mon: 18243, twt: 16728, fri: 14006, sat:  9804, sun: 12626 },
}

// Intraday orders per day-of-week per month (Mon–Thu + Sun only; Fri/Sat = 0)
const INTRADAY_BASE: Record<number, { mon: number; twt: number; sun: number }> = {
  6:  { mon: 1600, twt: 1500, sun: 1746 },
  7:  { mon: 1865, twt: 1749, sun: 2035 },
  8:  { mon: 1642, twt: 1540, sun: 1792 },
  9:  { mon: 1845, twt: 1729, sun: 2013 },
  10: { mon: 1891, twt: 1773, sun: 2064 },
  11: { mon: 2430, twt: 2278, sun: 2652 },
  12: { mon: 2591, twt: 2429, sun: 2827 },
}

// Special days: override total orders (0 = closed)
const SPECIAL_DAYS: Record<string, number> = {
  '2026-08-15': 1200,   // Δεκαπενταύγουστος
  '2026-10-28': 0,      // Εθνική Εορτή
  '2026-11-27': 38000,  // Black Friday
  '2026-11-28': 28000,  // Black Friday Saturday
  '2026-12-25': 0,      // Χριστούγεννα
  '2026-12-26': 0,      // 2η μέρα Χριστουγέννων
  '2026-12-31': 4500,   // Παραμονή Πρωτοχρονιάς
}

function buildForecast(): Record<string, { total: number; due_date: number; intraday: number }> {
  const out: Record<string, { total: number; due_date: number; intraday: number }> = {}
  const end = new Date('2026-12-31')
  for (let d = new Date('2026-06-01'); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10)
    const m = d.getMonth() + 1
    const dow = (d.getDay() + 6) % 7  // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun

    const ddRow = DD_BASE[m]
    const idRow = INTRADAY_BASE[m]

    // Normal base values for this day-of-week
    const normDD  = dow === 0 ? ddRow.mon : dow <= 3 ? ddRow.twt : dow === 4 ? ddRow.fri : dow === 5 ? ddRow.sat : ddRow.sun
    const normID  = dow === 0 ? idRow.mon : dow <= 3 ? idRow.twt : dow === 4 ? 0 : dow === 5 ? 0 : idRow.sun

    let due_date: number
    let intraday: number

    if (SPECIAL_DAYS[key] !== undefined) {
      const special = SPECIAL_DAYS[key]
      if (special === 0) {
        due_date = 0; intraday = 0
      } else {
        // Scale proportionally from normal day ratio
        const normTotal = normDD + normID
        due_date = normTotal > 0 ? Math.round(special * normDD / normTotal) : special
        intraday = normTotal > 0 ? Math.round(special * normID / normTotal) : 0
      }
    } else {
      // Apply a small ±3% jitter for realism
      const jitter = 1 + Math.sin(d.getTime() / 86_400_000 * 3.7) * 0.03
      due_date = Math.round(normDD * jitter)
      intraday = Math.round(normID * jitter)
    }

    out[key] = { total: due_date + intraday, due_date, intraday }
  }
  return out
}

const FORECAST = buildForecast()

// ── Helpers ────────────────────────────────────────────────────────────────────
function toKey(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function getForDay(key: string, notes: CalendarNote[]) {
  const base = FORECAST[key] ?? { total: 0, due_date: 0, intraday: 0 }
  const note = notes.find(n => n.date === key)
  if (!note || note.adjustment === 0) return base
  const mult = 1 + note.adjustment / 100
  return {
    total:     Math.round(base.total * mult),
    due_date:  Math.round(base.due_date * mult),
    intraday:  Math.round(base.intraday * mult),
  }
}
function staffForOrders(orders: number, month?: number) {
  const asPct     = month ? (AS_SPLIT[month] ?? 0.85) : 0.85
  const asOrders  = Math.round(orders * asPct)
  const rafi      = orders - asOrders
  const packer    = Math.ceil(orders  / (PACKER_UPH   * EFF_HOURS))
  return {
    operator:    Math.max(2, Math.ceil(asOrders / (OPERATOR_UPH * EFF_HOURS))),
    picker:      Math.max(1, Math.ceil(rafi     / (PICKER_UPH   * EFF_HOURS))),
    packer,
    sorter:      Math.max(2, Math.ceil(orders   / (SORTER_UPH   * EFF_HOURS))),
    validator:   Math.max(1, Math.round(packer  * 0.25)),
    transporter: Math.max(2, Math.ceil(orders   / 4500)),
  }
}
function workHours(orders: number, month?: number) {
  const asPct    = month ? (AS_SPLIT[month] ?? 0.85) : 0.85
  const asOrders = Math.round(orders * asPct)
  const rafi     = orders - asOrders
  const h = asOrders / OPERATOR_UPH + rafi / PICKER_UPH
    + orders / PACKER_UPH + orders / SORTER_UPH
  return Math.round(h * 10) / 10
}
function slaScore(orders: number, staff: Record<string, number>) {
  const needed = staffForOrders(orders)
  const coverages = Object.entries(needed).map(([role, req]) => {
    const avail = staff[role] ?? req
    return Math.min(1, avail / req)
  })
  return Math.round((coverages.reduce((a, b) => a + b, 0) / coverages.length) * 100)
}

function fmt(n: number) { return n.toLocaleString('el-GR') }
function fmtDate(d: Date) {
  return d.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// ── Note type configs ──────────────────────────────────────────────────────────
const NOTE_TYPES = [
  { key: 'increase',  label: 'Αύξηση ζήτησης', icon: '📈', color: '#A32D2D', bg: '#FCEBEB' },
  { key: 'decrease',  label: 'Μείωση ζήτησης', icon: '📉', color: '#3B6D11', bg: '#EAF3DE' },
  { key: 'closed',    label: 'Αποθήκη κλειστή', icon: '🔒', color: '#854F0B', bg: '#FAEEDA' },
  { key: 'peak',      label: 'Peak / Καμπάνια', icon: '🔥', color: '#185FA5', bg: '#E6F1FB' },
  { key: 'promo',     label: 'Promo / Εκπτώσεις', icon: '🏷️', color: '#534AB7', bg: '#EEEDFE' },
  { key: 'info',      label: 'Σημείωση', icon: 'ℹ️',  color: '#5F5E5A', bg: '#F1EFE8' },
]

// ── Section components ─────────────────────────────────────────────────────────

// 1. KPI bar
function KPIBar({ day, prev, notes }: { day: string; prev: string; notes: CalendarNote[] }) {
  const today = getForDay(day, notes)
  const yesterday = getForDay(prev, notes)
  const m = parseInt(day.slice(5, 7))
  const staff = staffForOrders(today.total, m)
  const hours = workHours(today.total, m)
  const sla = slaScore(today.total, staff)

  const m = parseInt(day.slice(5, 7))
  const asPct = AS_SPLIT[m] ?? 0.90
  const asOrders = Math.round(today.total * asPct)
  const rafiOrders = today.total - asOrders
  const migrationDone = asPct >= 0.90

  const kpis = [
    { label: 'Due Date', val: fmt(today.due_date), sub: 'παραγγελίες έως 19:00', color: '#378ADD' },
    { label: 'Intraday', val: fmt(today.intraday), sub: 'παραγγελίες 19:00–24:00', color: '#7F77DD' },
    { label: 'Όγκος εργασίας', val: `${hours}h`, sub: `${fmt(today.total)} συνολικές παρ.`, color: '#1a1a1a' },
    {
      label: 'SLA πρόβλεψη',
      val: `${sla}%`,
      sub: sla >= 95 ? '✓ Εντός στόχου' : sla >= 85 ? '⚠ Οριακά' : '✗ Κίνδυνος',
      color: sla >= 95 ? '#3B6D11' : sla >= 85 ? '#854F0B' : '#A32D2D',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: k.color, fontFamily: 'monospace', marginBottom: 4 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* AS vs Ράφι split */}
      <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
          Προέλευση παραγγελιών
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>🤖</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>AutoStore</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: '#378ADD', fontFamily: 'monospace' }}>{fmt(asOrders)}</span>
          <span style={{ fontSize: 11, color: '#378ADD', background: '#E6F1FB', padding: '1px 7px', borderRadius: 20 }}>{Math.round(asPct * 100)}%</span>
        </div>
        <div style={{ color: '#e5e5e5', fontSize: 18 }}>|</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>📦</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>Ράφι</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: '#D85A30', fontFamily: 'monospace' }}>{fmt(rafiOrders)}</span>
          <span style={{ fontSize: 11, color: '#D85A30', background: '#FAECE7', padding: '1px 7px', borderRadius: 20 }}>{Math.round((1 - asPct) * 100)}%</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 10, color: migrationDone ? '#3B6D11' : '#854F0B', background: migrationDone ? '#EAF3DE' : '#FAEEDA', padding: '2px 10px', borderRadius: 20 }}>
          {migrationDone ? '✓ Migration AS 90% ολοκληρώθηκε' : `Migration AS σε εξέλιξη → ${Math.round(asPct * 100)}%`}
        </div>
      </div>
    </div>
  )
}

// 2. Staff cards
function StaffCards({ orders, month }: { orders: number; month?: number }) {
  const staff = staffForOrders(orders, month)
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
        Απαιτούμενο Προσωπικό ανά Ρόλο
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <div key={role} style={{
            background: ROLE_BG[role], border: `0.5px solid ${ROLE_COLORS[role]}30`,
            borderRadius: 10, padding: '12px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: ROLE_COLORS[role], fontFamily: 'monospace' }}>
              {staff[role] ?? 0}
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, color: ROLE_COLORS[role], marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 3a. Demand donut
function DemandDonut({ total }: { total: number }) {
  const data = DEMAND_SPLIT.map(d => ({
    name: d.role,
    value: Math.round(total * d.pct),
    color: d.color,
    pct: Math.round(d.pct * 100),
  }))

  return (
    <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
        Κατανομή Ζήτησης ανά Ημέρα
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flexShrink: 0 }}>
          <ResponsiveContainer width={130} height={130}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                dataKey="value" paddingAngle={2}>
                {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
          {data.map(d => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#1a1a1a', flex: 1 }}>{d.name}</span>
              <span style={{ fontSize: 11, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                {d.pct}% ({fmt(d.value)})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 3b. Weekly stacked bar (required staff per day per role)
function WeeklyStaffChart({ weekStart, notes }: { weekStart: Date; notes: CalendarNote[] }) {
  const data = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    const key = toKey(d)
    const orders = getForDay(key, notes).total
    const staff = staffForOrders(orders, parseInt(key.slice(5, 7)))
    const note = notes.find(n => n.date === key)
    return {
      name: DOW_LABELS[i],
      date: key,
      ...staff,
      total: Object.values(staff).reduce((a, b) => a + b, 0),
      hasNote: !!note,
      noteType: note?.type,
    }
  })

  const roles = ['picker', 'packer', 'sorter', 'operator', 'validator', 'transporter']

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const total = payload.reduce((s: number, p: any) => s + p.value, 0)
    return (
      <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 500, marginBottom: 6 }}>{label} — {total} άτομα</div>
        {payload.map((p: any) => (
          <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#6b7280' }}>
            <span style={{ color: p.fill }}>{ROLE_LABELS[p.dataKey]}</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#1a1a1a' }}>{p.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
        Απαιτούμενο Προσωπικό ανά Ημέρα (εβδομάδα)
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<CustomTooltip />} />
          {roles.map(r => (
            <Bar key={r} dataKey={r} stackId="a" fill={ROLE_COLORS[r]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        {roles.map(r => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: ROLE_COLORS[r] }} />
            <span style={{ fontSize: 10, color: '#9ca3af' }}>{ROLE_LABELS[r]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 4. SLA prediction bars
function SLABars({ day, notes }: { day: string; notes: CalendarNote[] }) {
  const { due_date, intraday, total } = getForDay(day, notes)
  const staff = staffForOrders(total, parseInt(day.slice(5, 7)))

  const scenarios = [
    { label: 'Due Date (έως 19:00)', orders: due_date, cutoff: '19:00', color: '#378ADD' },
    { label: 'Intraday (19:00–24:00)', orders: intraday, cutoff: '24:00', color: '#7F77DD' },
  ]

  return (
    <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
        SLA Success Πρόβλεψη
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {scenarios.map(sc => {
          const score = slaScore(sc.orders, staff)
          const color = score >= 95 ? '#3B6D11' : score >= 85 ? '#854F0B' : '#A32D2D'
          const bg = score >= 95 ? '#EAF3DE' : score >= 85 ? '#FAEEDA' : '#FCEBEB'
          const label = score >= 95 ? 'Εντός στόχου' : score >= 85 ? 'Οριακά' : 'Κίνδυνος'
          return (
            <div key={sc.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>{sc.label}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{fmt(sc.orders)} παρ.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: bg, color }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color, fontFamily: 'monospace' }}>{score}%</span>
                </div>
              </div>
              <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontSize: 9, color: '#d1d5db' }}>0%</span>
                <span style={{ fontSize: 9, color: '#f59e0b', position: 'relative', left: '-5%' }}>95% target</span>
                <span style={{ fontSize: 9, color: '#d1d5db' }}>100%</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 14, padding: '10px 12px', background: '#f9f9f7', borderRadius: 8, fontSize: 11, color: '#6b7280' }}>
        ℹ️ Βασίζεται σε benchmark παραγωγικότητας. Ενημέρωσε τα staffing data για ακριβή πρόβλεψη.
      </div>
    </div>
  )
}

// 5. Hourly throughput
function HourlyThroughput({ total }: { total: number }) {
  const data = HOURLY_DIST.map(h => {
    const recv = Math.round(total * h.recv)
    const comp = Math.round(total * h.comp)
    return { hour: h.hour, recv, comp, delta: comp - recv }
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const recv = payload.find((p: any) => p.dataKey === 'recv')?.value ?? 0
    const comp = payload.find((p: any) => p.dataKey === 'comp')?.value ?? 0
    const delta = comp - recv
    return (
      <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 500, marginBottom: 6 }}>{label}</div>
        <div style={{ color: '#378ADD' }}>Εισερχόμενες: {fmt(recv)}</div>
        <div style={{ color: '#1D9E75' }}>Ολοκληρωμένες: {fmt(comp)}</div>
        <div style={{ color: delta >= 0 ? '#3B6D11' : '#A32D2D', fontWeight: 500 }}>
          Delta: {delta >= 0 ? '+' : ''}{fmt(delta)}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Hourly Throughput
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {[
            { color: '#378ADD', label: 'Εισερχόμενες' },
            { color: '#1D9E75', label: 'Ολοκληρωμένες' },
            { color: '#E24B4A', label: 'Delta (γραμμή)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 3, background: l.color, borderRadius: 2 }} />
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine yAxisId="right" y={0} stroke="#e5e5e5" strokeDasharray="3 3" />
          <Bar yAxisId="left" dataKey="recv" fill="#B5D4F4" barSize={14} radius={[2, 2, 0, 0]} />
          <Bar yAxisId="left" dataKey="comp" fill="#9FE1CB" barSize={14} radius={[2, 2, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="delta" stroke="#E24B4A"
            strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// 6. Monthly summary table
function MonthlyTable() {
  const months = [6, 7, 8, 9, 10, 11, 12]
  const rows = months.map(m => {
    const days = Object.entries(FORECAST)
      .filter(([k]) => parseInt(k.slice(5, 7)) === m)
      .map(([, v]) => v.due_date)  // FBS Suborders = Due Date only
    if (!days.length) return null
    const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length)
    const peak = Math.max(...days)
    const total = days.reduce((a, b) => a + b, 0)
    const status = avg > 15000 ? 'peak' : avg > 11000 ? 'watch' : 'ok'
    return { month: MONTHS_SHORT[m], avg, peak, total, status }
  }).filter(Boolean) as { month: string; avg: number; peak: number; total: number; status: string }[]

  const STATUS_CFG = {
    ok:    { label: 'OK',    color: '#3B6D11', bg: '#EAF3DE' },
    watch: { label: 'Watch', color: '#854F0B', bg: '#FAEEDA' },
    peak:  { label: 'Peak',  color: '#A32D2D', bg: '#FCEBEB' },
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
        Μηνιαία Σύνοψη
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Μήνας', 'Μέση ημ.', 'Peak ημέρα', 'Σύνολο', 'Πίεση'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: '#9ca3af', fontWeight: 500, borderBottom: '0.5px solid #f0f0f0' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const sc = STATUS_CFG[r.status as keyof typeof STATUS_CFG]
            return (
              <tr key={r.month} style={{ borderBottom: '0.5px solid #f5f5f5' }}>
                <td style={{ padding: '9px 10px', fontWeight: 500 }}>{r.month}</td>
                <td style={{ padding: '9px 10px', fontFamily: 'monospace' }}>{fmt(r.avg)}</td>
                <td style={{ padding: '9px 10px', fontFamily: 'monospace', color: r.status === 'peak' ? '#A32D2D' : '#1a1a1a', fontWeight: r.status === 'peak' ? 500 : 400 }}>{fmt(r.peak)}</td>
                <td style={{ padding: '9px 10px', fontFamily: 'monospace', color: '#6b7280' }}>{(r.total / 1000).toFixed(0)}k</td>
                <td style={{ padding: '9px 10px' }}>
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>
                    {sc.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// 7. Calendar with notes + AI insights
function CalendarNotes({ notes, onChange }: { notes: CalendarNote[]; onChange: (n: CalendarNote[]) => void }) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [addingDate, setAddingDate] = useState<string | null>(null)
  const [form, setForm] = useState({ note: '', adjustment: 0, type: 'increase' as CalendarNote['type'] })

  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay = new Date(viewYear, viewMonth + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Mon=0

  const cells: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(viewYear, viewMonth, i + 1)),
  ]

  function noteForDate(d: Date) { return notes.find(n => n.date === toKey(d)) }

  function saveNote() {
    if (!addingDate) return
    const existing = notes.filter(n => n.date !== addingDate)
    if (form.note.trim()) {
      onChange([...existing, { date: addingDate, ...form }])
    }
    setAddingDate(null)
    setForm({ note: '', adjustment: 0, type: 'increase' })
  }

  function removeNote(date: string) {
    onChange(notes.filter(n => n.date !== date))
  }

  // AI-style insights (rule-based)
  const insights = useMemo(() => {
    const results: { icon: string; title: string; body: string; level: 'warn' | 'info' | 'ok' }[] = []
    const upcoming = Array.from({ length: 14 }, (_, i) => {
      const d = addDays(today, i)
      const key = toKey(d)
      return { key, d, data: getForDay(key, notes), note: notes.find(n => n.date === key) }
    })

    // Find peak days
    const peaks = upcoming.filter(u => u.data.total > 18000)
    if (peaks.length) {
      results.push({
        icon: '🔥', level: 'warn',
        title: `Peak αναμένεται ${DOW_LABELS[(peaks[0].d.getDay() + 6) % 7]} ${peaks[0].d.getDate()}/${peaks[0].d.getMonth() + 1}`,
        body: `${fmt(peaks[0].data.total)} παραγγελίες — χρειάζεται ${Object.values(staffForOrders(peaks[0].data.total, peaks[0].d.getMonth() + 1)).reduce((a, b) => a + b, 0)} άτομα.`,
      })
    }

    // Day after closure
    const closures = upcoming.filter(u => u.note?.type === 'closed')
    closures.forEach(cl => {
      const next = addDays(cl.d, 1)
      const nextKey = toKey(next)
      const base = FORECAST[nextKey]
      if (base) {
        const expected = Math.round(base.total * 1.35)
        results.push({
          icon: '📦', level: 'warn',
          title: `Αναμενόμενη αύξηση ${DOW_LABELS[(next.getDay() + 6) % 7]} ${next.getDate()}/${next.getMonth() + 1}`,
          body: `Η αποθήκη ήταν κλειστή — αναμένεται ~+35% backlog (~${fmt(expected)} παρ.).`,
        })
      }
    })

    // Manual adjustments
    const bigAdjust = upcoming.filter(u => u.note && Math.abs(u.note.adjustment) >= 30)
    bigAdjust.forEach(ba => {
      const sign = (ba.note!.adjustment) > 0 ? '+' : ''
      results.push({
        icon: ba.note!.adjustment > 0 ? '📈' : '📉', level: 'info',
        title: `Χειροκίνητη προσαρμογή ${DOW_LABELS[(ba.d.getDay() + 6) % 7]} ${ba.d.getDate()}/${ba.d.getMonth() + 1}`,
        body: `${sign}${ba.note!.adjustment}% — ${ba.note!.note}. Εκτιμώμενες: ${fmt(ba.data.total)} παρ.`,
      })
    })

    // General upcoming high-demand
    const highWeek = upcoming.slice(0, 7).filter(u => u.data.total > 14000 && !u.note)
    if (highWeek.length >= 3) {
      results.push({
        icon: '⚠️', level: 'warn',
        title: 'Αυξημένος όγκος εργασίας εβδομάδας',
        body: `${highWeek.length} ημέρες με >14.000 παρ. — απαιτείται ~${Math.round(highWeek.reduce((a, u) => a + Object.values(staffForOrders(u.data.total, u.d.getMonth() + 1)).reduce((x, y) => x + y, 0), 0) / highWeek.length)} άτομα/ημέρα.`,
      })
    }

    if (!results.length) {
      results.push({ icon: '✅', level: 'ok', title: 'Κανονικός όγκος', body: 'Δεν προβλέπονται ιδιαίτερα peaks τις επόμενες 2 εβδομάδες.' })
    }

    return results
  }, [notes])

  const ntCfg = (type: string) => NOTE_TYPES.find(t => t.key === type)!

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

      {/* Calendar */}
      <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Ημερολόγιο Σημειώσεων
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => {
              const d = new Date(viewYear, viewMonth - 1, 1)
              setViewMonth(d.getMonth()); setViewYear(d.getFullYear())
            }} style={{ background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 12 }}>‹</button>
            <span style={{ fontSize: 12, fontWeight: 500, minWidth: 110, textAlign: 'center' }}>
              {MONTHS_GR[viewMonth + 1]} {viewYear}
            </span>
            <button onClick={() => {
              const d = new Date(viewYear, viewMonth + 1, 1)
              setViewMonth(d.getMonth()); setViewYear(d.getFullYear())
            }} style={{ background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 12 }}>›</button>
          </div>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
          {DOW_LABELS.map(l => (
            <div key={l} style={{ fontSize: 9, color: '#9ca3af', textAlign: 'center', fontWeight: 500 }}>{l}</div>
          ))}
        </div>

        {/* Cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const key = toKey(d)
            const note = noteForDate(d)
            const isToday = toKey(today) === key
            const inForecast = !!FORECAST[key]
            const forecast = inForecast ? getForDay(key, []) : null
            const isPeak = forecast && forecast.total > 20000
            const nc = note ? ntCfg(note.type) : null
            return (
              <div key={key} onClick={() => { setAddingDate(key); setForm(note ? { note: note.note, adjustment: note.adjustment, type: note.type } : { note: '', adjustment: 0, type: 'increase' }) }}
                title={note ? note.note : ''}
                style={{
                  borderRadius: 6, padding: '4px 3px', cursor: 'pointer', textAlign: 'center',
                  border: isToday ? '1.5px solid #1a1a1a' : '0.5px solid #f0f0f0',
                  background: note ? nc!.bg : isPeak ? '#FAEEDA' : '#fafafa',
                  transition: 'all 0.1s',
                  minHeight: 36,
                }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 600 : 400, color: note ? nc!.color : '#1a1a1a' }}>
                  {d.getDate()}
                </div>
                {note && <div style={{ fontSize: 9 }}>{nc!.icon}</div>}
                {isPeak && !note && <div style={{ fontSize: 8, color: '#854F0B' }}>peak</div>}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '0.5px solid #f0f0f0' }}>
          {NOTE_TYPES.slice(0, 4).map(nt => (
            <div key={nt.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 10 }}>{nt.icon}</span>
              <span style={{ fontSize: 9, color: '#9ca3af' }}>{nt.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Insights */}
      <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '16px 18px' }}>
        <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>
          ✨ AI Insights
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((ins, i) => {
            const borderColor = ins.level === 'warn' ? '#E24B4A' : ins.level === 'ok' ? '#1D9E75' : '#378ADD'
            const bgColor = ins.level === 'warn' ? '#FCEBEB' : ins.level === 'ok' ? '#EAF3DE' : '#E6F1FB'
            return (
              <div key={i} style={{ background: bgColor, borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${borderColor}` }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', marginBottom: 3 }}>
                  {ins.icon} {ins.title}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>{ins.body}</div>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid #f0f0f0' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>Πρόσφατες σημειώσεις</div>
          {notes.length === 0 ? (
            <div style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', padding: '10px 0' }}>
              Κλίκ σε ημερομηνία για να προσθέσεις σημείωση
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[...notes].sort((a, b) => a.date.localeCompare(b.date)).slice(-5).map(n => {
                const nc = ntCfg(n.type)
                const d = new Date(n.date + 'T12:00:00')
                return (
                  <div key={n.date} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 12 }}>{nc.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: nc.color }}>
                        {d.getDate()}/{d.getMonth() + 1} — {n.adjustment !== 0 ? `${n.adjustment > 0 ? '+' : ''}${n.adjustment}%` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>{n.note}</div>
                    </div>
                    <button onClick={() => removeNote(n.date)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#d1d5db', padding: '0 2px' }}>×</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Note Modal */}
      {addingDate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
        }} onClick={() => setAddingDate(null)}>
          <div style={{ background: 'white', borderRadius: 16, width: 400, padding: '20px', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>
                📅 {new Date(addingDate + 'T12:00:00').toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <button onClick={() => setAddingDate(null)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Type select */}
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Τύπος</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {NOTE_TYPES.map(nt => (
                    <button key={nt.key} onClick={() => setForm(f => ({ ...f, type: nt.key as CalendarNote['type'] }))}
                      style={{
                        border: form.type === nt.key ? `1.5px solid ${nt.color}` : '0.5px solid #e5e5e5',
                        borderRadius: 8, padding: '7px 4px', cursor: 'pointer', fontSize: 10, fontWeight: 500,
                        background: form.type === nt.key ? nt.bg : 'white',
                        color: form.type === nt.key ? nt.color : '#6b7280',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      }}>
                      <span style={{ fontSize: 16 }}>{nt.icon}</span>
                      {nt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adjustment */}
              {form.type !== 'closed' && (
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Προσαρμογή forecast ({form.adjustment > 0 ? '+' : ''}{form.adjustment}%)
                  </div>
                  <input type="range" min={-90} max={150} step={5} value={form.adjustment}
                    onChange={e => setForm(f => ({ ...f, adjustment: parseInt(e.target.value) }))}
                    style={{ width: '100%' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                    <span>-90%</span>
                    <span style={{ fontWeight: 500, color: form.adjustment === 0 ? '#9ca3af' : form.adjustment > 0 ? '#A32D2D' : '#3B6D11' }}>
                      {form.adjustment > 0 ? '+' : ''}{form.adjustment}%
                    </span>
                    <span>+150%</span>
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Σημείωση</div>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="π.χ. Αποθήκη κλειστή αύριο, αναμένω +40% backlog..."
                  style={{ width: '100%', border: '0.5px solid #e5e5e5', borderRadius: 8, padding: '8px 12px', fontSize: 12, resize: 'vertical', minHeight: 72, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setAddingDate(null)} style={{ flex: 1, border: '0.5px solid #e5e5e5', background: 'white', borderRadius: 10, padding: '10px', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>
                  Άκυρο
                </button>
                {notes.find(n => n.date === addingDate) && (
                  <button onClick={() => { removeNote(addingDate); setAddingDate(null) }}
                    style={{ flex: 1, border: '0.5px solid #fca5a5', background: '#fef2f2', borderRadius: 10, padding: '10px', fontSize: 12, cursor: 'pointer', color: '#dc2626' }}>
                    Διαγραφή
                  </button>
                )}
                <button onClick={saveNote} style={{ flex: 2, background: '#1a1a1a', color: 'white', border: 'none', borderRadius: 10, padding: '10px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                  💾 Αποθήκευση
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Annual chart ───────────────────────────────────────────────────────────────
function AnnualChart({ notes }: { notes: CalendarNote[] }) {
  // Weekly aggregates
  const weeks: { label: string; orders: number; month: number }[] = []
  const processed = new Set<string>()
  for (const [key, v] of Object.entries(FORECAST)) {
    const d = new Date(key + 'T12:00:00')
    const dow = (d.getDay() + 6) % 7
    if (dow === 0 && !processed.has(key)) {
      const weekOrders = Array.from({ length: 7 }, (_, i) => {
        const dk = toKey(addDays(d, i))
        processed.add(dk)
        return getForDay(dk, notes).total
      })
      const avg = Math.round(weekOrders.reduce((a, b) => a + b, 0) / 7)
      weeks.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, orders: avg, month: d.getMonth() + 1 })
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ fontWeight: 500 }}>Εβδ. {label}</div>
        <div style={{ color: '#378ADD' }}>Μέση: {fmt(payload[0].value)} παρ./ημέρα</div>
      </div>
    )
  }

  const barColor = (month: number) => {
    if (month === 11) return '#E24B4A'
    if (month === 12) return '#185FA5'
    if (month >= 10) return '#378ADD'
    return '#B5D4F4'
  }

  return (
    <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Πρόβλεψη Ετήσιου Όγκου — Ιούν → Δεκ 2026
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { color: '#B5D4F4', label: 'Ιούν–Σεπ' },
            { color: '#378ADD', label: 'Οκτ' },
            { color: '#185FA5', label: 'Δεκ' },
            { color: '#E24B4A', label: 'Νοε (Peak)' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={weeks} barSize={8}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={3} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={CAPACITY_LIMIT} stroke="#E24B4A" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Capacity', position: 'right', fontSize: 9, fill: '#E24B4A' }} />
          <Bar dataKey="orders" radius={[2, 2, 0, 0]}>
            {weeks.map((w, i) => (
              <Cell key={i} fill={barColor(w.month)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function ForecastPage() {
  const today = new Date()
  const todayKey = toKey(today)
  const tomorrowKey = toKey(addDays(today, 1))

  const [selectedDay, setSelectedDay] = useState(todayKey)
  const [notes, setNotes] = useState<CalendarNote[]>(() => {
    try { return JSON.parse(localStorage.getItem('forecast_notes') ?? '[]') } catch { return [] }
  })

  // Persist notes
  useEffect(() => {
    localStorage.setItem('forecast_notes', JSON.stringify(notes))
  }, [notes])

  const dayData = getForDay(selectedDay, notes)

  // Week start (Monday of selected day)
  const selDate = new Date(selectedDay + 'T12:00:00')
  const weekStart = addDays(selDate, -((selDate.getDay() + 6) % 7))

  const prevDay = toKey(addDays(new Date(selectedDay + 'T12:00:00'), -1))

  const displayDate = new Date(selectedDay + 'T12:00:00')

  const s = {
    label: { fontSize: 11, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: 0.5, fontWeight: 500 },
    section: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#f5f5f0', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ background: 'white', borderBottom: '0.5px solid #e5e5e5', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Forecast</div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#1a1a1a' }}>
              {fmtDate(displayDate)}
              {selectedDay === todayKey && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>σήμερα</span>}
              {selectedDay === tomorrowKey && <span style={{ fontSize: 11, color: '#378ADD', marginLeft: 8 }}>αύριο</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setSelectedDay(todayKey)} style={{
              border: `0.5px solid ${selectedDay === todayKey ? '#1a1a1a' : '#e5e5e5'}`,
              background: selectedDay === todayKey ? '#1a1a1a' : 'white',
              color: selectedDay === todayKey ? 'white' : '#6b7280',
              borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
            }}>Σήμερα</button>
            <button onClick={() => setSelectedDay(tomorrowKey)} style={{
              border: `0.5px solid ${selectedDay === tomorrowKey ? '#1a1a1a' : '#e5e5e5'}`,
              background: selectedDay === tomorrowKey ? '#1a1a1a' : 'white',
              color: selectedDay === tomorrowKey ? 'white' : '#6b7280',
              borderRadius: 20, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
            }}>Αύριο</button>
            <input type="date" value={selectedDay} onChange={e => setSelectedDay(e.target.value)}
              style={{ border: '0.5px solid #e5e5e5', borderRadius: 20, padding: '6px 14px', fontSize: 12, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* 1. KPIs */}
        <KPIBar day={selectedDay} prev={prevDay} notes={notes} />

        {/* 2. Staff cards */}
        <div style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 12, padding: '16px 18px' }}>
          <StaffCards orders={dayData.total} month={parseInt(selectedDay.slice(5, 7))} />
        </div>

        {/* 3. Demand distribution + weekly chart */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <DemandDonut total={dayData.total} />
          <WeeklyStaffChart weekStart={weekStart} notes={notes} />
        </div>

        {/* 4+6. SLA + Hourly side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <SLABars day={selectedDay} notes={notes} />
          <HourlyThroughput total={dayData.total} />
        </div>

        {/* 5. Annual chart */}
        <AnnualChart notes={notes} />

        {/* 7. Monthly table */}
        <MonthlyTable />

        {/* 8. Calendar + insights */}
        <CalendarNotes notes={notes} onChange={setNotes} />

      </div>
    </div>
  )
}
