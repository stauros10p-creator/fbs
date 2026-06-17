import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Users, BarChart2, ChevronRight } from 'lucide-react'
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
    to: '/forecast/staff',
    Icon: Users,
    label: 'Απαιτούμενο Προσωπικό ανά Ημέρα',
    description: 'Εβδομαδιαίο και μηνιαίο πλάνο στελέχωσης βάσει forecast παραγγελιών',
    tags: ['Εβδομάδα', 'Μηνιαίο πλάνο', 'Προσωπικό'],
    accentBg: 'bg-blue-500/10',
    accentText: 'text-blue-500',
    accentBorder: 'hover:border-blue-400/50',
  },
  {
    to: '/forecast/hourly',
    Icon: BarChart2,
    label: 'Forecast Hourly Throughput',
    description: 'Ωριαία πρόβλεψη throughput ανά ημέρα βάσει ιστορικών δεδομένων',
    tags: ['Ανά ώρα', 'Ανά ημέρα', 'Throughput'],
    accentBg: 'bg-purple-500/10',
    accentText: 'text-purple-500',
    accentBorder: 'hover:border-purple-400/50',
  },
]

export function ForecastHubPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Forecast Module"
        title="FORECAST"
        subtitle="Επέλεξε report για να δεις αναλυτικά δεδομένα"
      />

      <div className="p-8">
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

              <div className="font-semibold text-sm text-slate-800 mb-1.5">{r.label}</div>
              <div className="text-xs text-muted leading-relaxed mb-4">{r.description}</div>

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
