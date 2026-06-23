// src/pages/ImpactScorePage.tsx — Impact Score Analytics

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts'
import {
  useProductivityData, getRating, getImpactLabel, type EmployeeMetrics,
} from '@/lib/useProductivityData'
import { ROLE_CONFIG } from '@/types'
import { cn, initials } from '@/lib/utils'

// ── Gauge Component ───────────────────────────────────────────────────────────
function ImpactGauge({ score, label, color }: { score: number; label: string; color: string }) {
  const data = [{ value: score, fill: color }]
  return (
    <div className="relative w-32 h-32 mx-auto">
      <RadialBarChart
        width={128} height={128}
        cx={64} cy={64}
        innerRadius={45} outerRadius={60}
        startAngle={225} endAngle={-45}
        data={data}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar dataKey="value" cornerRadius={6} background={{ fill: '#f1f5f9' }} />
      </RadialBarChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold" style={{ color }}>{score}</div>
        <div className="text-[9px] text-slate-400 text-center leading-tight">{label}</div>
      </div>
    </div>
  )
}

// ── Impact Card (for top 10) ──────────────────────────────────────────────────
function ImpactCard({ m, rank }: { m: EmployeeMetrics; rank: number }) {
  const rc = ROLE_CONFIG[m.employee.primary_role]
  const { label, stars, color } = getRating(m.impactScore)
  const impactLabel = getImpactLabel(m.impactScore)
  const impactColor =
    m.impactScore >= 95 ? '#dc2626'
    : m.impactScore >= 85 ? '#f97316'
    : m.impactScore >= 70 ? '#3b82f6'
    : '#94a3b8'

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col items-center text-center hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between w-full mb-3">
        <span className="text-lg font-bold text-slate-300">#{rank}</span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: impactColor }}
        >{impactLabel}</span>
      </div>

      <ImpactGauge score={m.impactScore} label="Impact" color={impactColor} />

      <div className="mt-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-2"
          style={{ background: `${rc?.color}18`, color: rc?.color }}
        >{initials(m.employee.full_name)}</div>
        <div className="font-bold text-slate-800 text-xs">{m.employee.full_name}</div>
        <div className="text-[10px] text-slate-400 mb-2">{rc?.label}</div>
        <span className="text-xs" style={{ color }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
        <div className="text-[10px] font-medium mt-0.5" style={{ color }}>{label}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 w-full">
        <div className="bg-slate-50 rounded-lg p-1.5 text-center">
          <div className="text-sm font-bold font-mono" style={{ color: rc?.color }}>
            {m.todayUPH?.toFixed(1) ?? '—'}
          </div>
          <div className="text-[9px] text-slate-400">Orders/h</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-1.5 text-center">
          <div className={cn('text-sm font-bold font-mono', m.trend == null ? 'text-slate-400' : m.trend >= 0 ? 'text-emerald-500' : 'text-red-500')}>
            {m.trend != null ? `${m.trend > 0 ? '+' : ''}${m.trend}%` : '—'}
          </div>
          <div className="text-[9px] text-slate-400">Trend</div>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ImpactScorePage() {
  const navigate = useNavigate()
  const { allMetrics } = useProductivityData()

  const sorted = useMemo(() =>
    [...allMetrics].sort((a, b) => b.impactScore - a.impactScore),
    [allMetrics]
  )

  const top10 = sorted.slice(0, 10)

  const barData = sorted.slice(0, 15).map(m => ({
    name: m.employee.full_name.split(' ')[0],
    score: m.impactScore,
    role: m.employee.primary_role,
    label: getImpactLabel(m.impactScore),
  }))

  // Distribution by label
  const distribution = useMemo(() => {
    const labels = ['Critical Asset', 'High Impact', 'Valuable Contributor', 'Standard Contributor', 'Developing']
    return labels.map(l => ({
      label: l,
      count: allMetrics.filter(m => getImpactLabel(m.impactScore) === l).length,
    }))
  }, [allMetrics])

  // Summary stats
  const avgImpact = allMetrics.length
    ? Math.round(allMetrics.reduce((s, m) => s + m.impactScore, 0) / allMetrics.length) : 0
  const critical = allMetrics.filter(m => m.impactScore >= 95).length
  const highImpact = allMetrics.filter(m => m.impactScore >= 85).length

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/team')} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Impact Score</h1>
            <p className="text-xs text-slate-400">Αξία εργαζομένου για τη λειτουργία της αποθήκης (0-100)</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Summary KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Μέσο Impact Score', value: avgImpact, color: '#3b82f6', icon: '📊' },
            { label: 'Critical Assets (95+)', value: critical, color: '#dc2626', icon: '🔴' },
            { label: 'High Impact (85+)',      value: highImpact, color: '#f97316', icon: '🟠' },
            { label: 'Top Scorer', value: top10[0]?.impactScore ?? '—', color: '#8b5cf6', icon: '🏆' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-2xl mb-2">{k.icon}</div>
              <div className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</div>
              <div className="text-xs text-slate-400 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Impact Score Legend */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Κλίμακα Impact Score</h2>
          <div className="flex gap-4 flex-wrap">
            {[
              { range: '95-100', label: 'Critical Asset', color: '#dc2626' },
              { range: '85-94',  label: 'High Impact',    color: '#f97316' },
              { range: '70-84',  label: 'Valuable Contributor', color: '#3b82f6' },
              { range: '50-69',  label: 'Standard Contributor', color: '#94a3b8' },
              { range: '0-49',   label: 'Developing',    color: '#e2e8f0' },
            ].map(l => (
              <div key={l.range} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-xs text-slate-600">{l.range} = <strong>{l.label}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-purple-500" />
            <h2 className="text-sm font-semibold text-slate-700">Top 15 Most Impactful Employees</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 0, right: 10, bottom: 0, left: -15 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number, _: string, p: { payload: typeof barData[0] }) => [`${v} (${p.payload.label})`, 'Impact Score']}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                {barData.map((d, i) => {
                  const color = d.score >= 95 ? '#dc2626' : d.score >= 85 ? '#f97316' : d.score >= 70 ? '#3b82f6' : '#94a3b8'
                  return <Cell key={i} fill={color} />
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 cards */}
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Top 10 Most Impactful</h2>
          <div className="grid grid-cols-5 gap-4">
            {top10.map((m, i) => (
              <ImpactCard key={m.employee.id} m={m} rank={i + 1} />
            ))}
          </div>
        </div>

        {/* Full ranking table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Πλήρες Ranking Impact Score</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['#', 'Εργαζόμενος', 'Ρόλος', 'Impact Score', 'Κατηγορία', 'UPH', 'Trend', 'Rating'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sorted.map((m, i) => {
                  const rc = ROLE_CONFIG[m.employee.primary_role]
                  const { label, stars, color } = getRating(m.impactScore)
                  const iLabel = getImpactLabel(m.impactScore)
                  const iColor = m.impactScore >= 95 ? '#dc2626' : m.impactScore >= 85 ? '#f97316' : m.impactScore >= 70 ? '#3b82f6' : '#94a3b8'
                  return (
                    <tr key={m.employee.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-slate-400">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: `${rc?.color}18`, color: rc?.color }}>
                            {initials(m.employee.full_name)}
                          </div>
                          <span className="text-xs font-medium text-slate-700">{m.employee.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${rc?.color}18`, color: rc?.color }}>
                          {rc?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${m.impactScore}%`, backgroundColor: iColor }} />
                          </div>
                          <span className="text-xs font-bold font-mono" style={{ color: iColor }}>{m.impactScore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold" style={{ color: iColor }}>{iLabel}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">{m.todayUPH?.toFixed(1) ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-semibold', m.trend == null ? 'text-slate-300' : m.trend >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                          {m.trend != null ? `${m.trend > 0 ? '+' : ''}${m.trend}%` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs" style={{ color }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
