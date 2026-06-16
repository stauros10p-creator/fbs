import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { BarChart2, TrendingUp, Activity, Clock } from 'lucide-react'

const REPORTS = [
  {
    to: '/ops/otd',
    Icon: TrendingUp,
    label: 'Today vs Yesterday vs Last Week',
    description: 'Σύγκριση packed orders, AutoStore, Ογκώδη, Gift και υπόλοιπα προς εκτέλεση',
    accent: 'text-blue-400',
    border: 'hover:border-blue-500/40',
  },
  {
    to: '/ops/throughput',
    Icon: BarChart2,
    label: 'Throughput Packing & Download',
    description: 'Ανά ώρα σύγκριση packed vs downloaded orders',
    accent: 'text-green-400',
    border: 'hover:border-green-500/40',
  },
  {
    to: '/ops/throughput',
    Icon: Activity,
    label: 'Throughput Picking & Download',
    description: 'Ανά ώρα σύγκριση picking vs downloaded orders',
    accent: 'text-purple-400',
    border: 'hover:border-purple-500/40',
    disabled: true,
  },
  {
    to: '/ops/throughput',
    Icon: Clock,
    label: 'IntraDay Throughput',
    description: 'Throughput αναλυτικά για intraday παραγγελίες',
    accent: 'text-orange-400',
    border: 'hover:border-orange-500/40',
    disabled: true,
  },
]

export function OpsSnapshotPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="OPERATIONS"
        subtitle="Επέλεξε report για να δεις αναλυτικά δεδομένα"
      />

      <div className="p-8">
        <div className="grid grid-cols-2 gap-4">
          {REPORTS.map((r, i) => (
            <button
              key={i}
              onClick={() => !r.disabled && navigate(r.to)}
              disabled={r.disabled}
              className={`panel text-left transition-all border border-border ${
                r.disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : `cursor-pointer ${r.border} hover:bg-surface3/40`
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 ${r.accent}`}>
                  <r.Icon className="w-6 h-6" />
                </div>
                <div>
                  <div className={`font-semibold text-sm mb-1 ${r.disabled ? 'text-muted' : 'text-white'}`}>
                    {r.label}
                    {r.disabled && <span className="ml-2 text-xs font-normal text-muted">(σύντομα)</span>}
                  </div>
                  <div className="text-xs text-muted leading-relaxed">{r.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
