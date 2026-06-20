import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RefreshCw, ArrowLeft, Package } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface RetRow {
  IMERO: string
  IMERO_SORT: string
  INB_TEMAXIA: number
  INB_EIDI: number
  PUT_TEMAXIA: number
  PUT_EIDI: number
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(n: number) {
  return n.toLocaleString('el-GR')
}

function diffColor(v: number) {
  if (v > 0) return 'text-green-500'
  if (v < 0) return 'text-red-500'
  return 'text-muted'
}

function RetStockWidget() {
  const [live, setLive] = useState<any>(null)

  useEffect(() => {
    supabase.from('live_snapshots').select('*').order('created_at', { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) setLive(data) })
  }, [])

  const inb = live?.data?.inbound
  if (!inb) return null

  const retTem = inb.ret_temaxia ?? 0
  const retEid = inb.ret_eidi ?? 0

  return (
    <div className="panel border border-purple-200 bg-purple-50/40">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
          <Package className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <div className="text-xs text-muted font-mono uppercase tracking-wider">Current RET Stock</div>
          <div className="text-sm font-semibold text-slate-700">Location 24252 - tora</div>
        </div>
        {live && <span className="text-[10px] text-muted font-mono ml-auto">{live.generated_at}</span>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-purple-100 px-5 py-4 text-center">
          <div className="text-2xl font-bold font-mono text-purple-700">{retTem.toLocaleString('el-GR')}</div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wider">Temaxia</div>
        </div>
        <div className="bg-white rounded-lg border border-purple-100 px-5 py-4 text-center">
          <div className="text-2xl font-bold font-mono text-purple-500">{retEid.toLocaleString('el-GR')}</div>
          <div className="text-xs text-muted mt-1 uppercase tracking-wider">Eidi</div>
        </div>
      </div>
    </div>
  )
}

export function OpsEpistrofesPage() {
  const navigate = useNavigate()
  const [allRows, setAllRows] = useState<RetRow[]>([])
  const [genAt, setGenAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 13)
    return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState(today())

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    const { data, error } = await supabase
      .from('inbound_snapshots')
      .select('generated_at, ret_rows')
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
    if (!error && data) {
      setAllRows((data.ret_rows as RetRow[]) ?? [])
      setGenAt(data.generated_at)
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    load()
  }, [])

  const rows = allRows
    .filter((r) => r.IMERO_SORT >= dateFrom && r.IMERO_SORT <= dateTo)
    .sort((a, b) => a.IMERO_SORT.localeCompare(b.IMERO_SORT))

  const totInbTem = rows.reduce((s, r) => s + (r.INB_TEMAXIA ?? 0), 0)
  const totInbEid = rows.reduce((s, r) => s + (r.INB_EIDI ?? 0), 0)
  const totPutTem = rows.reduce((s, r) => s + (r.PUT_TEMAXIA ?? 0), 0)
  const totPutEid = rows.reduce((s, r) => s + (r.PUT_EIDI ?? 0), 0)
  const totDiaTem = totPutTem - totInbTem
  const totDiaEid = totPutEid - totInbEid

  const chartData = rows.map((r) => ({
    name: r.IMERO,
    Inbound: r.INB_TEMAXIA ?? 0,
    Putaway: r.PUT_TEMAXIA ?? 0,
  }))

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="EPISTROFES: Inbound vs Putaway"
        subtitle="Daily inbound kai putaway epistrofon ana imera (location 24252)"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/ops/inbound')}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} /> Refresh
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        <div className="panel flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted font-medium uppercase tracking-wider">Apo:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted font-medium uppercase tracking-wider">Eos:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          {genAt && (
            <span className="text-xs text-muted font-mono ml-auto">{genAt}</span>
          )}
        </div>

        {loading && (
          <div className="text-center py-20 text-muted text-sm">Loading...</div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-center py-20 text-muted text-sm">
            No data for the selected period.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-6">
            <div className="panel">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v: number) => v.toLocaleString('el-GR')}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip formatter={(v: number) => v.toLocaleString('el-GR')} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Inbound" fill="rgba(139,92,246,0.8)" />
                  <Bar dataKey="Putaway" fill="rgba(20,184,166,0.8)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted uppercase tracking-wider border-b border-border bg-slate-50">
                    <th className="text-left px-5 py-3 font-medium">Hmerominia</th>
                    <th className="text-right px-5 py-3 font-medium" style={{ color: '#7c3aed' }}>Inb. tem.</th>
                    <th className="text-right px-5 py-3 font-medium" style={{ color: '#a78bfa' }}>Inb. eidi</th>
                    <th className="text-right px-5 py-3 font-medium" style={{ color: '#0d9488' }}>Put. tem.</th>
                    <th className="text-right px-5 py-3 font-medium" style={{ color: '#5eead4' }}>Put. eidi</th>
                    <th className="text-right px-5 py-3 font-medium">Diafora tem.</th>
                    <th className="text-right px-5 py-3 font-medium">Diafora eidi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const dTem = (r.PUT_TEMAXIA ?? 0) - (r.INB_TEMAXIA ?? 0)
                    const dEid = (r.PUT_EIDI ?? 0) - (r.INB_EIDI ?? 0)
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-slate-700">{r.IMERO}</td>
                        <td className="px-5 py-3 text-right font-mono font-semibold" style={{ color: '#7c3aed' }}>
                          {fmt(r.INB_TEMAXIA ?? 0)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono" style={{ color: '#a78bfa' }}>
                          {fmt(r.INB_EIDI ?? 0)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold" style={{ color: '#0d9488' }}>
                          {fmt(r.PUT_TEMAXIA ?? 0)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono" style={{ color: '#5eead4' }}>
                          {fmt(r.PUT_EIDI ?? 0)}
                        </td>
                        <td className={cn('px-5 py-3 text-right font-mono font-semibold', diffColor(dTem))}>
                          {dTem !== 0 ? (dTem > 0 ? '+' : '') + fmt(dTem) : '-'}
                        </td>
                        <td className={cn('px-5 py-3 text-right font-mono font-semibold', diffColor(dEid))}>
                          {dEid !== 0 ? (dEid > 0 ? '+' : '') + fmt(dEid) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-slate-100 font-bold border-t-2 border-border">
                    <td className="px-5 py-3 text-slate-800 uppercase text-xs tracking-wider">Synolo</td>
                    <td className="px-5 py-3 text-right font-mono" style={{ color: '#7c3aed' }}>{fmt(totInbTem)}</td>
                    <td className="px-5 py-3 text-right font-mono" style={{ color: '#a78bfa' }}>{fmt(totInbEid)}</td>
                    <td className="px-5 py-3 text-right font-mono" style={{ color: '#0d9488' }}>{fmt(totPutTem)}</td>
                    <td className="px-5 py-3 text-right font-mono" style={{ color: '#5eead4' }}>{fmt(totPutEid)}</td>
                    <td className={cn('px-5 py-3 text-right font-mono', diffColor(totDiaTem))}>
                      {totDiaTem !== 0 ? (totDiaTem > 0 ? '+' : '') + fmt(totDiaTem) : '-'}
                    </td>
                    <td className={cn('px-5 py-3 text-right font-mono', diffColor(totDiaEid))}>
                      {totDiaEid !== 0 ? (totDiaEid > 0 ? '+' : '') + fmt(totDiaEid) : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <RetStockWidget />
      </div>
    </div>
  )
}
