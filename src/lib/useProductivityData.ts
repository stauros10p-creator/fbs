// src/lib/useProductivityData.ts
// Shared hook & utilities for the employee analytics pages

import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { useAppStore } from '@/store'
import type { Employee } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface ProdRow      { ONOMA: string; ORDERS: number; ITEMS?: number; ORES: number; UPH: number | null }
export interface ProdMonthRow { ONOMA: string; UPH_AVG: number; ORDERS_AVG: number; ITEMS_AVG?: number }
export interface DayRow       { ONOMA: string; DAY: string; ORDERS: number; ITEMS: number; ORES: number; UPH: number | null }

export interface ProdSnapshot {
  pickers_today:            ProdRow[]
  pickers_month:            ProdMonthRow[]
  packers_today:            ProdRow[]
  packers_month:            ProdMonthRow[]
  operators_today?:         ProdRow[]
  operators_month?:         ProdMonthRow[]
  pickers_days?:            DayRow[]
  packers_days?:            DayRow[]
  operators_days?:          DayRow[]
  team_avg_pickers_today:   number | null
  team_avg_pickers_month:   number | null
  team_avg_packers_today:   number | null
  team_avg_packers_month:   number | null
  team_avg_operators_today?: number | null
  team_avg_operators_month?: number | null
}

export interface EmployeeMetrics {
  employee:          Employee
  todayUPH:         number | null
  monthUPH:         number | null
  hoursToday:       number | null
  ordersToday:      number | null
  ordersMonth:      number | null
  trend:            number | null   // % change today vs month avg
  consistencyScore: number          // 0-100
  impactScore:      number          // 0-100
  impactLabel:      string
  flexibilityRoles: number          // 1-3 roles active
  flexibilityScore: number          // 0-100
  rating:           string
  ratingStars:      number
  ratingColor:      string
  teamAvgToday:     number | null
  vsTeamToday:      number | null   // % vs team avg today
  vsTeamMonth:      number | null
  hasData:          boolean
}

// ── Operator code → oracle name mapping ───────────────────────────────────────
// Team-sheet entries use FULL oracle names (enables exact disambiguation).
// Non-team-sheet entries keep surname fragments (unique, no collision risk).
export const OPERATOR_CODES: Record<string, string> = {
  // AutoStore leaders/operators (non-team-sheet → surname fragments)
  pkan: 'Κανελλοπουλος', vtri: 'Τριανταφυλλοπουλος', kkou: 'Κουκας',
  gpav: 'Παυλιδης',      mkar: 'Καρυπιδης',           akar: 'Καρυπιδης',
  spap: 'Παππας',        mabi: 'Μπιζας',               span: 'Πανοπουλος',
  fpap: 'Παπανικολαου',  xkon: 'Κωνσταντινιδης',      nkou: 'Κουσουρης',
  gkav: 'Καββαδας',      epso: 'Ψωμαδελη',             kman: 'Μανουσακιδης',
  skar: 'Καρρας',        alem: 'Λεμοντζογλου',
  // Team-sheet entries → full oracle names (exact match, eliminates surname collisions)
  erhy: 'ΕΡΙΚΑ ΧΥΣΟΛΛΙ',
  fsal: 'ΦΟΙΒΟΣ - ΓΕΩΡΓΙΟΣ ΣΑΛΑΧΑΣ',
  gkok: 'ΓΑΡΥΦΑΛΛΙΑ ΚΟΚΟΛΑΚΗ',
  ioak: 'ΗΛΙΑΣ ΙΩΑΚΕΙΜΙΔΗΣ',
  msia: 'ΜΙΧΡΑΝ ΣΙΑΜΕΖ',
  mthe: 'ΜΕΛΕΤΙΑ ΘΕΟΔΩΡΑΚΟΠΟΥΛΟΥ',
  ppet: 'ΠΑΝΑΓΙΩΤΗΣ ΠΕΤΡΟΠΟΥΛΟΣ',
  azou: 'ΑΛΕΞΑΝΔΡΑ ΖΟΥΡΝΑΤΣΙΔΟΥ',
  anan: 'ΑΝΝΑ ΑΝΑΓΝΩΣΤΟΠΟΥΛΟΥ',
  gsta: 'ΙΩΑΝΝΑ ΣΤΑΜΑΤΟΠΟΥΛΟΥ',
  dali: 'ΔΕΣΠΟΙΝΑ ΑΛΗΓΙΑΝΝΗ',
  digi: 'ΔΗΜΗΤΡΑ ΓΙΑΝΝΙΤΣΟΥ',
  emou: 'ΕΙΡΗΝΗ ΜΟΥΡΑΤΙΔΟΥ',
  eklo: 'ΕΛΕΝΗ ΚΛΟΥΔΑ',
  kdim: 'ΑΙΚΑΤΕΡΙΝΗ ΔΗΜΗΤΡΟΠΟΥΛΟΥ',
  lkaz: 'ΛΥΔΙΑ ΚΑΖΑΚΟΥ',
  mkou: 'ΜΑΡΙΑ ΚΟΥΛΛΑ',
  mmix: 'ΜΑΡΙΑ ΜΙΧΑΗΛΙΔΟΥ',
  nkos: 'ΝΙΝΑ ΚΩΣΤΙΔΗ',
  chio: 'ΧΑΡΙΚΛΕΙΑ ΙΩΣΗΦΟΓΛΟΥ',
  luna: 'KEVIN LUNA CUNANAN',
  mark: 'MARK CARLO SIBLAG',
  mois: 'MOISES JR SILAWAN',
  edes: 'CHARL EDSEL SIBLAG',
  feli: 'FELIX JR SIBLAG',
  ntso: 'ΝΙΚΟΛΑΟΣ ΤΣΟΥΤΟΥΡΙΔΗΣ',
  mago: 'MINA AGO',
  kodo: 'ΚΩΝΣΤΑΝΤΙΝΑ ΔΟΣΧΟΡΗ',
  pefe: 'ΦΩΤΕΙΝΗ ΠΕΤΡΑΚΟΥ',
  mpal: 'ΑΛΕΞΙΟΣ ΜΠΑΙΡΑΚΤΑΡΟΒ',
  igri: 'ΕΙΡΗΝΗ ΓΡΙΒΑ',
  tiak: 'ΘΕΟΔΩΡΟΣ ΙΑΚΩΒΙΔΗΣ',
  tmav: 'ΤΑΤΙΑΝΑ ΜΑΒΙΔΗ',
  pgog: 'ΠΗΝΕΛΟΠΗ ΓΚΟΓΚΑΚΗ',
  mome: 'MARIJE OMERI',
  ekot: 'ΕΥΑΓΓΕΛΙΑ ΚΟΤΡΩΝΗ',
  mfit: 'ΜΑΡΙΑ - ΔΗΜΗΤΡΑ ΦΙΤΣΑΛΟΥ',
  itso: 'ΙΩΑΝΝΑ ΤΣΟΛΑΡΙΔΟΥ',
  savr: 'Αβραμιδου',     // non-team-sheet, keep surname
}

// ── Name Matching ─────────────────────────────────────────────────────────────
export function normGreek(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// nameMatch: three-tier lookup for Oracle ONOMA → Supabase employee
//   oracleName: emp.oracle_name (set in Supabase) — when present, disables fuzzy fallback.
//   OPERATOR_CODES with full oracle names ensures exact disambiguation for team-sheet employees.
export function nameMatch(empName: string, oracleNoma: string, oracleName?: string | null): boolean {
  // 1. Exact match via stored oracle_name field
  if (oracleName && normGreek(oracleNoma) === normGreek(oracleName)) return true

  // 2. AutoStore operator code lookup (e.g. "gkok", "chio")
  const code = oracleNoma.trim().toLowerCase()
  if (OPERATOR_CODES[code]) {
    const codeTarget = OPERATOR_CODES[code]
    if (oracleName) {
      // oracle_name is set: verify this code truly maps to THIS employee.
      // For full-name targets (team-sheet): exact substring match against oracle_name.
      // For surname targets (non-team-sheet): oracle_name must contain the surname.
      return normGreek(oracleName).includes(normGreek(codeTarget))
    }
    return normGreek(empName).includes(normGreek(codeTarget))
  }

  // 3. Fuzzy surname fallback — only when no oracle_name (prevents false positives)
  if (oracleName) return false
  const parts = oracleNoma.trim().split(/\s+/)
  const surname = parts[parts.length - 1]
  return surname.length > 3 && normGreek(empName).includes(normGreek(surname))
}

// ── Rating ────────────────────────────────────────────────────────────────────
export function getRating(score: number): { label: string; stars: number; color: string } {
  if (score >= 80) return { label: 'Elite',       stars: 5, color: '#f59e0b' }
  if (score >= 65) return { label: 'Advanced',    stars: 4, color: '#3b82f6' }
  if (score >= 50) return { label: 'Independent', stars: 3, color: '#22c55e' }
  if (score >= 35) return { label: 'Developing',  stars: 2, color: '#94a3b8' }
  return                   { label: 'Training',   stars: 1, color: '#ef4444' }
}

export function getImpactLabel(score: number): string {
  if (score >= 95) return 'Critical Asset'
  if (score >= 85) return 'High Impact'
  if (score >= 70) return 'Strong Contributor'
  if (score >= 55) return 'Contributor'
  return 'Developing'
}

export function impactColor(score: number): string {
  if (score >= 85) return '#22c55e'
  if (score >= 70) return '#f59e0b'
  if (score >= 55) return '#f97316'
  return '#ef4444'
}

// ── Compute Per-Employee Metrics ──────────────────────────────────────────────
// maxUPH: pass the team's max UPH for normalization (two-pass from hook)
export function computeMetrics(emp: Employee, snap: ProdSnapshot | null, maxUPH = 200): EmployeeMetrics {
  // Search ALL role arrays for today — role-agnostic
  // Primary role first → find() stops at first match, so primary role always wins
  const isOp  = emp.primary_role === 'operator'
  const isPkr = emp.primary_role === 'packer'
  const allTodayRows = isOp ? [
    ...(snap?.operators_today ?? []), ...(snap?.packers_today  ?? []), ...(snap?.pickers_today ?? []),
  ] : isPkr ? [
    ...(snap?.packers_today   ?? []), ...(snap?.pickers_today  ?? []), ...(snap?.operators_today ?? []),
  ] : [
    ...(snap?.pickers_today   ?? []), ...(snap?.packers_today  ?? []), ...(snap?.operators_today ?? []),
  ]
  const allMonthRows = isOp ? [
    ...(snap?.operators_month ?? []), ...(snap?.packers_month  ?? []), ...(snap?.pickers_month ?? []),
  ] : isPkr ? [
    ...(snap?.packers_month   ?? []), ...(snap?.pickers_month  ?? []), ...(snap?.operators_month ?? []),
  ] : [
    ...(snap?.pickers_month   ?? []), ...(snap?.packers_month  ?? []), ...(snap?.operators_month ?? []),
  ]

  const empOracleName = (emp as any).oracle_name as string | null | undefined
  const todayRow = allTodayRows.find(r => nameMatch(emp.full_name, r.ONOMA, empOracleName)) ?? null
  const monthRow = allMonthRows.find(r => nameMatch(emp.full_name, r.ONOMA, empOracleName)) ?? null

  // For team avg, still use primary role
  const isPicker   = emp.primary_role === 'picker'
  const isPacker   = emp.primary_role === 'packer'
  const isOperator = emp.primary_role === 'operator'
  const teamAvgToday = isPicker ? (snap?.team_avg_pickers_today ?? null)
    : isPacker   ? (snap?.team_avg_packers_today  ?? null)
    : isOperator ? (snap?.team_avg_operators_today ?? null)
    : null
  const teamAvgMonth = isPicker ? (snap?.team_avg_pickers_month ?? null)
    : isPacker   ? (snap?.team_avg_packers_month  ?? null)
    : isOperator ? (snap?.team_avg_operators_month ?? null)
    : null

  const hoursToday  = todayRow?.ORES   ?? null
  const ordersToday = (todayRow?.ORDERS != null && todayRow.ORDERS > 0) ? todayRow.ORDERS : null
  // Valid session: 1.5h–11.99h (filters noise + Oracle 24h artifacts)
  const validSession = hoursToday != null && hoursToday >= 1.5 && hoursToday <= 11.99
  const todayUPH    = (todayRow?.UPH != null && todayRow.UPH > 0 && validSession) ? todayRow.UPH : null
  const monthUPH    = (monthRow as any)?.UPH_AVG > 0 ? (monthRow as any).UPH_AVG : null
  const ordersMonth = (monthRow as any)?.ORDERS_AVG ?? null
  const hasData     = todayUPH !== null || monthUPH !== null

  const trend = (todayUPH && monthUPH && monthUPH > 0)
    ? Math.round(((todayUPH - monthUPH) / monthUPH) * 100) : null

  const consistencyScore = (todayUPH && monthUPH)
    ? Math.max(0, Math.min(100, Math.round(100 - Math.abs((todayUPH - monthUPH) / monthUPH) * 100)))
    : Math.round((parseInt(emp.skill_level) / 5) * 55 + 25)

  // ── Flexibility: count roles this employee has been active in ──────────────
  const inPickers   = [...(snap?.pickers_today   ?? []), ...(snap?.pickers_month   ?? [])].some(r => nameMatch(emp.full_name, r.ONOMA, empOracleName))
  const inPackers   = [...(snap?.packers_today   ?? []), ...(snap?.packers_month   ?? [])].some(r => nameMatch(emp.full_name, r.ONOMA, empOracleName))
  const inOperators = [...(snap?.operators_today ?? []), ...(snap?.operators_month ?? [])].some(r => nameMatch(emp.full_name, r.ONOMA, empOracleName))
  const flexibilityRoles = [inPickers, inPackers, inOperators].filter(Boolean).length
  const flexibilityScore = Math.round((Math.max(1, flexibilityRoles) / 3) * 100)

  // ── Impact Score: Productivity 50% + Flexibility 30% + Trend 20% ──────────
  // Productivity: monthUPH (or todayUPH) relative to team max
  const uphForCalc = monthUPH ?? todayUPH
  const uphPct     = uphForCalc != null ? Math.min(100, (uphForCalc / maxUPH) * 100) : 0
  // Trend: 0% trend → 50 score, ±50% → 0/100
  const trendPct   = trend != null ? Math.min(100, Math.max(0, 50 + trend * 0.5)) : 50
  const impactScore = hasData
    ? Math.min(100, Math.round(uphPct * 0.5 + flexibilityScore * 0.3 + trendPct * 0.2))
    : 0

  const { label: rating, stars: ratingStars, color: ratingColor } = getRating(impactScore)
  const impactLabel = getImpactLabel(impactScore)

  const vsTeamToday = (todayUPH && teamAvgToday && teamAvgToday > 0)
    ? Math.round(((todayUPH - teamAvgToday) / teamAvgToday) * 100) : null
  const vsTeamMonth = (monthUPH && teamAvgMonth && teamAvgMonth > 0)
    ? Math.round(((monthUPH - teamAvgMonth) / teamAvgMonth) * 100) : null

  return {
    employee: emp, todayUPH, monthUPH, hoursToday, ordersToday, ordersMonth,
    trend, consistencyScore, impactScore, impactLabel,
    flexibilityRoles, flexibilityScore,
    rating, ratingStars, ratingColor,
    teamAvgToday, vsTeamToday, vsTeamMonth, hasData,
  }
}

// ── Main Hook ─────────────────────────────────────────────────────────────────
export function useProductivityData() {
  const [prodSnap, setProdSnap] = useState<ProdSnapshot | null>(null)
  const [loading, setLoading]   = useState(true)
  const employees                = useAppStore(s => s.employees)

  useEffect(() => {
    supabase.from('productivity_snapshots')
      .select('*').order('generated_at', { ascending: false }).limit(1).single()
      .then(({ data }) => {
        if (data?.payload) setProdSnap(data.payload as ProdSnapshot)
        setLoading(false)
      })
  }, [])

  const allMetrics = useMemo(() => {
    // Pass 1: compute raw metrics to find team's max UPH
    const raw    = employees.map(e => computeMetrics(e, prodSnap))
    const maxUPH = Math.max(1, ...raw.filter(m => m.monthUPH != null).map(m => m.monthUPH!))
    // Pass 2: recompute with correct maxUPH for normalized productivity
    return employees.map(e => computeMetrics(e, prodSnap, maxUPH))
  }, [employees, prodSnap])

  const withData = useMemo(
    () => allMetrics.filter(m => m.hasData),
    [allMetrics]
  )

  const totalOrdersToday = useMemo(() => {
    const rows = [
      ...(prodSnap?.pickers_today   ?? []),
      ...(prodSnap?.packers_today   ?? []),
      ...(prodSnap?.operators_today ?? []),
    ]
    return rows.reduce((s, r) => s + (r.ORDERS ?? 0), 0)
  }, [prodSnap])

  const totalHoursToday = useMemo(() => {
    const rows = [
      ...(prodSnap?.pickers_today   ?? []),
      ...(prodSnap?.packers_today   ?? []),
      ...(prodSnap?.operators_today ?? []),
    ]
    return Math.round(rows.reduce((s, r) => s + (r.ORES ?? 0), 0) * 10) / 10
  }, [prodSnap])

  const meanUPH = useMemo(() => {
    if (!totalHoursToday || totalHoursToday === 0) return null
    return Math.round((totalOrdersToday / totalHoursToday) * 10) / 10
  }, [totalOrdersToday, totalHoursToday])

  return {
    prodSnap, employees, loading,
    allMetrics, withData,
    totalOrdersToday, totalHoursToday, meanUPH,
  }
}
