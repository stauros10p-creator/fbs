import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { DataLoader } from '@/components/layout/DataLoader'
import { DashboardPage } from '@/pages/DashboardPage'
import { TeamPage } from '@/pages/TeamPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { ForecastPage } from '@/pages/ForecastPage'
import { OpsSnapshotPage } from '@/pages/OpsSnapshotPage'
import { CopilotPage } from '@/pages/CopilotPage'
import { PlanningPage } from '@/pages/PlanningPage'

function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 40, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: 24, fontWeight: 500, color: '#1a1a1a', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#9ca3af' }}>Σύντομα διαθέσιμο...</div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <DataLoader>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ops" element={<OpsSnapshotPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/copilot" element={<CopilotPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/breaks" element={<Placeholder title="Διαλείμματα" />} />
            <Route path="/productivity" element={<Placeholder title="Παραγωγικότητα" />} />
            <Route path="/reports" element={<Placeholder title="Reports" />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </DataLoader>
    </BrowserRouter>
  )
}
