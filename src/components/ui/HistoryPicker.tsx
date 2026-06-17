import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string          // 'YYYY-MM-DD' ή '' για latest
  onChange: (v: string) => void
  className?: string
}

const today = new Date().toISOString().slice(0, 10)

export function HistoryPicker({ value, onChange, className }: Props) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Calendar className="w-3.5 h-3.5 text-muted" />
      <input
        type="date"
        max={today}
        value={value || today}
        onChange={e => onChange(e.target.value === today ? '' : e.target.value)}
        className="text-xs border border-border rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium"
        >
          Σήμερα
        </button>
      )}
    </div>
  )
}
