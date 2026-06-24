import { useState } from 'react'
import { LoginPage, getAuthUser } from '@/pages/LoginPage'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(() => getAuthUser() !== null)

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />
  }

  return <>{children}</>
}
