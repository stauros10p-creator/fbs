import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { useAppStore } from '@/store'

const NAV = [
  { to: '/dashboard', icon: '⊞', label: 'Dashboard' },
  { to: '/team',      icon: '👥', label: 'Employees' },
  { to: '/ops',       icon: '🎯', label: 'Roles & Skills' },
  { to: '/schedule',  icon: '📅', label: 'Daily Planning' },
  { to: '/forecast',  icon: '⏱',  label: 'Live Allocation' },
  { to: '/breaks',    icon: '☕', label: 'Breaks', badge: true },
  { to: '/workload',  icon: '📦', label: 'Workload' },
  { to: '/reports',   icon: '📊', label: 'Reports' },
  { to: '/copilot',   icon: '🤖', label: 'AI Copilot' },
  { to: '/settings',  icon: '⚙️', label: 'Settings' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const alerts = useAppStore(s => s.alerts)
  const unacked = alerts.filter(a => !a.acknowledged_at).length

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'#f0f2f7' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#1e2433', fontFamily: 'Inter, sans-serif',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: 14, flexShrink: 0,
            }}>FB</div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>Warehouse</div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>Copilot</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto' }}>
          {NAV.map(({ to, icon, label, badge }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 10px', borderRadius: 8, marginBottom: 2,
              fontSize: 13, fontWeight: isActive ? 600 : 500,
              color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
              background: isActive ? '#3b82f6' : 'transparent',
              textDecoration: 'none', transition: 'all 0.15s',
            })}>
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge && unacked > 0 && (
                <span style={{
                  background: '#ef4444', color: 'white', fontSize: 10,
                  fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                }}>{unacked}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0,
            }}>ΣΤ</div>
            <div>
              <div style={{ color: 'white', fontWeight: 600, fontSize: 12 }}>Team Leader</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                Online
              </div>
            </div>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, textAlign: 'center', marginTop: 10, letterSpacing: 0.5 }}>
            FBS Warehouse
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}

