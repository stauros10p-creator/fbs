import { PageHeader } from '@/components/ui/PageHeader'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Construction } from 'lucide-react'

export function OpsOtdPage() {
  const navigate = useNavigate()
  return (
    <div className="flex-1 flex flex-col">
      <PageHeader title="OpsOtdPage" subtitle="Operations Report" />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
        <Construction className="w-12 h-12 opacity-40" />
        <p className="text-sm">Η σελίδα είναι υπό επαναφόρτωση</p>
        <button
          onClick={() => navigate('/ops')}
          className="flex items-center gap-2 text-xs text-blue-500 hover:text-blue-400"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Πίσω στα Reports
        </button>
      </div>
    </div>
  )
}
