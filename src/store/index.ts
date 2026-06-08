import { create } from 'zustand'
import type {
  Employee, OpsSnapshot, DailyForecast, Alert,
  AllocationEngineResult, Warehouse,
} from '@/types'
import { runAllocationEngine } from '@/lib/engine'

interface AppStore {
  // Data
  warehouse: Warehouse | null
  employees: Employee[]
  todayForecast: DailyForecast | null
  latestOpsSnapshot: OpsSnapshot | null
  alerts: Alert[]

  // Computed
  engineResult: AllocationEngineResult | null

  // Setters
  setWarehouse: (w: Warehouse) => void
  setEmployees: (e: Employee[]) => void
  setTodayForecast: (f: DailyForecast | null) => void
  setLatestOpsSnapshot: (s: OpsSnapshot | null) => void
  setAlerts: (a: Alert[]) => void
  addAlert: (a: Alert) => void
  acknowledgeAlert: (id: string) => void
  updateEmployeeStatus: (id: string, status: Employee['current_status']) => void
  updateEmployee: (id: string, updates: Partial<Employee>) => void

  // Engine
  recomputeEngine: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  warehouse: null,
  employees: [],
  todayForecast: null,
  latestOpsSnapshot: null,
  alerts: [],
  engineResult: null,

  setWarehouse: (warehouse) => set({ warehouse }),

  setEmployees: (employees) => {
    set({ employees })
    get().recomputeEngine()
  },

  setTodayForecast: (todayForecast) => {
    set({ todayForecast })
    get().recomputeEngine()
  },

  setLatestOpsSnapshot: (latestOpsSnapshot) => {
    set({ latestOpsSnapshot })
    get().recomputeEngine()
  },

  setAlerts: (alerts) => set({ alerts }),

  addAlert: (alert) => set(state => ({
    alerts: [alert, ...state.alerts].slice(0, 50),
  })),

  acknowledgeAlert: (id) => set(state => ({
    alerts: state.alerts.map(a =>
      a.id === id ? { ...a, acknowledged_at: new Date().toISOString() } : a
    ),
  })),

  updateEmployeeStatus: (id, status) => {
    set(state => ({
      employees: state.employees.map(e =>
        e.id === id ? { ...e, current_status: status } : e
      ),
    }))
    get().recomputeEngine()
  },

  updateEmployee: (id, updates) => {
    set(state => ({
      employees: state.employees.map(e =>
        e.id === id ? { ...e, ...updates } : e
      ),
    }))
    get().recomputeEngine()
  },

  recomputeEngine: () => {
    const { employees, latestOpsSnapshot, todayForecast } = get()
    if (employees.length === 0) return
    const result = runAllocationEngine(employees, latestOpsSnapshot, todayForecast)
    set({ engineResult: result })
  },
}))
