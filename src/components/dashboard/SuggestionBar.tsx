import { useState } from 'react'
import { Zap, ChevronRight, Check } from 'lucide-react'
import type { ReallocationSuggestion } from '@/types'
import { ROLE_CONFIG } from '@/types'
import { useApplyReallocation } from '@/hooks'
import toast from 'react-hot-toast'

interface SuggestionBarProps {
  suggestions: ReallocationSuggestion[]
}

export function SuggestionBar({ suggestions }: SuggestionBarProps) {
  const [applied, setApplied] = useState<string[]>([])
  const applyReallocation = useApplyReallocation()

  if (suggestions.length === 0) return null

  const top = suggestions[0]

  async function handleApply(s: ReallocationSuggestion) {
    try {
      await applyReallocation.mutateAsync({
        employee_id: s.employee.id,
        from_role: s.from_role,
        to_role: s.to_role,
      })
      setApplied(prev => [...prev, s.employee.id])
      toast.success(`${s.employee.full_name} redeployed to ${ROLE_CONFIG[s.to_role].label}`)
    } catch {
      toast.error('Failed to apply reallocation')
    }
  }

  async function handleApplyAll() {
    for (const s of suggestions) {
      if (!applied.includes(s.employee.id)) {
        await handleApply(s)
      }
    }
  }

  return (
    <div className="bg-orange/5 border border-orange/25 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Zap className="w-4 h-4 text-orange mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm text-orange font-semibold mb-1">
              Algorithm Recommendation — {suggestions.length} reallocation{suggestions.length > 1 ? 's' : ''} suggested
            </div>
            <div className="space-y-1">
              {suggestions.map(s => (
                <div key={s.employee.id} className="flex items-center gap-2 text-xs text-muted">
                  <span className="text-slate-300">{s.employee.full_name}</span>
                  <span>{ROLE_CONFIG[s.from_role].label}</span>
                  <ChevronRight className="w-3 h-3 text-orange" />
                  <span className="text-orange">{ROLE_CONFIG[s.to_role].label}</span>
                  <span className="text-green">+{s.capacity_gain}/hr</span>
                  {applied.includes(s.employee.id) && (
                    <span className="text-green font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Applied
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {suggestions.length > 1 && (
            <button
              onClick={handleApplyAll}
              disabled={applyReallocation.isPending || suggestions.every(s => applied.includes(s.employee.id))}
              className="btn-primary text-xs"
            >
              Apply All
            </button>
          )}
          <button
            onClick={() => handleApply(top)}
            disabled={applyReallocation.isPending || applied.includes(top.employee.id)}
            className="btn-primary text-xs"
          >
            {applied.includes(top.employee.id) ? '✓ Applied' : 'Apply →'}
          </button>
        </div>
      </div>
    </div>
  )
}
