import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LoginPage } from '@/pages/LoginPage'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false)
  const [session, setSession] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecked(true)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!checked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white/40 text-sm">Loading...</div>
      </div>
    )
  }

  if (!session) return <LoginPage />

  return <>{children}</>
}
