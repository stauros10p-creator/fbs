import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, WAREHOUSE_ID } from '@/lib/supabase'
import { useAppStore } from '@/store'
import type {
  Employee, DailyForecast, OpsSnapshot, Alert,
  BreakRequest, Shift, EmployeeRole, EmployeeStatus,
} from '@/types'

// ---- Warehouse ----
export function useWarehouse() {
  const setWarehouse = useAppStore(s => s.setWarehouse)
  return useQuery({
    queryKey: ['warehouse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', WAREHOUSE_ID)
        .single()
      if (error) throw error
      setWarehouse(data)
      return data
    },
  })
}

// ---- Employees ----
export function useEmployees() {
  const setEmployees = useAppStore(s => s.setEmployees)

  const query = useQuery({
    queryKey: ['employees', WAREHOUSE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('*, productivity:employee_productivity(*)')
        .eq('warehouse_id', WAREHOUSE_ID)
        .order('primary_role')
        .order('full_name')
      if (error) throw error
      const employees = data as Employee[]
      setEmployees(employees)
      return employees
    },
    refetchInterval: 30000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('employees-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'employees',
        filter: `warehouse_id=eq.${WAREHOUSE_ID}`,
      }, () => {
        query.refetch()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [query])

  return query
}

export function useUpdateEmployeeStatus() {
  const queryClient = useQueryClient()
  const updateLocal = useAppStore(s => s.updateEmployeeStatus)

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: EmployeeStatus }) => {
      const { error } = await supabase
        .from('employees')
        .update({ current_status: status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, status }) => {
      updateLocal(id, status)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useUpsertEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (employee: Partial<Employee> & { warehouse_id: string }) => {
      const { data, error } = await supabase
        .from('employees')
        .upsert({ ...employee, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('employees').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}

// ---- Forecast ----
export function useTodayForecast() {
  const setForecast = useAppStore(s => s.setTodayForecast)
  const today = new Date().toISOString().split('T')[0]

  return useQuery({
    queryKey: ['forecast', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_forecasts')
        .select('*')
        .eq('warehouse_id', WAREHOUSE_ID)
        .eq('forecast_date', today)
        .maybeSingle()
      if (error) throw error
      setForecast(data)
      return data as DailyForecast | null
    },
  })
}

export function useUpsertForecast() {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  return useMutation({
    mutationFn: async (values: {
      due_date_orders: number
      same_day_orders: number
      intraday_orders: number
      backlog_orders: number
    }) => {
      const { data, error } = await supabase
        .from('daily_forecasts')
        .upsert({
          warehouse_id: WAREHOUSE_ID,
          forecast_date: today,
          ...values,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'warehouse_id,forecast_date' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast'] })
    },
  })
}

// ---- Ops Snapshots ----
export function useLatestOpsSnapshot() {
  const setSnapshot = useAppStore(s => s.setLatestOpsSnapshot)

  const query = useQuery({
    queryKey: ['ops-snapshot', WAREHOUSE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ops_snapshots')
        .select('*')
        .eq('warehouse_id', WAREHOUSE_ID)
        .eq('is_latest', true)
        .maybeSingle()
      if (error) throw error
      setSnapshot(data)
      return data as OpsSnapshot | null
    },
    refetchInterval: 60000,
  })

  useEffect(() => {
    const channel = supabase
      .channel('ops-snapshot-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ops_snapshots',
        filter: `warehouse_id=eq.${WAREHOUSE_ID}`,
      }, () => {
        query.refetch()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [query])

  return query
}

export function useCreateOpsSnapshot() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: {
      pending_picking: number
      pending_packing: number
      pending_sorting: number
      backlog_orders: number
      remaining_due_date: number
      remaining_same_day: number
      remaining_intraday: number
      notes?: string
    }) => {
      const { data, error } = await supabase
        .from('ops_snapshots')
        .insert({
          warehouse_id: WAREHOUSE_ID,
          ...values,
          is_latest: true,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops-snapshot'] })
    },
  })
}

export function useOpsHistory(limit = 10) {
  return useQuery({
    queryKey: ['ops-history', WAREHOUSE_ID, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ops_snapshots')
        .select('*')
        .eq('warehouse_id', WAREHOUSE_ID)
        .order('recorded_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as OpsSnapshot[]
    },
  })
}

// ---- Break Requests ----
export function useBreakRequests() {
  return useQuery({
    queryKey: ['breaks', WAREHOUSE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('break_requests')
        .select('*, employee:employees(*)')
        .eq('warehouse_id', WAREHOUSE_ID)
        .in('status', ['pending', 'active'])
        .order('requested_at', { ascending: false })
      if (error) throw error
      return data as BreakRequest[]
    },
    refetchInterval: 15000,
  })
}

export function useRequestBreak() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ employee_id, pressure_risk }: { employee_id: string; pressure_risk?: number }) => {
      const { data, error } = await supabase
        .from('break_requests')
        .insert({
          employee_id,
          warehouse_id: WAREHOUSE_ID,
          status: 'pending',
          pressure_risk: pressure_risk ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breaks'] })
    },
  })
}

export function useApproveBreak() {
  const queryClient = useQueryClient()
  const updateStatus = useUpdateEmployeeStatus()

  return useMutation({
    mutationFn: async ({ break_id, employee_id }: { break_id: string; employee_id: string }) => {
      const breakEnd = new Date(Date.now() + 30 * 60000).toISOString()
      const { error } = await supabase
        .from('break_requests')
        .update({
          status: 'active',
          break_start: new Date().toISOString(),
          break_end: breakEnd,
        })
        .eq('id', break_id)
      if (error) throw error
      await updateStatus.mutateAsync({ id: employee_id, status: 'break' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breaks'] })
    },
  })
}

export function useDenyBreak() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (break_id: string) => {
      const { error } = await supabase
        .from('break_requests')
        .update({ status: 'denied' })
        .eq('id', break_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['breaks'] })
    },
  })
}

// ---- Alerts ----
export function useAlerts() {
  const setAlerts = useAppStore(s => s.setAlerts)
  const addAlert = useAppStore(s => s.addAlert)

  const query = useQuery({
    queryKey: ['alerts', WAREHOUSE_ID],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('warehouse_id', WAREHOUSE_ID)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      setAlerts(data as Alert[])
      return data as Alert[]
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('alerts-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'alerts',
        filter: `warehouse_id=eq.${WAREHOUSE_ID}`,
      }, (payload) => {
        addAlert(payload.new as Alert)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [addAlert])

  return query
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()
  const acknowledge = useAppStore(s => s.acknowledgeAlert)

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('alerts')
        .update({ acknowledged_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: (id) => acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
}

// ---- Shifts ----
export function useShifts(date?: string) {
  const targetDate = date ?? new Date().toISOString().split('T')[0]
  return useQuery({
    queryKey: ['shifts', WAREHOUSE_ID, targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*, employee:employees(*)')
        .eq('warehouse_id', WAREHOUSE_ID)
        .eq('shift_date', targetDate)
        .order('start_time')
      if (error) throw error
      return data as Shift[]
    },
  })
}

export function useUpsertShifts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (shifts: Omit<Shift, 'id' | 'created_at' | 'employee'>[]) => {
      const { error } = await supabase
        .from('shifts')
        .upsert(shifts, { onConflict: 'employee_id,shift_date' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] })
    },
  })
}

// ---- AI Copilot ----
export function useSendCopilotMessage() {
  const employees = useAppStore(s => s.employees)
  const engineResult = useAppStore(s => s.engineResult)
  const latestOpsSnapshot = useAppStore(s => s.latestOpsSnapshot)
  const todayForecast = useAppStore(s => s.todayForecast)

  return useMutation({
    mutationFn: async ({
      messages,
      sessionId,
    }: {
      messages: { role: 'user' | 'assistant'; content: string }[]
      sessionId: string
    }) => {
      const context = {
        timestamp: new Date().toISOString(),
        active_employees: employees.filter(e => e.current_status === 'working').length,
        total_employees: employees.length,
        engine: engineResult,
        ops_snapshot: latestOpsSnapshot,
        forecast: todayForecast,
        employees_by_role: Object.fromEntries(
          ['operator', 'picker', 'packer', 'validator', 'sorter', 'transporter'].map(role => [
            role,
            employees.filter(e => e.primary_role === role && e.current_status === 'working').length,
          ])
        ),
      }

      const systemPrompt = `You are the AI Copilot for Warehouse Copilot, a real-time workforce allocation system.

You help warehouse supervisors make fast, smart decisions about:
- Workforce allocation and redeployment
- Break management and timing
- SLA achievement risk
- Bottleneck identification and resolution

Current warehouse state:
${JSON.stringify(context, null, 2)}

Key metrics to reference:
- Pressure Ratio: queue_depth / effective_capacity_per_hour. >1.5x = risk, >2.0x = critical
- TTE (Time-to-Empty): minutes until a queue clears at current staffing
- SLA windows: Same Day cutoff 13:00, Due Date 19:00 (weekdays)

Be concise, direct, and actionable. Use numbers. Give specific recommendations with employee names when possible.
Never be vague. If you suggest a reallocation, name the specific employees and roles.`

      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot`
      const response = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message ?? 'AI request failed')
      }

      const data = await response.json()
      const assistantMessage = data.content?.[0]?.text ?? 'No response'

      await supabase.from('ai_conversations').insert([
        {
          warehouse_id: WAREHOUSE_ID,
          session_id: sessionId,
          role: 'user',
          content: messages[messages.length - 1].content,
          context_snapshot: context,
        },
        {
          warehouse_id: WAREHOUSE_ID,
          session_id: sessionId,
          role: 'assistant',
          content: assistantMessage,
        },
      ])

      return assistantMessage
    },
  })
}

// ---- Employee Shifts (by employee) ----
export function useEmployeeShifts(employeeId: string | undefined, limit = 30) {
  return useQuery({
    queryKey: ['employee-shifts', employeeId, limit],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*')
        .eq('employee_id', employeeId!)
        .order('shift_date', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as Shift[]
    },
  })
}

// ---- Apply Reallocation ----
export function useApplyReallocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      employee_id,
      from_role,
      to_role,
    }: {
      employee_id: string
      from_role: EmployeeRole
      to_role: EmployeeRole
    }) => {
      const { error } = await supabase.from('workforce_allocations').insert({
        employee_id,
        warehouse_id: WAREHOUSE_ID,
        allocated_role: to_role,
        triggered_by: 'algorithm',
        reason: `Redeployed from ${from_role} to ${to_role} by algorithm`,
      })
      if (error) throw error

      await supabase
        .from('employees')
        .update({
          current_status: 'redeployed',
          primary_role: to_role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', employee_id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })
}
