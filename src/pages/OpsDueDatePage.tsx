import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RefreshCw, ArrowLeft, CheckCircle, Clock, X } from 'lucide-react'
import { HistoryPicker } from '@/components/ui/HistoryPicker'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'

interface CompletedRow {
  DUEDATE: string
  ONTIME:  number | null
  EARLY:   number | null
  LATE:    number | null
  TOTAL:   number | null
}

interface PendingRow {
  DUEDATE:   string
  PENDING:   number | null
  INTRADAY:  number | null
  AUTOSTORE: number | null
  POLIKES:   number | null
  MONIKES:   number | null
}

interface OrderRow {
  ORDERID:  string | number
  DUEDATE:  string
  DONEDATE?: string | null
}

interface DueDateSnapshot {
  id:              number
  generated_at:    string
  completed_today: CompletedRow[]
  pending:         PendingRow[]
  late_orders:     OrderRow[]
  ontime_orders:   OrderRow[]
  pending_orders:  OrderRow[]
}

function fmt(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('el-GR')
}

function otdPct(row: CompletedRow): number | null {
  if (!row.TOTAL) return null
  return parseFloat((((row.ONTIME ?? 0) + (row.EARLY ?? 0)) / row.TOTAL * 100).toFixed(2))
}

function fmtPct(n: number): string {
  return n.toFixed(2) + '%'
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

function isOverdue(dateStr: string): boolean {
  return dateStr < new Date().toISOString().slice(0, 10)
}

// ── Modal ──────────────────────────────────────────────────────────────────────
function OrderModal({
  title, orders, onClose, accentColor
}: {
  title: string
  orders: OrderRow[]
  onClose: () => void
  accentColor: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-xl border border-border w-full max-w-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <div className={cn('text-sm font-bold', accentColor)}>{title}</div>
            <div className="text-xs text-muted mt-0.5">{orders.length.toLocaleString('el-GR')} παραγγελίες</div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-3 px-5 py-2 bg-slate-50 border-b border-border text-[11px] text-muted uppercase tracking-wider flex-shrink-0">
          <div>Order ID</div>
          <div className="text-center">Due Date</div>
          <div className="text-center">Done Date</div>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1">
          {orders.map((o, i) => (
            <div key={i} className="grid grid-cols-3 px-5 py-2 border-b border-border/50 hover:bg-slate-50 text-sm">
              <div className="font-mono font-semibold text-slate-800">{o.ORDERID}</div>
              <div className="text-center font-mono text-slate-600">{o.DUEDATE}</div>
              <div className="text-center font-mono text-slate-500">{o.DONEDATE ?? '—'}</div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-center py-10 text-muted text-sm">Δεν υπάρχουν δεδομένα</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function OpsDueDatePage() {
  const navigate = useNavigate()
  const [snapshot, setSnapshot]       = useState<DueDateSnapshot | null>(null)
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [modal, setModal]             = useState<'ontime' | 'late' | 'pending' | null>(null)
  const [historyDate, setHistoryDate] = useState('')

  async function load(showRefresh = false, date = historyDate) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    let q = supabase.from('due_date_snapshots').select('*').order('created_at', { ascending: false }).limit(1)
    if (date) {
      q = q.gte('generated_at', date + ' 00:00:00').lte('generated_at', date + ' 23:59:59')
    }
    const { data, error } = await q.single()
    if (!error && data) setSnapshot(data as DueDateSnapshot)
    else if (error) setSnapshot(null)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load(false, historyDate) }, [historyDate])

  const completed    = snapshot?.completed_today ?? []
  const pending      = snapshot?.pending ?? []
  const lateOrders    = snapshot?.late_orders ?? []
  const ontimeOrders  = snapshot?.ontime_orders ?? []
  const pendingOrders = snapshot?.pending_orders ?? []

  const totalCompleted = completed.reduce((s, r) => s + (r.TOTAL ?? 0), 0)
  const totalOnTime    = completed.reduce((s, r) => s + (r.ONTIME ?? 0) + (r.EARLY ?? 0), 0)
  const totalLate      = completed.reduce((s, r) => s + (r.LATE ?? 0), 0)
  const totalPending   = pending.reduce((s, r) => s + (r.PENDING ?? 0), 0)
  const totalOverdue   = pending.filter(r => isOverdue(r.DUEDATE)).reduce((s, r) => s + (r.PENDING ?? 0), 0)
  const overallOtd     = totalCompleted ? parseFloat(((totalOnTime / totalCompleted) * 100).toFixed(2)) : null

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="DUE DATE REPORT"
        subtitle="Ολοκληρωμένες σήμερα & εκκρεμείς ανά ημερομηνία"
        actions={
          <div className="flex items-center gap-2">
            <HistoryPicker value={historyDate} onChange={setHistoryDate} />
            <button onClick={() => navigate('/ops')} className="btn-secondary text-xs flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Πίσω
            </button>
            <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary text-xs flex items-center gap-1.5">
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} /> Refresh
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {loading && <div className="text-center py-20 text-muted text-sm">Loading...</div>}

        {!loading && !snapshot && (
          <div className="text-center py-20 text-muted text-sm">
            {historyDate ? `Δεν υπάρχει snapshot για ${historyDate}` : 'No data. Run the script first.'}
          </div>
        )}

        {!loading && snapshot && (
          <>
            <div className="text-xs text-muted font-mono">⏱ {snapshot.generated_at}</div>

            {/* Chart — Bar (σύνολο) + Line (OTD%) ανά Due Date */}
            {completed.length > 0 && (() => {
              const OTD_TARGET = 99.3
              const chartData = [...completed]
                .sort((a, b) => a.DUEDATE.localeCompare(b.DUEDATE))
                .map(r => {
                  const total = r.TOTAL ?? 0
                  const good  = (r.ONTIME ?? 0) + (r.EARLY ?? 0)
                  const pct   = total > 0 ? parseFloat((good / total * 100).toFixed(2)) : null
                  return {
                    date: r.DUEDATE.slice(5).replace('-', '/'), // MM/DD
                    Σύνολο: total,
                    'OTD %': pct,
                  }
                })
              return (
                <div className="panel">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-bold tracking-widest text-muted uppercase">OTD % ανά Due Date</div>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-blue-200" />Σύνολο</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-0.5 bg-green-500" />OTD %</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block w-6 h-0.5 bg-red-400 border-dashed border-t-2" />Στόχος {OTD_TARGET}%</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ef" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={45}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
                      <YAxis yAxisId="right" orientation="right" domain={[95, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }}
                        axisLine={false} tickLine={false} width={40} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, border: '1px solid #e2e6ef', borderRadius: 8 }}
                        formatter={(v: number, name: string) =>
                          name === 'OTD %' ? `${v}%` : v.toLocaleString('el-GR')
                        }
                      />
                      <ReferenceLine yAxisId="right" y={OTD_TARGET} stroke="#f87171" strokeDasharray="5 4" strokeWidth={1.5} />
                      <Bar yAxisId="left" dataKey="Σύνολο" fill="#bfdbfe" radius={[3,3,0,0]} />
                      <Line yAxisId="right" type="monotone" dataKey="OTD %" stroke="#22c55e" strokeWidth={2}
                        dot={{ r: 4, fill: '#22c55e' }} activeDot={{ r: 5 }} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}

            {/* KPI cards — Εγκαίρως & Με καθυστέρηση are clickable */}
            <div className="grid grid-cols-4 gap-4">
              <div className="panel text-center">
                <div className="text-xs text-muted uppercase tracking-widest mb-1">Ολοκληρωμένες σήμερα</div>
                <div className="text-2xl font-bold font-mono text-slate-800">{fmt(totalCompleted)}</div>
              </div>

              <button
                onClick={() => ontimeOrders.length > 0 && setModal('ontime')}
                className={cn(
                  'panel text-center transition-all border border-border',
                  ontimeOrders.length > 0 ? 'cursor-pointer hover:border-green-400/50 hover:bg-green-50/30' : 'cursor-default'
                )}
              >
                <div className="text-xs text-muted uppercase tracking-widest mb-1">Εγκαίρως</div>
                <div className="text-2xl font-bold font-mono text-green-500">{fmt(totalOnTime)}</div>
                {ontimeOrders.length > 0 && (
                  <div className="text-[10px] text-green-400 mt-1">κλικ για λίστα →</div>
                )}
              </button>

              <button
                onClick={() => lateOrders.length > 0 && setModal('late')}
                className={cn(
                  'panel text-center transition-all border border-border',
                  lateOrders.length > 0 ? 'cursor-pointer hover:border-red-400/50 hover:bg-red-50/30' : 'cursor-default'
                )}
              >
                <div className="text-xs text-muted uppercase tracking-widest mb-1">Με καθυστέρηση</div>
                <div className={cn('text-2xl font-bold font-mono', totalLate > 0 ? 'text-red-500' : 'text-muted')}>
                  {fmt(totalLate)}
                </div>
                {lateOrders.length > 0 && (
                  <div className="text-[10px] text-red-400 mt-1">κλικ για λίστα →</div>
                )}
              </button>

              <button
                onClick={() => pendingOrders.length > 0 && setModal('pending')}
                className={cn(
                  'panel text-center transition-all border border-border',
                  pendingOrders.length > 0 ? 'cursor-pointer hover:border-orange-400/50 hover:bg-orange-50/30' : 'cursor-default'
                )}
              >
                <div className="text-xs text-muted uppercase tracking-widest mb-1">Εκκρεμείς</div>
                <div className={cn('text-2xl font-bold font-mono', totalPending > 0 ? 'text-orange-500' : 'text-muted')}>
                  {fmt(totalPending)}
                </div>
                {pendingOrders.length > 0 && (
                  <div className="text-[10px] text-orange-400 mt-1">κλικ για λίστα →</div>
                )}
              </button>
            </div>

            {/* OTD % overall */}
            {overallOtd !== null && (
              <div className="panel flex items-center gap-4">
                <CheckCircle className={cn('w-5 h-5', overallOtd >= 95 ? 'text-green-500' : overallOtd >= 85 ? 'text-orange-400' : 'text-red-500')} />
                <div>
                  <div className="text-xs text-muted uppercase tracking-wider">OTD σήμερα (Εγκαίρως + Νωρίς)</div>
                  <div className={cn('text-2xl font-bold', overallOtd >= 95 ? 'text-green-500' : overallOtd >= 85 ? 'text-orange-400' : 'text-red-500')}>
                    {fmtPct(overallOtd)}
                  </div>
                </div>
                <div className="ml-auto text-xs text-muted">
                  {fmt(totalOnTime)} εγκαίρως από {fmt(totalCompleted)} συνολικά
                </div>
              </div>
            )}

            {/* Completed table */}
            <div className="panel p-0 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-border flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs font-bold tracking-widest text-muted uppercase">
                  Ολοκληρωμένες σήμερα ανά Due Date
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-muted uppercase tracking-wider border-b border-border bg-slate-50/50">
                    <th className="text-left px-5 py-2 font-medium">Due Date</th>
                    <th className="text-right px-5 py-2 font-medium">Σύνολο</th>
                    <th className="text-right px-5 py-2 font-medium">Εγκαίρως</th>
                    <th className="text-right px-5 py-2 font-medium">Νωρίς</th>
                    <th className="text-right px-5 py-2 font-medium">Αργά</th>
                    <th className="text-right px-5 py-2 font-medium">OTD %</th>
                  </tr>
                </thead>
                <tbody>
                  {completed.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-muted text-xs">Δεν υπάρχουν δεδομένα</td></tr>
                  )}
                  {completed.map(row => {
                    const pct  = otdPct(row)
                    const late = row.LATE ?? 0
                    return (
                      <tr key={row.DUEDATE} className="border-b border-border/50 hover:bg-slate-50">
                        <td className="px-5 py-2.5 font-mono text-slate-700 font-medium">
                          {row.DUEDATE}
                          {isToday(row.DUEDATE) && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-sans">σήμερα</span>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono font-semibold text-slate-800">{fmt(row.TOTAL)}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-green-500">{fmt(row.ONTIME)}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-blue-500">{fmt(row.EARLY)}</td>
                        <td className={cn('px-5 py-2.5 text-right font-mono font-semibold', late > 0 ? 'text-red-500' : 'text-muted')}>
                          {fmt(row.LATE)}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          {pct !== null && (
                            <span className={cn(
                              'text-xs font-bold px-2 py-0.5 rounded',
                              pct >= 95 ? 'bg-green-100 text-green-600' :
                              pct >= 85 ? 'bg-orange-100 text-orange-500' :
                              'bg-red-100 text-red-500'
                            )}>{fmtPct(pct)}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {completed.length > 1 && (
                    <tr className="bg-slate-50 border-t border-border font-semibold">
                      <td className="px-5 py-2 text-slate-700">Σύνολο</td>
                      <td className="px-5 py-2 text-right font-mono text-slate-800">{fmt(totalCompleted)}</td>
                      <td className="px-5 py-2 text-right font-mono text-green-500">{fmt(totalOnTime)}</td>
                      <td className="px-5 py-2 text-right font-mono text-blue-500">—</td>
                      <td className={cn('px-5 py-2 text-right font-mono', totalLate > 0 ? 'text-red-500' : 'text-muted')}>{fmt(totalLate)}</td>
                      <td className="px-5 py-2 text-right">
                        {overallOtd !== null && (
                          <span className={cn(
                            'text-xs font-bold px-2 py-0.5 rounded',
                            overallOtd >= 95 ? 'bg-green-100 text-green-600' :
                            overallOtd >= 85 ? 'bg-orange-100 text-orange-500' :
                            'bg-red-100 text-red-500'
                          )}>{fmtPct(overallOtd)}</span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pending table */}
            <div className="panel p-0 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-bold tracking-widest text-muted uppercase">
                    Εκκρεμείς παραγγελίες ανά Due Date
                  </span>
                </div>
                {totalOverdue > 0 && (
                  <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded">
                    {fmt(totalOverdue)} χρεωστούμενες
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-muted uppercase tracking-wider border-b border-border bg-slate-50/50">
                    <th className="text-left px-5 py-2 font-medium">Due Date</th>
                    <th className="text-right px-5 py-2 font-medium">Σύνολο</th>
                    <th className="text-right px-5 py-2 font-medium">IntraDay</th>
                    <th className="text-right px-5 py-2 font-medium">AutoStore</th>
                    <th className="text-right px-5 py-2 font-medium">Πολυγρ.</th>
                    <th className="text-right px-5 py-2 font-medium">Μονογρ.</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-green-500 text-xs font-semibold">
                      ✓ Δεν υπάρχουν εκκρεμείς παραγγελίες
                    </td></tr>
                  )}
                  {pending.map(row => {
                    const overdue = isOverdue(row.DUEDATE)
                    const today   = isToday(row.DUEDATE)
                    return (
                      <tr key={row.DUEDATE} className={cn(
                        'border-b border-border/50',
                        overdue ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-slate-50'
                      )}>
                        <td className="px-5 py-2.5 font-mono font-medium">
                          <span className={overdue ? 'text-red-500' : 'text-slate-700'}>{row.DUEDATE}</span>
                          {overdue && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-500 rounded font-sans">χρεωστ.</span>}
                          {today  && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-orange-100 text-orange-500 rounded font-sans">σήμερα</span>}
                        </td>
                        <td className={cn('px-5 py-2.5 text-right font-mono font-bold', overdue ? 'text-red-500' : 'text-slate-800')}>
                          {fmt(row.PENDING)}
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-slate-600">{fmt(row.INTRADAY)}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-slate-600">{fmt(row.AUTOSTORE)}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-slate-600">{fmt(row.POLIKES)}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-slate-600">{fmt(row.MONIKES)}</td>
                      </tr>
                    )
                  })}
                  {pending.length > 1 && (
                    <tr className="bg-slate-50 border-t border-border font-semibold">
                      <td className="px-5 py-2 text-slate-700">Σύνολο</td>
                      <td className={cn('px-5 py-2 text-right font-mono', totalOverdue > 0 ? 'text-red-500' : 'text-slate-800')}>
                        {fmt(totalPending)}
                      </td>
                      <td className="px-5 py-2 text-right font-mono text-slate-500">
                        {fmt(pending.reduce((s, r) => s + (r.INTRADAY ?? 0), 0))}
                      </td>
                      <td className="px-5 py-2 text-right font-mono text-slate-500">
                        {fmt(pending.reduce((s, r) => s + (r.AUTOSTORE ?? 0), 0))}
                      </td>
                      <td className="px-5 py-2 text-right font-mono text-slate-500">
                        {fmt(pending.reduce((s, r) => s + (r.POLIKES ?? 0), 0))}
                      </td>
                      <td className="px-5 py-2 text-right font-mono text-slate-500">
                        {fmt(pending.reduce((s, r) => s + (r.MONIKES ?? 0), 0))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {modal === 'ontime' && (
        <OrderModal
          title="Εγκαίρως — Order IDs"
          orders={ontimeOrders}
          onClose={() => setModal(null)}
          accentColor="text-green-600"
        />
      )}
      {modal === 'late' && (
        <OrderModal
          title="Με καθυστέρηση — Order IDs"
          orders={lateOrders}
          onClose={() => setModal(null)}
          accentColor="text-red-500"
        />
      )}
      {modal === 'pending' && (
        <OrderModal
          title="Εκκρεμείς — Order IDs"
          orders={pendingOrders}
          onClose={() => setModal(null)}
          accentColor="text-orange-500"
        />
      )}
    </div>
  )
}
