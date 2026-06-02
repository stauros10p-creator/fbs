import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store'

const NAV_MAIN = [
  { to: '/dashboard', icon: '⊞', label: 'Dashboard' },
  { to: '/planning',  icon: '📋', label: 'Daily Planning', isNew: true },
  { to: '/ops',       icon: '📸', label: 'Ops Snapshot' },
]
const NAV_TEAM = [
  { to: '/team',      icon: '👥', label: 'Εργαζόμενοι' },
  { to: '/schedule',  icon: '📅', label: 'Schedule' },
  { to: '/breaks',    icon: '☕', label: 'Διαλείμματα', hasBadge: true },
]
const NAV_ANALYTICS = [
  { to: '/productivity', icon: '📈', label: 'Παραγωγικότητα' },
  { to: '/forecast',     icon: '🔮', label: 'Forecast' },
  { to: '/reports',      icon: '📊', label: 'Reports' },
  { to: '/copilot',      icon: '🤖', label: 'AI Copilot' },
]

const S = {
  sidebar: {
    width: 210, flexShrink: 0, background: 'white',
    borderRight: '0.5px solid #e5e5e5',
    display: 'flex', flexDirection: 'column' as const,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,
  logo: {
    padding: '18px 16px 14px',
    borderBottom: '0.5px solid #f0f0f0',
  },
  logoBadge: {
    background: '#f5f5f0', padding: '6px 12px',
    borderRadius: 20, fontSize: 13, fontWeight: 500,
    color: '#1a1a1a', display: 'inline-block',
  },
  nav: { flex: 1, padding: '12px 8px', overflowY: 'auto' as const },
  section: {
    fontSize: 9, color: '#9ca3af', letterSpacing: '0.8px',
    textTransform: 'uppercase' as const, padding: '10px 8px 4px',
    fontWeight: 600,
  },
  foot: {
    padding: '12px 14px',
    borderTop: '0.5px solid #f0f0f0',
    display: 'flex', alignItems: 'center', gap: 10,
  },
  av: {
    width: 30, height: 30, borderRadius: '50%',
    background: '#1a1a1a', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    color: 'white', fontSize: 11, fontWeight: 500, flexShrink: 0,
  },
}

function NavItem({ to, icon, label, isNew, hasBadge }: {
  to: string; icon: string; label: string; isNew?: boolean; hasBadge?: boolean
}) {
  const alerts = useAppStore(s => s.alerts)
  const unacked = alerts.filter(a => !a.acknowledged_at).length
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <NavLink to={to} style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '8px 10px', borderRadius: 8, marginBottom: 1,
      fontSize: 13, fontWeight: isActive ? 500 : 400,
      color: isActive ? 'white' : '#6b7280',
      background: isActive ? '#1a1a1a' : 'transparent',
      textDecoration: 'none', transition: 'all 0.1s',
    }}>
      <span style={{ fontSize: 15, width: 18, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {isNew && <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 10 }}>NEW</span>}
      {hasBadge && unacked > 0 && <span style={{ background: '#ef4444', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 10, minWidth: 18, textAlign: 'center' }}>{unacked}</span>}
    </NavLink>
  )
}

export function Layout({ children }: { children: React.ReactNode }) {
  const engineResult = useAppStore(s => s.engineResult)
  const risk = engineResult?.overall_risk ?? 0
  const riskColor = risk < 0.3 ? '#22c55e' : risk < 0.6 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f5f5f0' }}>
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoBadge}>FBS Warehouse</div>
        </div>

        <nav style={S.nav}>
          <div style={S.section}>Κύριο</div>
          {NAV_MAIN.map(n => <NavItem key={n.to} {...n} />)}
          <div style={S.section}>Ομάδα</div>
          {NAV_TEAM.map(n => <NavItem key={n.to} {...n} />)}
          <div style={S.section}>Ανάλυση</div>
          {NAV_ANALYTICS.map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        {/* SLA Risk */}
        <div style={{ padding: '10px 14px', borderTop: '0.5px solid #f0f0f0', borderBottom: '0.5px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>SLA Risk</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: riskColor }}>{Math.round(risk * 100)}%</span>
          </div>
          <div style={{ height: 3, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round(risk * 100)}%`, background: riskColor, borderRadius: 2, transition: 'width 1s ease' }} />
          </div>
        </div>

        <div style={S.foot}>
          <div style={S.av}>ΣΤ</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>Σταύρος</div>
            <div style={{ fontSize: 10, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} className="pulse" />
              Team Leader
            </div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}

