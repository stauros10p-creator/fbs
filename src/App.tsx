import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DataLoader } from '@/components/layout/DataLoader'
import { DashboardPage } from '@/pages/DashboardPage'
import { TeamPage } from '@/pages/TeamPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { ForecastPage } from '@/pages/ForecastPage'
import { OpsSnapshotPage } from '@/pages/OpsSnapshotPage'
import { CopilotPage } from '@/pages/CopilotPage'
import { StaffPlanPage } from '@/pages/StaffPlanPage'

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
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/ops" element={<OpsSnapshotPage />} />
            <Route path="/copilot" element={<CopilotPage />} />
            <Route path="/staff-plan" element={<StaffPlanPage />} />
          </Routes>
        </Layout>
      </DataLoader>
    </BrowserRouter>
  )
}
