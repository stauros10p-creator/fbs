import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ── Types ──────────────────────────────────────────────────────────────────────
interface RoleStaff { rolling: number; night: number }
interface DayPlan {
  orders: number
  op:  RoleStaff
  pack: RoleStaff
  pick: RoleStaff
  pal:  RoleStaff
}
type DayKey = 'mon' | 'twt' | 'fri' | 'sat' | 'sun'

// ── Staff plan data (from actual planning) ─────────────────────────────────────
// Rolling = total across 2 daytime shifts (each shift gets rolling/2)
// Night   = additional night shift headcount
const PLAN: Record<number, Record<DayKey, DayPlan>> = {
  6: {
    mon: { orders: 12867, op: { rolling: 8,  night: 1 }, pack: { rolling: 16, night: 3 }, pick: { rolling: 4, night: 1 }, pal: { rolling: 6, night: 2 } },
    twt: { orders: 11832, op: { rolling: 6,  night: 1 }, pack: { rolling: 14, night: 3 }, pick: { rolling: 4, night: 1 }, pal: { rolling: 6, night: 2 } },
    fri: { orders:  8650, op: { rolling: 5,  night: 0 }, pack: { rolling: 13, night: 0 }, pick: { rolling: 4, night: 0 }, pal: { rolling: 6, night: 0 } },
    sat: { orders:  6055, op: { rolling: 4,  night: 0 }, pack: { rolling: 10, night: 0 }, pick: { rolling: 2, night: 0 }, pal: { rolling: 3, night: 0 } },
    sun: { orders:  9544, op: { rolling: 4,  night: 1 }, pack: { rolling: 12, night: 3 }, pick: { rolling: 2, night: 1 }, pal: { rolling: 3, night: 2 } },
  },
  7: {
    mon: { orders: 15000, op: { rolling: 8,  night: 2 }, pack: { rolling: 22, night: 3 }, pick: { rolling: 3, night: 1 }, pal: { rolling: 6, night: 2 } },
    twt: { orders: 13793, op: { rolling: 8,  night: 2 }, pack: { rolling: 22, night: 3 }, pick: { rolling: 3, night: 1 }, pal: { rolling: 6, night: 2 } },
    fri: { orders: 10084, op: { rolling: 6,  night: 0 }, pack: { rolling: 15, night: 0 }, pick: { rolling: 2, night: 0 }, pal: { rolling: 6, night: 0 } },
    sat: { orders:  7059, op: { rolling: 4,  night: 0 }, pack: { rolling: 12, night: 0 }, pick: { rolling: 2, night: 0 }, pal: { rolling: 3, night: 0 } },
    sun: { orders: 11126, op: { rolling: 5,  night: 2 }, pack: { rolling: 15, night: 3 }, pick: { rolling: 2, night: 1 }, pal: { rolling: 3, night: 2 } },
  },
  8: {
    mon: { orders: 13208, op: { rolling: 6,  night: 2 }, pack: { rolling: 17, night: 3 }, pick: { rolling: 3, night: 1 }, pal: { rolling: 6, night: 2 } },
    twt: { orders: 12146, op: { rolling: 6,  night: 1 }, pack: { rolling: 17, night: 3 }, pick: { rolling: 3, night: 1 }, pal: { rolling: 6, night: 2 } },
    fri: { orders:  8880, op: { rolling: 5,  night: 0 }, pack: { rolling: 14, night: 0 }, pick: { rolling: 0, night: 0 }, pal: { rolling: 0, night: 0 } },
    sat: { orders:  6216, op: { rolling: 4,  night: 0 }, pack: { rolling: 10, night: 0 }, pick: { rolling: 0, night: 0 }, pal: { rolling: 0, night: 0 } },
    sun: { orders:  9797, op: { rolling: 4,  night: 2 }, pack: { rolling: 12, night: 3 }, pick: { rolling: 2, night: 1 }, pal: { rolling: 3, night: 2 } },
  },
  9: {
    mon: { orders: 14833, op: { rolling: 6,  night: 2 }, pack: { rolling: 22, night: 3 }, pick: { rolling: 3, night: 1 }, pal: { rolling: 6, night: 2 } },
    twt: { orders: 13640, op: { rolling: 6,  night: 2 }, pack: { rolling: 20, night: 3 }, pick: { rolling: 3, night: 1 }, pal: { rolling: 6, night: 2 } },
    fri: { orders:  9972, op: { rolling: 6,  night: 0 }, pack: { rolling: 17, night: 0 }, pick: { rolling: 3, night: 0 }, pal: { rolling: 6, night: 0 } },
    sat: { orders:  6980, op: { rolling: 4,  night: 0 }, pack: { rolling: 12, night: 0 }, pick: { rolling: 2, night: 0 }, pal: { rolling: 3, night: 0 } },
    sun: { orders: 11003, op: { rolling: 4,  night: 2 }, pack: { rolling: 15, night: 3 }, pick: { rolling: 2, night: 1 }, pal: { rolling: 3, night: 2 } },
  },
}

const MONTHS_GR: Record<number, string> = {
  6: 'Ιούνιος', 7: 'Ιούλιος', 8: 'Αύγουστος', 9: 'Σεπτέμβριος',
}
const DOW_GR = ['Κυρ', 'Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ']
const DAY_TYPE_LABELS: Record<DayKey, string> = {
  mon: 'Δευτέρα', twt: 'Τρι–Πεμ', fri: 'Παρασκευή', sat: 'Σάββατο', sun: 'Κυριακή',
}

function dowToDayKey(dow: number): DayKey {
  if (dow === 1) return 'mon'
  if (dow === 2 || dow === 3 || dow === 4) return 'twt'
  if (dow === 5) return 'fri'
  if (dow === 6) return 'sat'
  return 'sun' // 0
}

function planTotal(p: DayPlan): number {
  return p.op.rolling + p.op.night + p.pack.rolling + p.pack.night +
         p.pick.rolling + p.pick.night + p.pal.rolling + p.pal.night
}

function shiftTotal(p: DayPlan, shift: 'A' | 'B' | 'night', singleShift = false): number {
  if (shift === 'night') {
    return p.op.night + p.pack.night + p.pick.night + p.pal.night
  }
  if (singleShift) {
    // Sat & Sun: rolling = the one shift, no division
    return p.op.rolling + p.pack.rolling + p.pick.rolling + p.pal.rolling
  }
  // Mon-Fri: rolling split equally across 2 shifts
  return Math.ceil(p.op.rolling / 2) + Math.ceil(p.pack.rolling / 2) +
         Math.ceil(p.pick.rolling / 2) + Math.ceil(p.pal.rolling / 2)
}

function fmt(n: number) { return n.toLocaleString('el-GR') }

const ROLE_COLS = [
  { key: 'op',   label: 'Operators', color: '#7c3aed' },
  { key: 'pack', label: 'Packers',   color: '#0d9488' },
  { key: 'pick', label: 'Pickers',   color: '#2563eb' },
  { key: 'pal',  label: 'Pal/Sort',  color: '#d97706' },
] as const

// ── Page ───────────────────────────────────────────────────────────────────────
export function StaffPlanPage() {
  const navigate = useNavigate()
  const [activeMonth, setActiveMonth] = useState(6)
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const monthPlan = PLAN[activeMonth]
  const year = 2026
  const daysInMonth = new Date(year, activeMonth, 0).getDate()

  // Build per-day list
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const dateStr = `${year}-${String(activeMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dow = new Date(dateStr + 'T12:00:00').getDay()
    const key = dowToDayKey(dow)
    const plan = monthPlan[key]
    return { dateStr, day, dow, key, plan }
  })

  // Summary per day type for selected month
  const DAY_KEYS: DayKey[] = ['mon', 'twt', 'fri', 'sat', 'sun']

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-center gap-4 mb-1">
          <button
            onClick={() => navigate('/forecast')}
            className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            ← Forecast
          </button>
          <h1 className="text-xl font-bold text-slate-800">Σχεδιασμός Προσωπικού</h1>
        </div>
        <p className="text-xs text-slate-400 ml-12">
          Rolling = και στις 2 βάρδιες (Β1+Β2), άρα Rolling/2 ανά βάρδια · Night = νυχτερινή βάρδια
        </p>
      </div>

      <div className="p-8 space-y-6">
        {/* Month tabs */}
        <div className="flex gap-2">
          {[6, 7, 8, 9].map(m => (
            <button
              key={m}
              onClick={() => { setActiveMonth(m); setExpandedDay(null) }}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                activeMonth === m
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {MONTHS_GR[m]}
            </button>
          ))}
        </div>

        {/* Day-type summary table */}
        <div className="panel p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Σύνοψη ανά τύπο ημέρας — {MONTHS_GR[activeMonth]}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">Ημέρα</th>
                <th className="text-right px-4 py-3 text-xs text-slate-400 font-medium">Παραγγελίες</th>
                {ROLE_COLS.map(r => (
                  <th key={r.key} className="px-4 py-3 text-xs font-medium text-center" style={{ color: r.color }}>
                    <div>{r.label}</div>
                    <div className="text-slate-300 font-normal">Roll · Night</div>
                  </th>
                ))}
                <th className="text-center px-3 py-3 text-xs font-medium" style={{ color: '#2563eb', background: '#eff6ff' }}>Β1 Morning</th>
                <th className="text-center px-3 py-3 text-xs font-medium" style={{ color: '#0d9488', background: '#f0fdfa' }}>Β2 Evening</th>
                <th className="text-center px-3 py-3 text-xs font-medium" style={{ color: '#7c3aed', background: '#faf5ff' }}>Night</th>
                <th className="text-center px-5 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">Σύνολο</th>
              </tr>
            </thead>
            <tbody>
              {DAY_KEYS.map((dk, i) => {
                const p = monthPlan[dk]
                const total = planTotal(p)
                const isSingleShift = dk === 'sat' || dk === 'sun'
                const perShift = shiftTotal(p, 'A', isSingleShift)
                const nightTotal = shiftTotal(p, 'night')
                return (
                  <tr key={dk} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                    <td className="px-5 py-3 font-medium text-slate-700">{DAY_TYPE_LABELS[dk]}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600">{fmt(p.orders)}</td>
                    {ROLE_COLS.map(r => {
                      const rs = p[r.key as keyof Pick<DayPlan, 'op'|'pack'|'pick'|'pal'>] as RoleStaff
                      return (
                        <td key={r.key} className="px-4 py-3 text-center">
                          <span className="font-mono font-semibold" style={{ color: r.color }}>{rs.rolling}</span>
                          {rs.night > 0
                            ? <span className="font-mono text-slate-400"> · {rs.night}</span>
                            : <span className="text-slate-200"> · —</span>
                          }
                        </td>
                      )
                    })}
                    <td className="px-3 py-3 text-center" style={{ background: '#f8fbff' }}>
                      <span className="font-mono font-semibold text-blue-600">{perShift}</span>
                    </td>
                    <td className="px-3 py-3 text-center" style={{ background: '#f7fdfb' }}>
                      <span className="font-mono font-semibold" style={{ color: isSingleShift ? '#d1d5db' : '#0d9488' }}>{isSingleShift ? '—' : perShift}</span>
                    </td>
                    <td className="px-3 py-3 text-center" style={{ background: '#fdf9ff' }}>
                      <span className="font-mono font-semibold" style={{ color: nightTotal > 0 ? '#7c3aed' : '#d1d5db' }}>{nightTotal > 0 ? nightTotal : '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="font-mono font-bold text-slate-800 text-base">{isSingleShift ? perShift : total}</span>
                      {nightTotal > 0 && (
                        <div className="text-[10px] text-slate-400">{total - nightTotal} + {nightTotal}N</div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Per-day calendar */}
        <div className="panel p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ημερολόγιο — {MONTHS_GR[activeMonth]} {year}
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-5 py-3 text-xs text-slate-400 font-medium uppercase tracking-wider">Ημ/νία</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Ημέρα</th>
                <th className="text-right px-4 py-3 text-xs text-slate-400 font-medium">Παραγγελίες</th>
                <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: '#2563eb', background: '#eff6ff' }}>Β1 (07–15)</th>
                <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: '#0d9488', background: '#f0fdfa' }}>Β2 (13–21)</th>
                <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: '#7c3aed', background: '#faf5ff' }}>Night</th>
                <th className="text-center px-5 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">Σύνολο</th>
              </tr>
            </thead>
            <tbody>
              {days.map(({ dateStr, day, dow, key, plan }, idx) => {
                const isSat = dow === 6
                const isSun = dow === 0
                const isWeekend = isSat || isSun
                const sA = shiftTotal(plan, 'A', isWeekend)
                const sB = isWeekend ? 0 : shiftTotal(plan, 'B') // Sat/Sun = single shift
                const sN = shiftTotal(plan, 'night')
                const total = planTotal(plan)
                const isExp = expandedDay === dateStr

                return (
                  <>
                    <tr
                      key={dateStr}
                      onClick={() => setExpandedDay(prev => prev === dateStr ? null : dateStr)}
                      className={`border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${
                        isWeekend ? 'bg-slate-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-white'
                      }`}
                    >
                      <td className="px-5 py-2.5 font-mono text-slate-700 font-medium">
                        {String(day).padStart(2, '0')}/{String(activeMonth).padStart(2, '0')}
                      </td>
                      <td className={`px-4 py-2.5 text-xs font-medium ${isWeekend ? 'text-violet-500' : 'text-slate-500'}`}>
                        {DOW_GR[dow]}
                        <span className="ml-2 text-slate-300 text-[10px]">{DAY_TYPE_LABELS[key]}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500 text-xs">{fmt(plan.orders)}</td>
                      <td className="px-4 py-2.5 text-center font-mono font-semibold text-blue-600" style={{ background: '#f8fbff' }}>
                        {sA}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-semibold" style={{ color: isWeekend ? '#d1d5db' : '#0d9488', background: '#f7fdfb' }}>
                        {isWeekend ? '—' : sB}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono font-semibold" style={{ color: sN > 0 ? '#7c3aed' : '#d1d5db', background: '#fdf9ff' }}>
                        {sN > 0 ? sN : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-center font-mono font-bold text-slate-800 text-base">
                        {isWeekend ? sA : total}
                      </td>
                    </tr>

                    {/* Expanded row — per role breakdown */}
                    {isExp && (
                      <tr key={`${dateStr}-exp`} className="border-b border-slate-100">
                        <td colSpan={7} className="px-5 pb-4 pt-1">
                          <div className="grid grid-cols-3 gap-3">

                            {/* Shift A */}
                            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                              <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-3">
                                Βάρδια Α · 07:00–15:00
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {ROLE_COLS.map(r => {
                                  const rs = plan[r.key as keyof Pick<DayPlan,'op'|'pack'|'pick'|'pal'>] as RoleStaff
                                  const count = isWeekend ? rs.rolling : Math.ceil(rs.rolling / 2)
                                  return (
                                    <div key={r.key} className="text-center bg-white rounded-lg py-2">
                                      <div className="text-lg font-bold font-mono" style={{ color: r.color }}>{count}</div>
                                      <div className="text-[9px] text-slate-400">{r.label}</div>
                                    </div>
                                  )
                                })}
                              </div>
                              <div className="text-xs text-blue-500 font-semibold mt-2 text-right">Σύνολο: {sA}</div>
                            </div>

                            {/* Shift B — not on Saturday/Sunday */}
                            <div className={`rounded-xl border p-4 ${isWeekend ? 'border-slate-100 bg-slate-50 opacity-40' : 'border-teal-100 bg-teal-50/50'}`}>
                              <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-3">
                                Βάρδια Β · 13:00–21:00 {isWeekend ? '(—)' : ''}
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {ROLE_COLS.map(r => {
                                  const rs = plan[r.key as keyof Pick<DayPlan,'op'|'pack'|'pick'|'pal'>] as RoleStaff
                                  const half = Math.ceil(rs.rolling / 2)
                                  return (
                                    <div key={r.key} className="text-center bg-white rounded-lg py-2">
                                      <div className="text-lg font-bold font-mono" style={{ color: isWeekend ? '#9ca3af' : r.color }}>{isWeekend ? '—' : half}</div>
                                      <div className="text-[9px] text-slate-400">{r.label}</div>
                                    </div>
                                  )
                                })}
                              </div>
                              <div className="text-xs text-teal-500 font-semibold mt-2 text-right">{isWeekend ? '—' : `Σύνολο: ${sB}`}</div>
                            </div>

                            {/* Night shift */}
                            <div className={`rounded-xl border p-4 ${sN === 0 ? 'border-slate-100 bg-slate-50 opacity-40' : 'border-violet-100 bg-violet-50/50'}`}>
                              <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-3">
                                Νυχτερινή · 18:00–02:00 {sN === 0 ? '(—)' : ''}
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {ROLE_COLS.map(r => {
                                  const rs = plan[r.key as keyof Pick<DayPlan,'op'|'pack'|'pick'|'pal'>] as RoleStaff
                                  return (
                                    <div key={r.key} className="text-center bg-white rounded-lg py-2">
                                      <div className="text-lg font-bold font-mono" style={{ color: rs.night > 0 ? r.color : '#9ca3af' }}>
                                        {rs.night > 0 ? rs.night : '—'}
                                      </div>
                                      <div className="text-[9px] text-slate-400">{r.label}</div>
                                    </div>
                                  )
                                })}
                              </div>
                              <div className="text-xs text-violet-500 font-semibold mt-2 text-right">{sN > 0 ? `Σύνολο: ${sN}` : '—'}</div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="text-center text-xs text-slate-400">
          Κλικ σε ημέρα για ανάλυση ανά ρόλο · Β1 και Β2 έχουν ίσο μέρος του Rolling (R/2 ανά βάρδια) · Σάββατο & Κυριακή = μόνο 1 βάρδια
        </div>
      </div>
    </div>
  )
}
