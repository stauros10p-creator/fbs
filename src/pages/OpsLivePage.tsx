import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RefreshCw, ArrowLeft, Package, Truck } from 'lucide-react'

interface InboundData {
  afixeis_temaxia: number
  afixeis_eidi: number
  afixeis_ogkos: number
  in_temaxia: number
  in_eidi: number
  ret_temaxia: number
  ret_eidi: number
  inb_temaxia: number
  inb_eidi: number
  put_temaxia: number
  put_eidi: number
}

interface OutboundData {
  packed_rafi: number
  packed_autostore: number
  packed_total: number
  pending_rafi: number
  pending_autostore: number
  pending_total: number
  picking_rafi: number
  picking_autostore: number
}

interface LiveSnapshot {
  id: number
  generated_at: string
  data: {
    inbound: InboundData
    outbound: OutboundData
  }
}

function KpiCard({
  label, value, sub, color = 'text-slate-800', accent,
}: {
  label: string
  value: number | string
  sub?: string
  color?: string
  accent?: string
}) {
  return (
    <div className={cn('panel flex-1', accent && `border-l-2 ${accent}`)}>
      <div className="text-xs text-muted uppercase tracking-widest mb-1">{label}</div>
      <div className={cn('text-2xl font-bold font-mono', color)}>
        {typeof value === 'number' ? value.toLocaleString('el-GR') : value}
      </div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

function SectionHeader({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-sm font-bold uppercase tracking-widest', color)}>
      <Icon className="w-4 h-4" />
      {label}
    </div>
  )
}

export function OpsLivePage() {
  const navigate = useNavigate()
  const [snapshot, setSnapshot]   = useState<LiveSnapshot | null>(null)
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    const { data, error } = await supabase
      .from('live_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (!error && data) setSnapshot(data as LiveSnapshot)
    else setSnapshot(null)
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  const inb = snapshot?.data?.inbound
  const out = snapshot?.data?.outbound

  const pickingTotal    = (out?.picking_rafi ?? 0) + (out?.picking_autostore ?? 0)
  const packedTotal     = out?.packed_total ?? 0
  const cmpRafi         = out?.picking_rafi ? Math.round((out.packed_rafi / out.picking_rafi) * 100) : null
  const cmpAutostore    = out?.picking_autostore ? Math.round((out.packed_autostore / out.picking_autostore) * 100) : null
  const cmpTotal        = pickingTotal ? Math.round((packedTotal / pickingTotal) * 100) : null

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="LIVE OPERATIONS"
        subtitle="Ζωντανά δεδομένα παραλαβών και αποστολών"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/ops')} className="btn-secondary text-xs flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Πίσω
            </button>
            <button onClick={() => load(true)} disabled={refreshing} className="btn-secondary text-xs flex items-center gap-1.5">
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} /> Refresh
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-8">
        {loading && <div className="text-center py-20 text-muted text-sm">Loading...</div>}

        {!loading && !snapshot && (
          <div className="text-center py-20 text-muted text-sm">No data. Run the script first.</div>
        )}

        {!loading && snapshot && (
          <>
            {/* Meta */}
            <div className="text-xs text-muted font-mono">⏱ {snapshot.generated_at}</div>

            {/* ── INBOUND ─────────────────────────────────────────────── */}
            <div className="space-y-4">
              <SectionHeader icon={Truck} label="Inbound" color="text-orange-600" />

              {/* Row 1: Αφίξεις */}
              <div className="panel border-l-2 border-orange-400">
                <div className="text-xs text-muted uppercase tracking-widest mb-2">Αφίξεις ράμπα σήμερα</div>
                <div className="flex gap-8">
                  <div>
                    <div className="text-2xl font-bold font-mono text-orange-500">{(inb?.afixeis_temaxia ?? 0).toLocaleString('el-GR')}</div>
                    <div className="text-xs text-muted">τεμάχια</div>
                  </div>
                  <div className="w-px bg-border" />
                  <div>
                    <div className="text-2xl font-bold font-mono text-orange-400">{(inb?.afixeis_eidi ?? 0).toLocaleString('el-GR')}</div>
                    <div className="text-xs text-muted">είδη</div>
                  </div>
                  <div className="w-px bg-border" />
                  <div>
                    <div className="text-2xl font-bold font-mono text-orange-300">{(inb?.afixeis_ogkos ?? 0).toLocaleString('el-GR')}</div>
                    <div className="text-xs text-muted">λίτρα</div>
                  </div>
                </div>
              </div>

              {/* Row 2: Θέση IN + Ret */}
              <div className="flex gap-4">
                <div className="panel flex-1 border-l-2 border-blue-400">
                  <div className="text-xs text-muted uppercase tracking-widest mb-2">Θέση IN — τώρα</div>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-2xl font-bold font-mono text-blue-600">{(inb?.in_temaxia ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">τεμάχια</div>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                      <div className="text-2xl font-bold font-mono text-blue-400">{(inb?.in_eidi ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">είδη</div>
                    </div>
                  </div>
                </div>
                <div className="panel flex-1 border-l-2 border-amber-400">
                  <div className="text-xs text-muted uppercase tracking-widest mb-2">Θέση Ret — τώρα</div>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-2xl font-bold font-mono text-amber-600">{(inb?.ret_temaxia ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">τεμάχια</div>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                      <div className="text-2xl font-bold font-mono text-amber-400">{(inb?.ret_eidi ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">είδη</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Παραλαβές + Putaway */}
              <div className="flex gap-4">
                <div className="panel flex-1 border-l-2 border-orange-400">
                  <div className="text-xs text-muted uppercase tracking-widest mb-2">Παραλαβές (Inbound) σήμερα</div>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-2xl font-bold font-mono text-orange-500">{(inb?.inb_temaxia ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">τεμάχια</div>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                      <div className="text-2xl font-bold font-mono text-orange-400">{(inb?.inb_eidi ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">είδη</div>
                    </div>
                  </div>
                </div>
                <div className="panel flex-1 border-l-2 border-purple-400">
                  <div className="text-xs text-muted uppercase tracking-widest mb-2">Putaway σήμερα</div>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-2xl font-bold font-mono text-purple-500">{(inb?.put_temaxia ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">τεμάχια</div>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                      <div className="text-2xl font-bold font-mono text-purple-400">{(inb?.put_eidi ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">είδη</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── OUTBOUND ────────────────────────────────────────────── */}
            <div className="space-y-4">
              <SectionHeader icon={Package} label="Outbound" color="text-blue-600" />

              {/* Row 1: Packed + Pending */}
              <div className="flex gap-4">
                <div className="panel flex-1 border-l-2 border-green-400">
                  <div className="text-xs text-muted uppercase tracking-widest mb-2">Packed σήμερα</div>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-2xl font-bold font-mono text-green-600">{(out?.packed_total ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">σύνολο</div>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                      <div className="text-lg font-bold font-mono text-green-500">{(out?.packed_rafi ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">ράφι</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono text-teal-500">{(out?.packed_autostore ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">autostore</div>
                    </div>
                  </div>
                </div>
                <div className="panel flex-1 border-l-2 border-red-400">
                  <div className="text-xs text-muted uppercase tracking-widest mb-2">Pending τώρα</div>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-2xl font-bold font-mono text-red-500">{(out?.pending_total ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">σύνολο</div>
                    </div>
                    <div className="w-px bg-border" />
                    <div>
                      <div className="text-lg font-bold font-mono text-red-400">{(out?.pending_rafi ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">ράφι</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold font-mono text-rose-400">{(out?.pending_autostore ?? 0).toLocaleString('el-GR')}</div>
                      <div className="text-xs text-muted">autostore</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Comparison table Packed vs Picking */}
              <div className="panel p-0 overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-border">
                  <span className="font-bold text-slate-800 text-sm">Packed vs Picking</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted uppercase tracking-wider border-b border-border bg-slate-50/50">
                      <th className="text-left px-5 py-2.5 font-medium"></th>
                      <th className="text-right px-5 py-2.5 font-medium text-green-600">Packed</th>
                      <th className="text-right px-5 py-2.5 font-medium text-blue-600">Picking</th>
                      <th className="text-right px-5 py-2.5 font-medium text-slate-500">Packed / Picking</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50 hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-slate-700">Ράφι</td>
                      <td className="px-5 py-3 text-right font-mono text-green-600 font-bold text-base">
                        {(out?.packed_rafi ?? 0).toLocaleString('el-GR')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-blue-600 font-bold text-base">
                        {(out?.picking_rafi ?? 0).toLocaleString('el-GR')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold">
                        {cmpRafi !== null ? (
                          <span className={cn(cmpRafi >= 90 ? 'text-green-500' : cmpRafi >= 70 ? 'text-amber-500' : 'text-red-500')}>
                            {cmpRafi}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                    <tr className="border-b border-border/50 hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-slate-700">AutoStore</td>
                      <td className="px-5 py-3 text-right font-mono text-teal-600 font-bold text-base">
                        {(out?.packed_autostore ?? 0).toLocaleString('el-GR')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-blue-500 font-bold text-base">
                        {(out?.picking_autostore ?? 0).toLocaleString('el-GR')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold">
                        {cmpAutostore !== null ? (
                          <span className={cn(cmpAutostore >= 90 ? 'text-green-500' : cmpAutostore >= 70 ? 'text-amber-500' : 'text-red-500')}>
                            {cmpAutostore}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                    <tr className="bg-slate-50 font-bold">
                      <td className="px-5 py-3 text-slate-800">Σύνολο</td>
                      <td className="px-5 py-3 text-right font-mono text-green-700 text-base">
                        {packedTotal.toLocaleString('el-GR')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-blue-700 text-base">
                        {pickingTotal.toLocaleString('el-GR')}
                      </td>
                      <td className="px-5 py-3 text-right font-mono">
                        {cmpTotal !== null ? (
                          <span className={cn(cmpTotal >= 90 ? 'text-green-600' : cmpTotal >= 70 ? 'text-amber-600' : 'text-red-600')}>
                            {cmpTotal}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
