import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DataLoader } from '@/components/layout/DataLoader'
import { DashboardPage } from '@/pages/DashboardPage'
import { TeamPage } from '@/pages/TeamPage'
import { EmployeeListPage } from '@/pages/EmployeeListPage'
import { EmployeeDetailPage } from '@/pages/EmployeeDetailPage'
import { TopPerformersPage } from '@/pages/TopPerformersPage'
import { ImpactScorePage } from '@/pages/ImpactScorePage'
import { ProductivityHeatmapPage } from '@/pages/ProductivityHeatmapPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { ForecastPage } from '@/pages/ForecastPage'
import { OpsSnapshotPage } from '@/pages/OpsSnapshotPage'
import { OpsLivePage } from '@/pages/OpsLivePage'
import { OpsInboundPage } from '@/pages/OpsInboundPage'
import { OpsOtdPage } from '@/pages/OpsOtdPage'
import { OpsThroughputPage } from '@/pages/OpsThroughputPage'
import { OpsDueDatePage } from '@/pages/OpsDueDatePage'
import { OpsAfixesPage } from '@/pages/OpsAfixesPage'
import { OpsEpistrofesPage } from '@/pages/OpsEpistrofesPage'
import { CopilotPage } from '@/pages/CopilotPage'
import { StaffPlanPage } from '@/pages/StaffPlanPage'
import { HourlyForecastPage } from '@/pages/HourlyForecastPage'
import { LoginPage, getAuthUser } from '@/pages/LoginPage'
// FBS Outbound pages
import { FbsOutboundOverviewPage } from '@/pages/FbsOutboundOverviewPage'
import { FbsDownloadThroughputPage } from '@/pages/FbsDownloadThroughputPage'
import { FbsLivePortMonitoringPage } from '@/pages/FbsLivePortMonitoringPage'
import { FbsMonoMultiPage } from '@/pages/FbsMonoMultiPage'
import { FbsPickingPerPortPage } from '@/pages/FbsPickingPerPortPage'

export default function App() {
  const [authed, setAuthed] = useState(() => getAuthUser() !== null)

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />
  }

  return (
    <BrowserRouter>
      <DataLoader>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"               element={<DashboardPage />} />

            {/* FBS Outbound */}
            <Route path="/outbound/overview"             element={<FbsOutboundOverviewPage />} />
            <Route path="/outbound/download-throughput"  element={<FbsDownloadThroughputPage />} />
            <Route path="/outbound/live-port-monitoring" element={<FbsLivePortMonitoringPage />} />
            <Route path="/outbound/mono-multi"           element={<FbsMonoMultiPage />} />
            <Route path="/outbound/picking-per-port"     element={<FbsPickingPerPortPage />} />

            {/* Team / Employees */}
            <Route path="/team"                    element={<TeamPage />} />
            <Route path="/team/employees"          element={<EmployeeListPage />} />
            <Route path="/team/employees/:id"      element={<EmployeeDetailPage />} />
            <Route path="/team/top-performers"     element={<TopPerformersPage />} />
            <Route path="/team/impact"             element={<ImpactScorePage />} />
            <Route path="/team/heatmap"            element={<ProductivityHeatmapPage />} />

            {/* Other */}
            <Route path="/schedule"                element={<SchedulePage />} />
            <Route path="/forecast"                element={<ForecastPage />} />
            <Route path="/ops"                     element={<OpsSnapshotPage />} />
            <Route path="/ops/live"                element={<OpsLivePage />} />
            <Route path="/ops/inbound"             element={<OpsInboundPage />} />
            <Route path="/ops/otd"                 element={<OpsOtdPage />} />
            <Route path="/ops/throughput"          element={<OpsThroughputPage />} />
            <Route path="/ops/duedate"             element={<OpsDueDatePage />} />
            <Route path="/ops/afixeis"             element={<OpsAfixesPage />} />
            <Route path="/ops/epistrofes"          element={<OpsEpistrofesPage />} />
            <Route path="/copilot"                 element={<CopilotPage />} />
            <Route path="/staff-plan"              element={<StaffPlanPage />} />
            <Route path="/hourly-forecast"         element={<HourlyForecastPage />} />
          </Routes>
        </Layout>
      </DataLoader>
    </BrowserRouter>
  )
}
