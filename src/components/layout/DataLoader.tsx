import { useEffect } from 'react'
import {
  useWarehouse,
  useEmployees,
  useTodayForecast,
  useLatestOpsSnapshot,
  useAlerts,
} from '@/hooks'

interface DataLoaderProps {
  children: React.ReactNode
}

export function DataLoader({ children }: DataLoaderProps) {
  useWarehouse()
  useEmployees()
  useTodayForecast()
  useLatestOpsSnapshot()
  useAlerts()

  return <>{children}</>
}
