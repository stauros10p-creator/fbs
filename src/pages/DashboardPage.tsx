import { useAppStore } from '@/store'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { AlertList } from '@/components/ui/AlertItem'
import { AllocationTable } from '@/components/dashboard/AllocationTable'
import { OpsSnapshotPanel } from '@/components/dashboard/OpsSnapshotPanel'
import { SuggestionBar } from '@/components/dashboard/SuggestionBar'
import { BreakRequestsPanel } from '@/components/dashboard/BreakRequestsPanel'
import { useBreakRequests } from '@/hooks'
import { formatTTE, riskLabel } from '@/lib/engine'
import { getSnapshotAge } from '@/lib/utils'
import { Link } from 'react-router-dom'

export function DashboardPage() {
  const employees = useAppStore(s => s.employees)
  const alerts = useAppStore(s => s.alerts)
  const engineResult = useAppStore(s => s.engineResult)
  const latestOps = useAppStore(s => s.latestOpsSnapshot)
  const { data: breakRequests = [] } = useBreakRequests()

  const working = employees.filter(e => e.current_status === 'working').length
  const onBreak = employees.filter(e => e.current_status === 'break').length
  const unacked = alerts.filter(a => !a.acknowledged_at)

  const packerRC = engineResult?.role_capacity.find(r => r.role === 'packer')
  const ttePacking = packerRC?.tte_minutes ?? null
  const slaRisk = engineResult?.sla_risk.same_day ?? 0
  const { label: riskLbl, color: riskClr } = riskLabel(slaRisk)

  const snapshotAge = latestOps ? getSnapshotAge(latestOps.recorded_at) : null

  // Time to Same Day cutoff
  const now = new Date()
  const cutoffH = 13, cutoffM = 0
  const cutoffMins = cutoffH * 60 + cutoffM
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const minsToSameDay = Math.max(0, cutoffMins - nowMins)
  const cutoffStr = minsToSameDay > 0
    ? `${Math.floor(minsToSameDay / 60)}h ${minsToSameDay % 60}m left`
    : 'PASSED'

  return (
    <div className="min-h-full">
      <PageHeader
        accent="Live Operations"
        title="DASHBOARD"
        subtitle="Real-time workforce allocation and SLA status"
        actions={
          <Link to="/ops" className="btn-primary flex items-center gap-2">
            <span>⬡</span> Update Ops Snapshot
          </Link>
        }
      />

      <div className="p-8 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-6 gap-4">
          <StatCard
            label="Active Workers"
            value={working}
            sub={`${onBreak} on break`}
            color="text-success"
          />
          <StatCard
            label="Pending Packing"
            value={latestOps?.pending_packing ?? '—'}
            sub={ttePacking !== null ? `TTE: ${formatTTE(ttePacking)}` : 'No snapshot'}
            color={packerRC?.status === 'critical' ? 'text-red' : packerRC?.status === 'risk' ? 'text-orange' : 'text-info'}
            urgent={packerRC?.status === 'critical'}
          />
          <StatCard
            label="Pending Picking"
            value={latestOps?.pending_picking ?? '—'}
            sub={`TTE: ${formatTTE(engineResult?.role_capacity.find(r=>r.role==='picker')?.tte_minutes ?? null)}`}
            color="text-blue"
          />
          <StatCard
            label="Same Day Cutoff"
            value={cutoffStr}
            sub={`${latestOps?.remaining_same_day ?? '—'} remaining`}
            color={minsToSameDay < 60 ? 'text-red' : minsToSameDay < 120 ? 'text-orange' : 'text-yellow'}
            urgent={minsToSameDay < 60}
          />
          <StatCard
            label="SLA Risk"
            value={`${Math.round(slaRisk * 100)}%`}
            sub={`Same Day: ${riskLbl}`}
            color={riskClr}
            urgent={slaRisk > 0.7}
          />
          <StatCard
            label="Alerts"
            value={unacked.length}
            sub={unacked.length > 0 ? 'Unacknowledged' : 'All clear'}
            color={unacked.length > 0 ? 'text-red' : 'text-success'}
          />
        </div>

        {/* Suggestion bar — only shown if suggestions exist */}
        {engineResult && engineResult.suggestions.length > 0 && (
          <SuggestionBar suggestions={engineResult.suggestions} />
        )}

        {/* Ops snapshot staleness warning */}
        {snapshotAge?.isStale && (
          <div className="bg-yellow/5 border border-yellow/25 rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow text-sm">
              <span>⚠</span>
              <span>Ops Snapshot is stale ({snapshotAge.label}). Algorithm is using estimated workload data.</span>
            </div>
            <Link to="/ops" className="text-xs text-yellow font-semibold hover:underline">
              Update Now →
            </Link>
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left: Allocation Table */}
          <div className="col-span-2 space-y-4">
            <AllocationTable roleCapacity={engineResult?.role_capacity ?? []} />

            {/* Break requests */}
            {breakRequests.length > 0 && (
              <BreakRequestsPanel requests={breakRequests} />
            )}
          </div>

          {/* Right: Ops snapshot + Alerts */}
          <div className="space-y-4">
            <OpsSnapshotPanel />
            <div className="panel">
              <div className="text-xs font-bold tracking-widest text-muted uppercase mb-3 pb-2 border-b border-border">
                ⚠ Active Alerts
              </div>
              <AlertList alerts={alerts} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
