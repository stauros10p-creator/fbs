import { useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { BarChart2, TrendingUp, Activity, Clock, ChevronRight, CalendarCheck, PackageOpen, Radio } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { FC, SVGProps } from 'react'

interface ReportCard {
  to: string
  Icon: FC<SVGProps<SVGSVGElement> & { className?: string }>
  label: string
  description: string
  tags: string[]
  accentBg: string
  accentText: string
  accentBorder: string
  disabled?: boolean
}

const REPORTS: ReportCard[] = [
  {
    to: '/ops/otd',
    Icon: TrendingUp,
    label: 'Today vs Yesterday vs Last Week',
    description: 'Σύγκριση απόδοσης της ημέρας έναντι χθες και της ίδιας μέρας την περσινή εβδομάδα',
    tags: ['Πολ/κες', 'Μον/κες', 'AutoStore', 'Ογκώδη', 'Gift', 'Υπόλοιπα'],
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-500',
    accentBorder: 'hover:border-blue-400/50',
  },
  {
    to: '/ops/throughput',
    Icon: BarChart2,
    label: 'Throughput Packing & Download',
    description: 'Ανά ώρα σύγκριση packed orders έναντι downloaded orders για ένα ή περισσότερες ημέρες',
    tags: ['Ανά ώρα', 'Packed', 'Downloaded', 'Διαφορά'],
    accentBg: 'bg-green-500/10',
    accentText: 'text-green-500',
    accentBorder: 'hover:border-green-400/50',
  },
  {
    to: '/ops/duedate',
    Icon: CalendarCheck,
    label: 'Due Date Report',
    description: 'Ολοκληρωμένες σήμερα ανά due date (OTD %) και εκκρεμείς / χρεωστούμενες παραγγελίες',
    tags: ['OTD %', 'Εγκαίρως', 'Χρεωστ.', 'Ανά ημέρα'],
    accentBg: 'bg-teal-500/10',
    accentText: 'text-teal-600',
    accentBorder: 'hover:border-teal-400/50',
  },
  {
    to: '/ops/live',
    Icon: Radio,
    label: 'Live Operations',
    description: 'Ζωντανά δεδομένα παραλαβών (IN/Ret, Inbound, Putaway) και αποστολών (Packed, Picking, Pending)',
    tags: ['Live', 'Inbound', 'Outbound', 'Picking', 'Packed'],
    accentBg: 'bg-red-500/10',
    accentText: 'text-red-500',
    accentBorder: 'hover:border-red-400/50',
  },
  {
    to: '/ops/inbound',
    Icon: PackageOpen,
    label: 'Throughput Παραλαβών & Putaway',
    description: 'Ανά ώρα παραλαβές (Inbound) και τοποθέτηση (Putaway) τεμαχίων από LOCATION_TRANSACTIONS',
    tags: ['Ανά ώρα', 'Inbound', 'Putaway', 'Εκκρεμεί'],
    accentBg: 'bg-orange-500/10',
    accentText: 'text-orange-500',
    accentBorder: 'hover:border-orange-400/50',
  },
  {
    to: '/ops/picking',
    Icon: Activity,
    label: 'Throughput Picking & Download',
    description: 'Ανά ώρα σύγκριση picking vs downloaded orders',
    tags: ['Ανά ώρα', 'Picking', 'Downloaded'],
    accentBg: 'bg-purple-500/10',
    accentText: 'text-purple-500',
    accentBorder: 'hover:border-purple-400/50',
    disabled: true,
  },
  {
    to: '/ops/intraday',
    Icon: Clock,
    label: 'IntraDay Throughput',
    description: 'Throughput αναλυτικά για intraday παραγγελίες',
    tags: ['IntraDay', 'Ανά ώρα', 'Packed'],
    accentBg: 'bg-orange-500/10',
    accentText: 'text-orange-500',
    accentBorder: 'hover:border-orange-400/50',
    disabled: true,
  },
]

function PackedPickingWidget() {
  const [live, setLive] = useState<any>(null)

  useEffect(() => {
    supabase.from('live_snapshots').select('*').order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) setLive(data) })
  }, [])

  const out = live?.data?.outbound
  if (!out) return null

  const pickingTotal = (out.picking_rafi ?? 0) + (out.picking_autostore ?? 0)
  const packedTotal  = out.packed_total ?? 0
  const pct = (p: number, k: number) => k > 0 ? Math.round((p / k) * 100) : null
  const pctColor = (v: number | null) =>
    v == null ? 'text-slate-400' : v >= 90 ? 'text-green-600' : v >= 70 ? 'text-amber-500' : 'text-red-500'

  const rows = [
    { label: 'Ράφι',      packed: out.packed_rafi,     picking: out.picking_rafi,      p: pct(out.packed_rafi, out.picking_rafi) },
    { label: 'AutoStore', packed: out.packed_autostore, picking: out.picking_autostore, p: pct(out.packed_autostore, out.picking_autostore) },
    { label: 'Σύνολο',   packed: packedTotal,          picking: pickingTotal,          p: pct(packedTotal, pickingTotal), bold: true },
  ]

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-red-500" />
          <span className="text-sm font-semibold text-slate-800">Live — Packed vs Picking</span>
          {live && <span className="text-[10px] text-muted font-mono">{live.generated_at}</span>}
        </div>
        <Link to="/ops/live" className="text-xs text-blue-600 font-medium hover:underline">Αναλυτικά →</Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted uppercase border-b border-slate-100 bg-slate-50/50">
            <th className="text-left px-5 py-2 font-medium"></th>
            <th className="text-right px-5 py-2 font-medium text-green-600">Packed</th>
            <th className="text-right px-5 py-2 font-medium text-blue-600">Picking</th>
            <th className="text-right px-5 py-2 font-medium">Packed / Picking</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className={cn('border-b border-slate-50', r.bold && 'bg-slate-50 font-semibold')}>
              <td className="px-5 py-2 text-slate-700">{r.label}</td>
              <td className="px-5 py-2 text-right font-mono text-green-600">{r.packed.toLocaleString('el-GR')}</td>
              <td className="px-5 py-2 text-right font-mono text-blue-600">{r.picking.toLocaleString('el-GR')}</td>
              <td className={cn('px-5 py-2 text-right font-mono font-semibold', pctColor(r.p))}>
                {r.p != null ? `${r.p}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function OpsSnapshotPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="OPERATIONS"
        subtitle="Επέλεξε report για να δεις αναλυτικά δεδομένα"
      />

      <div className="p-8 space-y-6">
        <PackedPickingWidget />
        <div className="grid grid-cols-2 gap-5">
          {REPORTS.map((r, i) => (
            <button
              key={i}
              onClick={() => !r.disabled && navigate(r.to)}
              disabled={r.disabled}
              className={`panel text-left transition-all border border-border group ${
                r.disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : `cursor-pointer ${r.accentBorder}`
              }`}
            >
              {/* Icon + title row */}
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${r.accentBg}`}>
                  <r.Icon className={`w-5 h-5 ${r.accentText}`} />
                </div>
                {!r.disabled && (
                  <ChevronRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
                )}
                {r.disabled && (
                  <span className="text-[10px] font-mono text-muted border border-border rounded px-1.5 py-0.5">
                    σύντομα
                  </span>
                )}
              </div>

              {/* Title */}
              <div className="font-semibold text-sm text-slate-800 mb-1.5">{r.label}</div>

              {/* Description */}
              <div className="text-xs text-muted leading-relaxed mb-4">{r.description}</div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {r.tags.map(tag => (
                  <span
                    key={tag}
                    className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${r.accentBg} ${r.accentText} border-transparent`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
