import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DataLoader } from '@/components/layout/DataLoader'
import { DashboardPage } from '@/pages/DashboardPage'
import { TeamPage } from '@/pages/TeamPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { ForecastPage } from '@/pages/ForecastPage'
import { ForecastHubPage } from '@/pages/ForecastHubPage'
import { OpsSnapshotPage } from '@/pages/OpsSnapshotPage'
import { OpsOtdPage } from '@/pages/OpsOtdPage'
import { OpsThroughputPage } from '@/pages/OpsThroughputPage'
import { OpsDueDatePage } from '@/pages/OpsDueDatePage'
import { OpsInboundPage } from '@/pages/OpsInboundPage'
import { OpsAfixeisPage } from '@/pages/OpsAfixeisPage'
import { OpsEpistrofesPage } from '@/pages/OpsEpistrofesPage'
import { OpsLivePage } from '@/pages/OpsLivePage'
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
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/forecast" element={<ForecastHubPage />} />
            <Route path="/forecast/staff" element={<ForecastPage />} />
            <Route path="/ops" element={<OpsSnapshotPage />} />
            <Route path="/ops/otd" element={<OpsOtdPage />} />
            <Route path="/ops/throughput" element={<OpsThroughputPage />} />
            <Route path="/ops/duedate" element={<OpsDueDatePage />} />
            <Route path="/ops/inbound" element={<OpsInboundPage />} />
            <Route path="/ops/afixeis" element={<OpsAfixeisPage />} />
            <Route path="/ops/epistrofes" element={<OpsEpistrofesPage />} />
            <Route path="/ops/live" element={<OpsLivePage />} />
            <Route path="/copilot" element={<CopilotPage />} />
            <Route path="/staff-plan" element={<StaffPlanPage />} />
            <Route path="/forecast/hourly" element={<HourlyForecastPage />} />
            <Route path="/hourly-forecast" element={<HourlyForecastPage />} />
          </Routes>
        </Layout>
      </DataLoader>
    </BrowserRouter>
  )
}
