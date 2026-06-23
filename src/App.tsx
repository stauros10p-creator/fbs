import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DataLoader } from '@/components/layout/DataLoader'
import { DashboardPage } from '@/pages/DashboardPage'
import { TeamPage } from '@/pages/TeamPage'
import { EmployeeListPage } from '@/pages/EmployeeListPage'
import { EmployeeDetailPage } from '@/pages/EmployeeDetailPage'
import { TopPerformersPage } from '@/pages/TopPerformersPage'
import { RoleRankingPage } from '@/pages/RoleRankingPage'
import { ImpactScorePage } from '@/pages/ImpactScorePage'
import { ProductivityHeatmapPage } from '@/pages/ProductivityHeatmapPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { ForecastPage } from '@/pages/ForecastPage'
import { OpsSnapshotPage } from '@/pages/OpsSnapshotPage'
import { OpsLivePage } from '@/pages/OpsLivePage'
import { OpsInboundPage } from '@/pages/OpsInboundPage'
import { CopilotPage } from '@/pages/CopilotPage'
import { StaffPlanPage } from '@/pages/StaffPlanPage'
import { HourlyForecastPage } from '@/pages/HourlyForecastPage'

export default function App() {
  return (
    <BrowserRouter>
      <DataLoader>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"               element={<DashboardPage />} />
            <Route path="/team"                    element={<TeamPage />} />
            <Route path="/team/employees"          element={<EmployeeListPage />} />
            <Route path="/team/employees/:id"      element={<EmployeeDetailPage />} />
            <Route path="/team/top-performers"     element={<TopPerformersPage />} />
            <Route path="/team/ranking"            element={<RoleRankingPage />} />
            <Route path="/team/impact"             element={<ImpactScorePage />} />
            <Route path="/team/heatmap"            element={<ProductivityHeatmapPage />} />
            <Route path="/schedule"                element={<SchedulePage />} />
            <Route path="/forecast"                element={<ForecastPage />} />
            <Route path="/ops"                     element={<OpsSnapshotPage />} />
            <Route path="/ops/live"                element={<OpsLivePage />} />
            <Route path="/ops/inbound"             element={<OpsInboundPage />} />
            <Route path="/copilot"                 element={<CopilotPage />} />
            <Route path="/staff-plan"              element={<StaffPlanPage />} />
            <Route path="/hourly-forecast"         element={<HourlyForecastPage />} />
          </Routes>
        </Layout>
      </DataLoader>
    </BrowserRouter>
  )
}
