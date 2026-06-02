import { useState, useEffect } from 'react'
import { useAppStore } from '@/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { useUpsertForecast } from '@/hooks'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export function ForecastPage() {
  const forecast = useAppStore(s => s.todayForecast)
  const engineResult = useAppStore(s => s.engineResult)
  const upsert = useUpsertForecast()

  const [form, setForm] = useState({
    due_date_orders: forecast?.due_date_orders ?? 0,
    same_day_orders: forecast?.same_day_orders ?? 0,
    intraday_orders: forecast?.intraday_orders ?? 0,
    backlog_orders:  forecast?.backlog_orders  ?? 0,
  })

  useEffect(() => {
    if (forecast) {
      setForm({
        due_date_orders: forecast.due_date_orders,
        same_day_orders: forecast.same_day_orders,
        intraday_orders: forecast.intraday_orders,
        backlog_orders:  forecast.backlog_orders,
      })
    }
  }, [forecast?.id])

  const total = form.due_date_orders + form.same_day_orders + form.intraday_orders + form.backlog_orders

  async function handleSave() {
    try {
      await upsert.mutateAsync(form)
      toast.success('Forecast saved')
    } catch {
      toast.error('Failed to save forecast')
    }
  }

  const fields = [
    {
      key: 'due_date_orders',
      label: 'Due Date Orders',
      sub: 'Cutoff → 19:00',
      color: 'text-success',
      border: 'border-success/20',
    },
    {
      key: 'same_day_orders',
      label: 'Same Day Orders',
      sub: 'Cutoff → 13:00 (HIGH PRIORITY)',
      color: 'text-orange',
      border: 'border-orange/20',
    },
    {
      key: 'intraday_orders',
      label: 'Intraday Orders',
      sub: 'Cutoff → 24:00',
      color: 'text-blue',
      border: 'border-blue/20',
    },
    {
      key: 'backlog_orders',
      label: 'Backlog Orders',
      sub: 'Carried from previous day',
      color: 'text-yellow',
      border: 'border-yellow/20',
    },
  ]

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Planning"
        title="DAILY FORECAST"
        subtitle={`Today's order forecast and required staffing — ${new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      <div className="p-8">
        <div className="grid grid-cols-2 gap-8">
          {/* Input section */}
          <div className="space-y-4">
            <div className="panel">
              <div className="text-xs font-bold tracking-widest text-muted uppercase mb-5 pb-2 border-b border-border">
                Order Volumes
              </div>

              <div className="space-y-4">
                {fields.map(({ key, label, sub, color, border }) => (
                  <div key={key} className={cn('flex items-center gap-4 p-4 rounded-lg border bg-surface3/30', border)}>
                    <div className="flex-1">
                      <div className={cn('font-semibold text-sm', color)}>{label}</div>
                      <div className="text-xs text-muted">{sub}</div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={form[key as keyof typeof form]}
                      onChange={e => setForm(prev => ({ ...prev, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="input w-32 text-right font-mono text-xl font-bold"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div>
                  <div className="text-xs text-muted">Total Orders</div>
                  <div className="font-mono text-2xl font-bold text-slate-100">{total.toLocaleString()}</div>
                </div>
                <button onClick={handleSave} disabled={upsert.isPending} className="btn-primary">
                  {upsert.isPending ? 'Saving…' : 'Save Forecast'}
                </button>
              </div>
            </div>
          </div>

          {/* Required staffing output */}
          <div className="space-y-4">
            <div className="panel">
              <div className="text-xs font-bold tracking-widest text-success uppercase mb-4 pb-2 border-b border-border">
                Required Staffing (Calculated)
              </div>

              {engineResult ? (
                <div className="space-y-3">
                  {engineResult.role_capacity.map(rc => {
                    const ok = rc.active_count >= rc.required_count
                    return (
                      <div key={rc.role} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                        <div className="capitalize font-medium text-slate-200">{rc.role}</div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted">
                            {rc.active_count} active
                          </span>
                          <span className="text-xs text-muted">/</span>
                          <span className={cn('font-mono text-sm font-bold', ok ? 'text-success' : 'text-red')}>
                            {rc.required_count} needed
                          </span>
                          <span className={cn('font-mono text-xs', ok ? 'text-success' : 'text-red')}>
                            {ok ? '✓' : `−${Math.abs(rc.gap)}`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted text-sm">
                  Save forecast to compute staffing
                </div>
              )}
            </div>

            {/* SLA Risk Summary */}
            {engineResult && (
              <div className="panel">
                <div className="text-xs font-bold tracking-widest text-muted uppercase mb-4 pb-2 border-b border-border">
                  SLA Risk by Type
                </div>
                <div className="space-y-3">
                  {([
                    { type: 'same_day', label: 'Same Day', cutoff: '13:00' },
                    { type: 'due_date', label: 'Due Date', cutoff: '19:00' },
                    { type: 'intraday', label: 'Intraday', cutoff: '24:00' },
                  ] as const).map(({ type, label, cutoff }) => {
                    const risk = engineResult.sla_risk[type]
                    const pct = Math.round(risk * 100)
                    const color = pct < 30 ? 'bg-success' : pct < 60 ? 'bg-yellow' : pct < 80 ? 'bg-orange' : 'bg-red'
                    const textColor = pct < 30 ? 'text-success' : pct < 60 ? 'text-yellow' : pct < 80 ? 'text-orange' : 'text-red'
                    return (
                      <div key={type}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted">{label} → {cutoff}</span>
                          <span className={cn('font-mono font-bold', textColor)}>{pct}% risk</span>
                        </div>
                        <div className="h-1.5 bg-surface3 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

