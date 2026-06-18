import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { RefreshCw, ArrowLeft } from 'lucide-react'
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

interface ComparisonRow {
  IMERO: string
  IMERO_SORT: string
  AFX_TEMAXIA: number
  AFX_EIDI: number
  PAR_TEMAXIA: number
  PAR_EIDI: number
  DIAFORA_TEMAXIA: number
  DIAFORA_EIDI: number
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

export function OpsAfixeisPage() {
  const navigate = useNavigate()
  const [allRows, setAllRows] = useState<ComparisonRow[]>([])
  const [genAt, setGenAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dateFrom, setDateFrom] = useState(today())
  const [dateTo, setDateTo] = useState(today())

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    const { data, error } = await supabase
      .from('inbound_snapshots')
      .select('generated_at, comparison_rows')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (!error && data) {
      setAllRows((data.comparison_rows as ComparisonRow[]) ?? [])
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

  const totAfxTem = rows.reduce((s, r) => s + (r.AFX_TEMAXIA ?? 0), 0)
  const totAfxEid = rows.reduce((s, r) => s + (r.AFX_EIDI ?? 0), 0)
  const totParTem = rows.reduce((s, r) => s + (r.PAR_TEMAXIA ?? 0), 0)
  const totParEid = rows.reduce((s, r) => s + (r.PAR_EIDI ?? 0), 0)
  const totDiaTem = totParTem - totAfxTem
  const totDiaEid = totParEid - totAfxEid

  const chartData = rows.map((r) => ({
    name: r.IMERO,
    Afixeis: r.AFX_TEMAXIA ?? 0,
    Paralavies: r.PAR_TEMAXIA ?? 0,
  }))

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Operations Module"
        title="AFIXEIS vs PARALAVIES"
        subtitle="Sygkrisi dilothenton afixeon me pragmatikes paralavies ana imera"
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
              className="text-sm border border-border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted font-medium uppercase tracking-wider">Eos:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm border border-border rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
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
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) =>
                      value === 'Afixeis' ? 'Afixeis tem.' : 'Paralavies tem.'
                    }
                  />
                  <Bar dataKey="Afixeis" fill="rgba(249,115,22,0.8)" />
                  <Bar dataKey="Paralavies" fill="rgba(59,130,246,0.8)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="panel p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted uppercase tracking-wider border-b border-border bg-slate-50">
                    <th className="text-left px-5 py-3 font-medium">Hmerominia</th>
                    <th className="text-right px-5 py-3 font-medium text-orange-600">Afixeis tem.</th>
                    <th className="text-right px-5 py-3 font-medium text-orange-400">Afixeis eidi</th>
                    <th className="text-right px-5 py-3 font-medium text-blue-600">Paralavies tem.</th>
                    <th className="text-right px-5 py-3 font-medium text-blue-400">Paralavies eidi</th>
                    <th className="text-right px-5 py-3 font-medium">Diafora tem.</th>
                    <th className="text-right px-5 py-3 font-medium">Diafora eidi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const dTem = (r.PAR_TEMAXIA ?? 0) - (r.AFX_TEMAXIA ?? 0)
                    const dEid = (r.PAR_EIDI ?? 0) - (r.AFX_EIDI ?? 0)
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono text-slate-700">{r.IMERO}</td>
                        <td className="px-5 py-3 text-right font-mono font-semibold text-orange-500">
                          {fmt(r.AFX_TEMAXIA ?? 0)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-orange-400">
                          {fmt(r.AFX_EIDI ?? 0)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold text-blue-500">
                          {fmt(r.PAR_TEMAXIA ?? 0)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-blue-400">
                          {fmt(r.PAR_EIDI ?? 0)}
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
                    <td className="px-5 py-3 text-right font-mono text-orange-600">{fmt(totAfxTem)}</td>
                    <td className="px-5 py-3 text-right font-mono text-orange-400">{fmt(totAfxEid)}</td>
                    <td className="px-5 py-3 text-right font-mono text-blue-600">{fmt(totParTem)}</td>
                    <td className="px-5 py-3 text-right font-mono text-blue-400">{fmt(totParEid)}</td>
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
      </div>
    </div>
  )
}

