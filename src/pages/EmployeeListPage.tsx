// src/pages/EmployeeListPage.tsx — All employees, clickable rows

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { useProductivityData } from '@/lib/useProductivityData'
import { ROLE_CONFIG } from '@/types'
import { cn, initials } from '@/lib/utils'

type SortKey = 'name' | 'orders' | 'uph' | 'trend'

export function EmployeeListPage() {
  const navigate = useNavigate()
  const { allMetrics } = useProductivityData()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('uph')
  const [asc, setAsc] = useState(false)

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(a => !a)
    else { setSort(key); setAsc(false) }
  }

  const filtered = allMetrics
    .filter(m => m.employee.full_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'name') {
        return asc
          ? a.employee.full_name.localeCompare(b.employee.full_name)
          : b.employee.full_name.localeCompare(a.employee.full_name)
      }
      let va: number, vb: number
      if (sort === 'orders') { va = a.ordersToday ?? -1; vb = b.ordersToday ?? -1 }
      else if (sort === 'trend') { va = a.trend ?? -999; vb = b.trend ?? -999 }
      else { va = a.todayUPH ?? -1; vb = b.todayUPH ?? -1 }
      return asc ? va - vb : vb - va
    })

  const withData = allMetrics.filter(m => m.todayUPH != null).length

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort === k
      ? (asc ? <ChevronUp className="w-3 h-3 inline ml-0.5" /> : <ChevronDown className="w-3 h-3 inline ml-0.5" />)
      : null

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/team')} className="p-2 rounded-lg hover:bg-slate-100">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">Εργαζόμενοι</h1>
            <p className="text-xs text-slate-400">
              {withData} ενεργοί σήμερα · {allMetrics.length} σύνολο — κλικ για αναλυτικά ανά ημέρα
            </p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Αναζήτηση..."
              className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 w-48"
            />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                  <button onClick={() => toggleSort('name')} className="hover:text-slate-600">
                    Εργαζόμενος <SortIcon k="name" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">Ρόλος</th>
                <th className="px-5 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                  <button onClick={() => toggleSort('orders')} className="hover:text-slate-600">
                    Παραγγελίες <SortIcon k="orders" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">Τεμάχια</th>
                <th className="px-5 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                  <button onClick={() => toggleSort('uph')} className="hover:text-slate-600">
                    Orders/Hour <SortIcon k="uph" />
                  </button>
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">Ώρες</th>
                <th className="px-5 py-3 text-left text-[10px] font-medium tracking-wider text-slate-400 uppercase">
                  <button onClick={() => toggleSort('trend')} className="hover:text-slate-600">
                    Trend <SortIcon k="trend" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(m => {
                const rc = ROLE_CONFIG[m.employee.primary_role]
                const noData = m.todayUPH == null
                return (
                  <tr
                    key={m.employee.id}
                    onClick={() => navigate(`/team/employees/${m.employee.id}`)}
                    className={cn(
                      'cursor-pointer hover:bg-slate-50 transition-colors group',
                      noData && 'opacity-50'
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: `${rc?.color}18`, color: rc?.color }}
                        >{initials(m.employee.full_name)}</div>
                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                          {m.employee.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: `${rc?.color}18`, color: rc?.color }}>
                        {rc?.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-600">{m.ordersToday ?? '—'}</td>
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-400">—</td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-bold font-mono" style={{ color: noData ? '#cbd5e1' : rc?.color }}>
                        {m.todayUPH?.toFixed(1) ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">
                      {m.hoursToday ? `${m.hoursToday.toFixed(1)}h` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn('text-sm font-semibold',
                        m.trend == null ? 'text-slate-300'
                        : m.trend >= 0 ? 'text-emerald-500' : 'text-red-500'
                      )}>
                        {m.trend != null ? `${m.trend > 0 ? '+' : ''}${m.trend}%` : '—'}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-400">
                    Δεν βρέθηκαν αποτελέσματα
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
