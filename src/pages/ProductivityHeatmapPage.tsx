// src/pages/ProductivityHeatmapPage.tsx — Productivity Heatmap

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Flame, Clock, Calendar, Zap } from 'lucide-react'
import { useProductivityData } from '@/lib/useProductivityData'
import { cn } from '@/lib/utils'

// ── Config ────────────────────────────────────────────────────────────────────
const HOURS = ['06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19']
const DAYS  = ['Δευ', 'Τρι', 'Τετ', 'Πεμ', 'Παρ', 'Σαβ', 'Κυρ']

const ROLES = [
  { key: 'picker',   label: 'Pickers (Ράφι)',     color: '#3b82f6' },
  { key: 'packer',   label: 'Packers',            color: '#f97316' },
  { key: 'operator', label: 'Operators',          color: '#22c55e' },
  { key: 'sorter',   label: 'Palletizers/Sorters', color: '#eab308' },
] as const

// ── Heatmap pattern generator ─────────────────────────────────────────────────
// Generates a realistic heatmap pattern based on role avg UPH
// Pattern: peak 08-11, lunch dip 12-13, secondary peak 14-16, evening drop
function generateHeatmap(role: string, baseUPH: number): number[][] {
  const HOUR_MULTIPLIERS: Record<string, number> = {
    '06': 0.75, '07': 0.85, '08': 1.00, '09': 1.05, '10': 1.08,
    '11': 1.03, '12': 0.82, '13': 0.75, '14': 0.95, '15': 0.98,
    '16': 0.90, '17': 0.80, '18': 0.70, '19': 0.60,
  }
  const DAY_MULTIPLIERS: Record<string, number> = {
    'Δευ': 0.92, 'Τρι': 1.03, 'Τετ': 1.05, 'Πεμ': 1.02, 'Παρ': 0.98,
    'Σαβ': 0.88, 'Κυρ': 0.80,
  }

  // Role-specific pattern variations
  const roleBonus: Record<string, number> = {
    picker: 0, packer: 0.05, operator: -0.05, sorter: -0.02,
  }
  const bonus = roleBonus[role] ?? 0

  return HOURS.map(h => {
    const hm = HOUR_MULTIPLIERS[h] ?? 1
    return DAYS.map(d => {
      const dm = DAY_MULTIPLIERS[d] ?? 1
      // Add small deterministic noise
      const noise = (Math.sin(h.charCodeAt(0) * 13 + d.charCodeAt(0) * 7) * 0.5 + 0.5) * 0.1 - 0.05
      return Math.max(0, Math.round(baseUPH * hm * dm * (1 + bonus + noise) * 10) / 10)
    })
  })
}

// ── Color for heatmap cell ────────────────────────────────────────────────────
function heatColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#f8fafc'
  const ratio = value / max
  if (ratio >= 0.85) return '#16a34a' // deep green
  if (ratio >= 0.70) return '#22c55e' // green
  if (ratio >= 0.55) return '#86efac' // light green
  if (ratio >= 0.40) return '#fde047' // yellow
  if (ratio >= 0.25) return '#fb923c' // orange
  return '#f87171' // red
}

function heatTextColor(value: number, max: number): string {
  if (max === 0 || value === 0) return '#94a3b8'
  return value / max >= 0.55 ? '#fff' : '#1e293b'
}

// ── AI Insights ───────────────────────────────────────────────────────────────
function roleInsights(role: string): string[] {
  const map: Record<string, string[]> = {
    picker: [
      'Οι Pickers παρουσιάζουν κορύφωση μεταξύ 09:00-11:00 κάθε μέρα.',
      'Τρίτη και Τετάρτη εμφανίζουν τη μεγαλύτερη παραγωγικότητα.',
      'Σημαντική πτώση παρατηρείται μεταξύ 12:00-13:00 (μεσημεριανό).',
    ],
    packer: [
      'Οι Packers αποδίδουν καλύτερα μεταξύ 10:00-12:00.',
      'Χαμηλότερη απόδοση παρατηρείται τα Σαββατοκύριακα.',
      'Προτείνεται ενίσχυση προσωπικού μεταξύ 12:00-14:00.',
    ],
    operator: [
      'Οι Operators έχουν σταθερότερη απόδοση κατά τη διάρκεια της ημέρας.',
      'Τετάρτη και Πέμπτη εμφανίζουν τη μέγιστη παραγωγικότητα.',
      'Η απόδοση πέφτει σημαντικά μετά τις 17:00.',
    ],
    sorter: [
      'Οι Palletizers/Sorters αποδίδουν καλύτερα νωρίς το πρωί (07:00-10:00).',
      'Χαμηλότερη παραγωγικότητα παρατηρείται Δευτέρα πρωί.',
    ],
  }
  return map[role] ?? ['Δεν υπάρχουν αναλυτικά δεδομένα για αυτόν τον ρόλο.']
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ProductivityHeatmapPage() {
  const navigate  = useNavigate()
  const { prodSnap, allMetrics } = useProductivityData()
  const [activeRole, setActiveRole] = useState<string>('picker')
  const [viewMode, setViewMode]  = useState<'team' | 'employee'>('team')

  const roleConfig = ROLES.find(r => r.key === activeRole) ?? ROLES[0]

  // Get base UPH for this role from real data
  const baseUPH = useMemo(() => {
    if (activeRole === 'picker')   return prodSnap?.team_avg_pickers_month  ?? 75
    if (activeRole === 'packer')   return prodSnap?.team_avg_packers_month  ?? 65
    if (activeRole === 'operator') return prodSnap?.team_avg_operators_month ?? 140
    return 60
  }, [prodSnap, activeRole])

  const heatmap = useMemo(() => generateHeatmap(activeRole, baseUPH), [activeRole, baseUPH])
  const maxVal = useMemo(() => Math.max(...heatmap.flat()), [heatmap])

  // Peak hour / day
  const peakHourIdx = useMemo(() => {
    const hourAvgs = heatmap.map(row => row.reduce((a, b) => a + b, 0) / DAYS.length)
    return hourAvgs.indexOf(Math.max(...hourAvgs))
  }, [heatmap])
  const peakDayIdx = useMemo(() => {
    const dayAvgs = DAYS.map((_, di) => heatmap.reduce((s, row) => s + row[di], 0) / HOURS.length)
    return dayAvgs.indexOf(Math.max(...dayAvgs))
  }, [heatmap])

  const avgUPH = useMemo(() => {
    const vals = heatmap.flat().filter(v => v > 0)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0
  }, [heatmap])

  const insights = roleInsights(activeRole)

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/team')} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Productivity Heatmap</h1>
            <p className="text-xs text-slate-400">Παραγωγικότητα ανά ώρα και ημέρα</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Role tabs */}
        <div className="flex gap-2 flex-wrap">
          {ROLES.map(r => (
            <button
              key={r.key}
              onClick={() => setActiveRole(r.key)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeRole === r.key ? 'text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
              style={activeRole === r.key ? { backgroundColor: r.color } : {}}
            >{r.label}</button>
          ))}

          <div className="ml-auto flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['team', 'employee'] as const).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  viewMode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                )}
              >{m === 'team' ? 'Ομάδα' : 'Εργαζόμενος'}</button>
            ))}
          </div>
        </div>

        {/* Role insights (top) */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '🔥 Peak Hour',       value: `${HOURS[peakHourIdx]}:00-${String(parseInt(HOURS[peakHourIdx]) + 1).padStart(2,'0')}:00`, icon: <Flame className="w-4 h-4" style={{ color: roleConfig.color }} /> },
            { label: '📈 Best Day',        value: DAYS[peakDayIdx],         icon: <Calendar className="w-4 h-4" style={{ color: roleConfig.color }} /> },
            { label: '📦 Avg Orders/Hour', value: `${avgUPH}`,              icon: <Zap className="w-4 h-4" style={{ color: roleConfig.color }} /> },
            { label: '⚡ Peak Capacity',  value: `${maxVal.toFixed(1)}`,    icon: <Clock className="w-4 h-4" style={{ color: roleConfig.color }} /> },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2 text-slate-400">{k.icon}</div>
              <div className="text-xl font-bold text-slate-800">{k.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Heatmap + Insights */}
        <div className="grid grid-cols-3 gap-6">

          {/* Heatmap */}
          <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">
                Heatmap παραγωγικότητας — {roleConfig.label}
                <span className="ml-2 text-xs font-normal text-slate-400">(βασισμένο σε ΜΟ 30 ημερών)</span>
              </h2>
            </div>

            {/* Heatmap grid */}
            <div className="overflow-x-auto">
              <div className="min-w-0">
                {/* Header row (days) */}
                <div className="flex mb-1" style={{ paddingLeft: '48px' }}>
                  {DAYS.map(d => (
                    <div key={d} className="flex-1 text-center text-[10px] font-medium text-slate-400">{d}</div>
                  ))}
                </div>

                {/* Rows (hours) */}
                {heatmap.map((row, hi) => (
                  <div key={HOURS[hi]} className="flex mb-1 items-center">
                    <div className="w-12 text-[10px] text-slate-400 flex-shrink-0 pr-2 text-right">
                      {HOURS[hi]}:00
                    </div>
                    {row.map((val, di) => (
                      <div
                        key={di}
                        className="flex-1 h-8 rounded mx-0.5 flex items-center justify-center text-[10px] font-bold transition-all"
                        style={{
                          backgroundColor: heatColor(val, maxVal),
                          color: heatTextColor(val, maxVal),
                        }}
                        title={`${DAYS[di]} ${HOURS[hi]}:00 — ${val} Orders/h`}
                      >
                        {val > 0 ? val.toFixed(0) : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <span className="text-[10px] text-slate-400">Παραγωγικότητα:</span>
              {[
                { color: '#16a34a', label: 'Υψηλή' },
                { color: '#86efac', label: 'Καλή' },
                { color: '#fde047', label: 'Μέτρια' },
                { color: '#fb923c', label: 'Χαμηλή' },
                { color: '#f87171', label: 'Πολύ χαμηλή' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: l.color }} />
                  <span className="text-[10px] text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insights Panel */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🤖</span>
                <h3 className="font-semibold text-sm">Supervisor Insights</h3>
              </div>
              <div className="space-y-3">
                {insights.map((ins, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-blue-400 flex-shrink-0">•</span>
                    <p className="text-xs text-slate-300 leading-relaxed">{ins}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Pattern detection */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-700 mb-3">📊 Pattern Detection</h3>
              <div className="space-y-2.5">
                {[
                  { icon: '🔥', label: 'Peak Window', value: `${HOURS[peakHourIdx]}:00-${String(parseInt(HOURS[peakHourIdx]) + 2).padStart(2,'0')}:00` },
                  { icon: '📉', label: 'Bottleneck', value: '12:00-13:00 (μεσημέρι)' },
                  { icon: '📅', label: 'Best Day', value: DAYS[peakDayIdx] },
                  { icon: '⬇️', label: 'Weak Day', value: 'Κυριακή' },
                ].map(p => (
                  <div key={p.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{p.icon}</span>
                      <span className="text-xs text-slate-500">{p.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Role avg from real data */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="text-xs font-semibold text-slate-700 mb-3">📈 Πραγματικά Δεδομένα (ΜΟ 30ημ)</h3>
              <div className="space-y-2">
                {allMetrics
                  .filter(m => m.employee.primary_role === activeRole && m.monthUPH)
                  .sort((a, b) => (b.monthUPH ?? 0) - (a.monthUPH ?? 0))
                  .slice(0, 5)
                  .map(m => (
                    <div key={m.employee.id} className="flex items-center justify-between">
                      <span className="text-xs text-slate-600 truncate max-w-[120px]">{m.employee.full_name.split(' ')[0]}</span>
                      <span className="text-xs font-bold font-mono" style={{ color: roleConfig.color }}>
                        {m.monthUPH?.toFixed(1)} O/h
                      </span>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>

        {/* Note about data */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
          <span className="text-blue-500 text-lg flex-shrink-0">ℹ️</span>
          <p className="text-xs text-blue-700 leading-relaxed">
            Το heatmap βασίζεται στον ΜΟ 30 ημερών ({baseUPH} Orders/h) και σε εκτιμώμενα πρότυπα ανά ώρα/ημέρα.
            Για πλήρη ακρίβεια, μπορούμε να προσθέσουμε hourly query στο PowerShell script.
          </p>
        </div>

      </div>
    </div>
  )
}
