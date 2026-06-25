// src/pages/EmployeeListPage.tsx — Warehouse Shift Management Control Center

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store'
import {
  useProductivityData, nameMatch, type DayRow,
  impactColor, getImpactLabel, getRating,
} from '@/lib/useProductivityData'
import { initials } from '@/lib/utils'
import {
  ChevronDown, ChevronUp, X, AlertTriangle, ExternalLink, Search, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import {
  BarChart, Bar, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis,
} from 'recharts'
import type { Employee } from '@/types'

// ── Historical stats (filtered xlsx, 1.5h–12h sessions) ──────────────────────
interface HistoricalStat {
  name: string; sessions: number; avgUPH: number; minUPH: number; maxUPH: number
  mayUPH?: number | null; junUPH?: number | null
  excluded?: boolean
}

const OPERATOR_HISTORY: HistoricalStat[] = [
  { name: 'Μιχάλης Καρυπίδης',        sessions:  1, avgUPH: 258.3, minUPH: 258.3, maxUPH: 258.3, mayUPH: null, junUPH: 258.3, excluded: true },
  { name: 'Παναγιώτης Πετρόπουλος',    sessions:  7, avgUPH: 242.2, minUPH: 184.5, maxUPH: 392.3, mayUPH: null, junUPH: 242.2 },
  { name: 'Σταύρος Πανόπουλος',        sessions:  1, avgUPH: 188.0, minUPH: 188.0, maxUPH: 188.0, mayUPH: null, junUPH: 188.0, excluded: true },
  { name: 'Ηλίας Ιωακειμίδης',         sessions:  3, avgUPH: 183.2, minUPH: 151.9, maxUPH: 205.8, mayUPH: null, junUPH: 183.2 },
  { name: 'Mark Carlo Siblag',          sessions: 10, avgUPH: 181.3, minUPH: 128.0, maxUPH: 227.5, mayUPH: null, junUPH: 181.3 },
  { name: 'Γαρυφαλλιά Κοκολάκη',       sessions:  3, avgUPH: 177.4, minUPH: 157.0, maxUPH: 198.2, mayUPH: null, junUPH: 177.4 },
  { name: 'Ιωάννα Τσολαρίδου',         sessions:  1, avgUPH: 174.4, minUPH: 174.4, maxUPH: 174.4, mayUPH: null, junUPH: 174.4, excluded: true },
  { name: 'Μαρία Φιτσάλου',            sessions:  2, avgUPH: 171.2, minUPH: 165.2, maxUPH: 177.3, mayUPH: null, junUPH: 171.2 },
  { name: 'Silawan Moises Jr',          sessions:  8, avgUPH: 170.8, minUPH: 123.1, maxUPH: 203.3, mayUPH: null, junUPH: 170.8 },
  { name: 'Παναγιώτης Κανελλόπουλος',  sessions:  6, avgUPH: 170.0, minUPH:  36.4, maxUPH: 356.8, mayUPH: null, junUPH: 170.0 },
  { name: 'Τατιάνα Μαβίδη',            sessions:  4, avgUPH: 168.0, minUPH: 136.3, maxUPH: 197.0, mayUPH: null, junUPH: 168.0 },
  { name: 'Μιράν Σιαμεζ',              sessions:  5, avgUPH: 164.2, minUPH: 147.0, maxUPH: 188.7, mayUPH: null, junUPH: 164.2 },
  { name: 'Έρρικα Χυσσόλι',            sessions:  5, avgUPH: 162.0, minUPH:  55.4, maxUPH: 193.8, mayUPH: null, junUPH: 162.0 },
  { name: 'Θοδωρής Ιακωβίδης',         sessions:  2, avgUPH: 159.6, minUPH: 152.8, maxUPH: 166.3, mayUPH: null, junUPH: 159.6 },
  { name: 'Χαράλαμπος Κωνσταντινίδης', sessions:  1, avgUPH: 158.5, minUPH: 158.5, maxUPH: 158.5, mayUPH: null, junUPH: 158.5, excluded: true },
  { name: 'Νικόλαος Κουσουρής',        sessions:  1, avgUPH: 157.8, minUPH: 157.8, maxUPH: 157.8, mayUPH: null, junUPH: 157.8, excluded: true },
  { name: 'Μελετία Θεοδωρακοπούλου',   sessions: 10, avgUPH: 157.3, minUPH:  60.6, maxUPH: 207.3, mayUPH: null, junUPH: 157.3 },
  { name: 'Κώστας Μανουσακίδης',       sessions:  2, avgUPH: 156.8, minUPH: 146.6, maxUPH: 167.0, mayUPH: null, junUPH: 156.8 },
  { name: 'Κώστας Κούκας',             sessions:  7, avgUPH: 156.2, minUPH: 109.8, maxUPH: 204.2, mayUPH: null, junUPH: 156.2 },
  { name: 'Siblag Charl Edesl',         sessions:  6, avgUPH: 154.4, minUPH: 134.1, maxUPH: 170.7, mayUPH: null, junUPH: 154.4 },
  { name: 'Σπύρος Παππάς',             sessions:  4, avgUPH: 152.8, minUPH: 119.6, maxUPH: 204.1, mayUPH: null, junUPH: 152.8 },
  { name: 'Φοίβος Σαλαχας',            sessions: 18, avgUPH: 149.6, minUPH:  97.0, maxUPH: 200.4, mayUPH: null, junUPH: 149.6 },
  { name: 'Cunanan Kevin Luna',         sessions:  9, avgUPH: 143.0, minUPH:  12.3, maxUPH: 211.6, mayUPH: null, junUPH: 143.0 },
  { name: 'Πηνελόπη Γκογκάκη',         sessions:  4, avgUPH: 140.9, minUPH: 114.5, maxUPH: 167.0, mayUPH: null, junUPH: 140.9 },
  { name: 'Γιάννης Παυλίδης',          sessions:  7, avgUPH: 114.0, minUPH:  21.8, maxUPH: 225.5, mayUPH: null, junUPH: 114.0 },
]

const PACKER_HISTORY: HistoricalStat[] = [
  { name: 'Χαρούλα Ιωσηφόγλου',           sessions: 44, avgUPH: 143.7, minUPH:  39.9, maxUPH: 249.3, mayUPH: 158.0, junUPH: 126.6 },
  { name: 'Λαμπρινή Νίκου',               sessions:  5, avgUPH: 138.4, minUPH:  67.6, maxUPH: 196.3, mayUPH: 138.4, junUPH: null  },
  { name: 'Ευαγγελία Κοτρώνη',            sessions: 40, avgUPH: 134.1, minUPH:  47.2, maxUPH: 231.7, mayUPH: 158.6, junUPH: 104.3 },
  { name: 'Κατερίνα Δημητροπούλου',        sessions: 33, avgUPH: 131.5, minUPH:  58.6, maxUPH: 252.9, mayUPH: 136.8, junUPH: 123.2 },
  { name: 'Αλεξάνδρα Ζουρνατσίδου',       sessions: 38, avgUPH: 129.8, minUPH:  63.6, maxUPH: 223.2, mayUPH: 137.1, junUPH: 122.4 },
  { name: 'Γιάννα Σταματοπούλου',          sessions: 29, avgUPH: 128.2, minUPH:  55.2, maxUPH: 241.2, mayUPH: 125.7, junUPH: 131.0 },
  { name: 'Νάντια Ρεμί',                  sessions:  3, avgUPH: 121.9, minUPH:  79.3, maxUPH: 154.2, mayUPH: 121.9, junUPH: null  },
  { name: 'Μαρία Φιτσάλου',               sessions: 45, avgUPH: 120.6, minUPH:  42.5, maxUPH: 245.5, mayUPH: 146.5, junUPH:  88.4 },
  { name: 'Γαρυφαλλιά Κοκολάκη',          sessions: 36, avgUPH: 117.6, minUPH:  39.1, maxUPH: 229.2, mayUPH: 103.3, junUPH: 133.6 },
  { name: 'Δέσποινα Αληγιάννη',           sessions: 39, avgUPH: 116.4, minUPH:  63.8, maxUPH: 226.4, mayUPH: 142.4, junUPH:  89.1 },
  { name: 'Ανδρέας Λεμοντζόγλου',         sessions:  5, avgUPH: 104.0, minUPH:  77.0, maxUPH: 163.0, mayUPH: null,  junUPH: 104.0 },
  { name: 'Κυριακή Βασιλακάκου',          sessions: 11, avgUPH: 104.0, minUPH:  66.4, maxUPH: 147.4, mayUPH: 101.9, junUPH: 125.4 },
  { name: 'Άννα Αναγνωστοπούλου',         sessions: 32, avgUPH: 103.9, minUPH:  34.4, maxUPH: 190.4, mayUPH: 110.2, junUPH:  98.9 },
  { name: 'Ειρήνη Μουρατίδου',            sessions:  5, avgUPH: 103.9, minUPH:  84.4, maxUPH: 110.5, mayUPH: 109.5, junUPH: 100.1 },
  { name: 'Μαρία Κούλα',                  sessions: 19, avgUPH: 101.3, minUPH:  43.9, maxUPH: 152.8, mayUPH: 108.8, junUPH:  99.4 },
  { name: 'Μπαιρακτάροβ Αλέξης',          sessions:  1, avgUPH:  99.9, minUPH:  99.9, maxUPH:  99.9, mayUPH: null,  junUPH:  99.9, excluded: true },
  { name: 'Πετράκου Φαίη',                sessions:  8, avgUPH:  96.8, minUPH:  78.5, maxUPH: 129.9, mayUPH: null,  junUPH:  96.8 },
  { name: 'Μαρία Omeri',                  sessions: 13, avgUPH:  96.2, minUPH:  71.0, maxUPH: 133.4, mayUPH: null,  junUPH:  96.2 },
  { name: 'Μαρία Ρενιέρη',               sessions:  1, avgUPH:  95.2, minUPH:  95.2, maxUPH:  95.2, mayUPH:  95.2, junUPH: null,  excluded: true },
  { name: 'Φοίβος Σαλαχας',               sessions:  8, avgUPH:  94.3, minUPH:  19.6, maxUPH: 165.9, mayUPH: 107.4, junUPH:  55.0 },
  { name: 'Λυδία Καζάκου',                sessions: 22, avgUPH:  93.9, minUPH:  50.8, maxUPH: 155.5, mayUPH:  85.8, junUPH:  95.7 },
  { name: 'Ιωάννα Τσολαρίδου',           sessions: 31, avgUPH:  92.5, minUPH:   8.7, maxUPH: 190.4, mayUPH:  89.8, junUPH:  95.1 },
  { name: 'Παναγιώτης Πετρόπουλος',       sessions:  7, avgUPH:  77.4, minUPH:  40.7, maxUPH: 124.7, mayUPH:  59.5, junUPH:  90.9 },
  { name: 'Βαγγέλης Τριανταφυλλόπουλος', sessions: 12, avgUPH:  77.2, minUPH:   5.0, maxUPH: 203.1, mayUPH:  34.8, junUPH: 119.5 },
  { name: 'Mina Ago',                     sessions:  8, avgUPH:  76.9, minUPH:  21.3, maxUPH: 110.6, mayUPH: null,  junUPH:  76.9 },
  { name: 'Γιώργος Καββαδάς',            sessions:  4, avgUPH:  76.2, minUPH:  11.2, maxUPH: 225.2, mayUPH:  76.2, junUPH: null  },
  { name: 'Έρρικα Χυσσόλι',              sessions: 14, avgUPH:  72.9, minUPH:  10.3, maxUPH: 127.5, mayUPH:  65.7, junUPH:  82.4 },
  { name: 'Ελένη Κλούδα',                sessions: 12, avgUPH:  71.9, minUPH:  17.8, maxUPH: 118.9, mayUPH:  61.2, junUPH:  79.6 },
  { name: 'Μαρία Μιχαηλίδου',            sessions: 12, avgUPH:  68.0, minUPH:  14.8, maxUPH: 121.4, mayUPH:  80.9, junUPH:  65.4 },
  { name: 'Νίνα Κωστίδη',               sessions:  1, avgUPH:  65.1, minUPH:  65.1, maxUPH:  65.1, mayUPH: null,  junUPH:  65.1, excluded: true },
  { name: 'Κώστας Κούκας',              sessions: 41, avgUPH:  56.1, minUPH:   1.8, maxUPH: 163.9, mayUPH:  61.4, junUPH:  50.5 },
  { name: 'Siblag Felix Jr',              sessions:  1, avgUPH:  47.1, minUPH:  47.1, maxUPH:  47.1, mayUPH: null,  junUPH:  47.1, excluded: true },
  { name: 'Πηνελόπη Γκογκάκη',           sessions:  2, avgUPH:  46.6, minUPH:  21.0, maxUPH:  72.3, mayUPH:  46.6, junUPH: null  },
  { name: 'Νικόλαος Κουσουρής',          sessions:  4, avgUPH:  45.3, minUPH:  31.5, maxUPH:  69.7, mayUPH: null,  junUPH:  45.3 },
  { name: 'Στέφανος Καρράς',             sessions:  1, avgUPH:  42.2, minUPH:  42.2, maxUPH:  42.2, mayUPH:  42.2, junUPH: null,  excluded: true },
  { name: 'Γιάννης Παυλίδης',            sessions: 37, avgUPH:  40.2, minUPH:   0.9, maxUPH: 108.1, mayUPH:  35.0, junUPH:  45.1 },
  { name: 'Σταύρος Πανόπουλος',          sessions:  4, avgUPH:  35.6, minUPH:   1.4, maxUPH:  77.6, mayUPH:  35.6, junUPH: null  },
  { name: 'Μιραν Σιαμεζ',               sessions:  7, avgUPH:  28.1, minUPH:  13.1, maxUPH:  56.3, mayUPH:  23.4, junUPH:  56.3 },
  { name: 'Παναγιώτης Κανελλόπουλος',    sessions: 38, avgUPH:  24.0, minUPH:   1.1, maxUPH: 101.0, mayUPH:  26.5, junUPH:  21.4 },
  { name: 'Τατιάνα Μαβίδη',             sessions:  1, avgUPH:  23.7, minUPH:  23.7, maxUPH:  23.7, mayUPH: null,  junUPH:  23.7, excluded: true },
  { name: 'Σπύρος Παππάς',               sessions: 38, avgUPH:  23.3, minUPH:   0.8, maxUPH: 100.1, mayUPH:  27.0, junUPH:  19.2 },
  { name: 'Δήμητρα Γιαννίτσου',          sessions:  1, avgUPH:  22.6, minUPH:  22.6, maxUPH:  22.6, mayUPH:  22.6, junUPH: null,  excluded: true },
  { name: 'Γιάννης Μουρατίδης',          sessions:  4, avgUPH:  21.6, minUPH:  12.8, maxUPH:  30.3, mayUPH:  21.6, junUPH: null  },
  { name: 'Μιχάλης Καρυπίδης',           sessions:  3, avgUPH:  18.4, minUPH:   1.4, maxUPH:  49.3, mayUPH:   2.9, junUPH:  49.3 },
  { name: 'Ελένη Ψωμαδέλη',             sessions:  1, avgUPH:  16.6, minUPH:  16.6, maxUPH:  16.6, mayUPH:  16.6, junUPH: null,  excluded: true },
]

const PICKER_HISTORY: HistoricalStat[] = [
  { name: 'Πηνελόπη Γκογκάκη',           sessions: 13, avgUPH: 113.5, minUPH:  77.5, maxUPH: 181.3, mayUPH: 113.5, junUPH: null  },
  { name: 'Έρρικα Χυσσόλι',              sessions: 24, avgUPH: 103.7, minUPH:  29.0, maxUPH: 270.8, mayUPH: 116.3, junUPH:  86.0 },
  { name: 'Μελετία Θεοδωρακοπούλου',     sessions: 28, avgUPH:  94.7, minUPH:  27.1, maxUPH: 144.8, mayUPH: 110.0, junUPH:  71.1 },
  { name: 'Τατιάνα Μαβίδη',             sessions: 34, avgUPH:  90.4, minUPH:  10.8, maxUPH: 207.8, mayUPH: 102.4, junUPH:  68.4 },
  { name: 'Θοδωρής Ιακωβίδης',           sessions: 31, avgUPH:  89.3, minUPH:  68.2, maxUPH: 128.6, mayUPH:  89.2, junUPH:  89.5 },
  { name: 'Χαράλαμπος Κωνσταντινίδης',   sessions: 31, avgUPH:  87.4, minUPH:  16.1, maxUPH: 140.9, mayUPH:  83.6, junUPH:  91.6 },
  { name: 'Κώστας Καραδενιζλής',         sessions:  2, avgUPH:  86.2, minUPH:  82.5, maxUPH:  90.0, mayUPH:  86.2, junUPH: null  },
  { name: 'Ιωάννα Τσολαρίδου',          sessions:  4, avgUPH:  84.6, minUPH:  64.5, maxUPH: 100.0, mayUPH:  86.1, junUPH:  80.3 },
  { name: 'Παναγιώτης Πετρόπουλος',      sessions: 17, avgUPH:  83.9, minUPH:  41.1, maxUPH: 147.1, mayUPH:  86.8, junUPH:  81.3 },
  { name: 'Κώστας Μανουσακίδης',         sessions: 34, avgUPH:  72.7, minUPH:  29.1, maxUPH: 133.6, mayUPH:  83.4, junUPH:  62.0 },
  { name: 'Ηλίας Ιωακειμίδης',           sessions: 37, avgUPH:  70.9, minUPH:  35.4, maxUPH: 133.3, mayUPH:  78.9, junUPH:  61.5 },
  { name: 'Μιραν Σιαμεζ',               sessions:  7, avgUPH:  69.2, minUPH:  44.8, maxUPH:  93.6, mayUPH:  73.2, junUPH:  44.8 },
  { name: 'Ελένη Ψωμαδέλη',             sessions:  9, avgUPH:  68.8, minUPH:  46.1, maxUPH:  92.9, mayUPH:  68.8, junUPH: null  },
  { name: 'Στέφανος Καρράς',            sessions:  7, avgUPH:  64.0, minUPH:  37.2, maxUPH:  86.8, mayUPH:  64.0, junUPH: null  },
  { name: 'Γιώργος Καββαδάς',           sessions:  3, avgUPH:  59.7, minUPH:  19.2, maxUPH:  82.4, mayUPH:  59.7, junUPH: null  },
  { name: 'Νάνσυ Μπασιώτη',            sessions:  1, avgUPH:  57.2, minUPH:  57.2, maxUPH:  57.2, mayUPH:  57.2, junUPH: null,  excluded: true },
  { name: 'Βαγγέλης Τριανταφυλλόπουλος',sessions:  7, avgUPH:  52.6, minUPH:   1.8, maxUPH: 102.8, mayUPH:  60.2, junUPH:  42.5 },
  { name: 'Ανδρέας Λεμοντζόγλου',       sessions:  7, avgUPH:  49.2, minUPH:  15.6, maxUPH:  76.3, mayUPH:  40.7, junUPH:  50.6 },
  { name: 'Τσουτουρίδης Νίκος',         sessions:  3, avgUPH:  46.8, minUPH:  44.4, maxUPH:  49.7, mayUPH: null,  junUPH:  46.8 },
  { name: 'Σπύρος Παππάς',              sessions:  2, avgUPH:  31.4, minUPH:  23.9, maxUPH:  38.9, mayUPH:  23.9, junUPH:  38.9 },
  { name: 'Κώστας Κούκας',              sessions:  6, avgUPH:  30.3, minUPH:   0.5, maxUPH: 107.5, mayUPH:  37.8, junUPH:  22.7 },
  { name: 'Ελένη Παπαδοπούλου',         sessions:  5, avgUPH:  29.5, minUPH:   0.4, maxUPH:  90.5, mayUPH:  72.3, junUPH:   1.0 },
  { name: 'Γιάννης Παυλίδης',           sessions:  5, avgUPH:  22.6, minUPH:   3.5, maxUPH:  68.4, mayUPH:  44.7, junUPH:   7.9 },
  { name: 'Αντώνης Πολυχρονόπουλος',    sessions: 11, avgUPH:  14.9, minUPH:   1.3, maxUPH: 102.8, mayUPH:  19.2, junUPH:   9.6 },
  { name: 'Νικόλαος Κουσουρής',         sessions:  1, avgUPH:   8.4, minUPH:   8.4, maxUPH:   8.4, mayUPH: null,  junUPH:   8.4, excluded: true },
  { name: 'Παναγιώτης Κανελλόπουλος',   sessions:  5, avgUPH:   1.1, minUPH:   0.8, maxUPH:   1.3, mayUPH:   1.0, junUPH:   1.1 },
  { name: 'Ανδριανός Καρυπίδης',        sessions:  7, avgUPH:   0.5, minUPH:   0.2, maxUPH:   1.1, mayUPH:   0.6, junUPH:   0.4 },
  { name: 'Μιχάλης Καρυπίδης',          sessions:  1, avgUPH:   0.4, minUPH:   0.4, maxUPH:   0.4, mayUPH:   0.4, junUPH: null,  excluded: true },
]

// ── Role targets ──────────────────────────────────────────────────────────────
const ROLE_TARGETS: Record<string, number> = {
  operator: 180, packer: 75, picker: 80,
  palletizer: 50, sorter: 50, validator: 60, transporter: 50, team_leader: 80,
}

const ROLE_GROUPS = [
  { roles: ['operator'],                                                         label: 'OPERATORS',           color: '#f59e0b' },
  { roles: ['packer'],                                                           label: 'PACKERS',             color: '#22c55e' },
  { roles: ['picker'],                                                           label: 'PICKERS (ΡΑΦΙ)',      color: '#3b82f6' },
  { roles: ['palletizer','sorter','validator','transporter','team_leader'],       label: 'PALLETIZERS / SORTERS', color: '#8b5cf6' },
]

function isValidDay(r: DayRow) { return r.ORES >= 1.5 && r.ORES <= 11.99 }

interface EmpStats {
  liveUPH: number | null; isLive: boolean; target: number
  gap: number | null; gapPct: number | null
  status: 'above' | 'near' | 'below' | 'none'
  achieveDays: number; totalDays: number; achievePct: number | null
  trendPct: number | null; streakAbove: number; streakBelow: number
  validDays: DayRow[]
}

function computeStats(emp: Employee, metrics: any, prodSnap: any, overrideRole?: string): EmpStats {
  const role   = overrideRole ?? emp.primary_role
  const target = ROLE_TARGETS[role] ?? 70
  const roleArr: DayRow[] | undefined =
    role === 'operator' ? prodSnap?.operators_days :
    role === 'packer'   ? prodSnap?.packers_days   :
    role === 'picker'   ? prodSnap?.pickers_days   : undefined
  const oracleName = (emp as any).oracle_name as string | null | undefined
  const validDays: DayRow[] = (roleArr ?? [])
    .filter((r: DayRow) => nameMatch(emp.full_name, r.ONOMA, oracleName) && isValidDay(r))
    .sort((a: DayRow, b: DayRow) => a.DAY.localeCompare(b.DAY))
  const isSecondaryRole = overrideRole != null && overrideRole !== emp.primary_role
  // Always compute monthUPH from role-specific validDays to avoid cross-role contamination
  // (e.g. an operator who is also a picker would otherwise get picker UPH shown in the operator group)
  const validMonthUPH = validDays.length > 0
    ? Math.round(validDays.reduce((s, d) => s + (d.UPH ?? 0), 0) / validDays.length * 10) / 10 : null
  let todayUPH: number | null, monthUPH: number | null
  if (isSecondaryRole) {
    monthUPH = validMonthUPH
    todayUPH = null
  } else {
    todayUPH = metrics?.todayUPH ?? null
    monthUPH = validMonthUPH
  }
  const liveUPH = todayUPH ?? monthUPH
  const isLive  = todayUPH != null
  const gap    = liveUPH != null ? Math.round((liveUPH - target) * 10) / 10 : null
  const gapPct = liveUPH != null ? Math.round(((liveUPH - target) / target) * 100) : null
  const status: EmpStats['status'] =
    liveUPH == null ? 'none' : liveUPH >= target ? 'above' : liveUPH >= target * 0.9 ? 'near' : 'below'
  const achieveDays = validDays.filter(d => (d.UPH ?? 0) >= target).length
  const achievePct  = validDays.length > 0 ? Math.round(achieveDays / validDays.length * 100) : null
  const desc = [...validDays].reverse()
  let streakAbove = 0, streakBelow = 0
  for (const d of desc) {
    if ((d.UPH ?? 0) >= target) { if (streakBelow > 0) break; streakAbove++ }
    else                        { if (streakAbove > 0) break; streakBelow++ }
  }
  return { liveUPH, isLive, target, gap, gapPct, status, achieveDays, totalDays: validDays.length,
    achievePct, trendPct: isSecondaryRole ? null : (metrics?.trend ?? null),
    streakAbove, streakBelow, validDays }
}

function StatusDot({ status }: { status: EmpStats['status'] }) {
  const cls = status === 'above' ? 'bg-emerald-500' : status === 'near' ? 'bg-amber-400' :
    status === 'below' ? 'bg-red-500' : 'bg-slate-300'
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />
}

function GapBadge({ gap, pct }: { gap: number | null; pct: number | null }) {
  if (gap == null) return <span className="text-slate-300 text-xs">—</span>
  const pos = gap >= 0
  return (
    <div className={`text-xs font-bold leading-none ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      <div>{pos ? '+' : ''}{gap}</div>
      <div className="text-[10px] font-normal opacity-70">{pos ? '+' : ''}{pct}%</div>
    </div>
  )
}

function AchieveBadge({ achieved, total, pct }: { achieved: number; total: number; pct: number | null }) {
  if (pct == null || total === 0) return <span className="text-slate-300 text-xs">—</span>
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col gap-0.5 min-w-[72px]">
      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
        {achieved}/{total}d · <span style={{ color }}>{pct}%</span>
      </span>
    </div>
  )
}

interface GroupInfo {
  label: string; color: string; role: string; employees: Employee[]
  withData: { emp: Employee; stats: EmpStats }[]
  avgUPH: number | null; target: number; gapPct: number | null
  above: number; near: number; below: number; noData: number
}

function GroupHeader({ g, collapsed, onToggle }: { g: GroupInfo; collapsed: boolean; onToggle: () => void }) {
  const gapColor = g.gapPct == null ? '#94a3b8' : g.gapPct >= 0 ? '#22c55e' : g.gapPct >= -10 ? '#f59e0b' : '#ef4444'
  return (
    <button onClick={onToggle}
      className="w-full flex items-center gap-4 px-4 py-2.5 text-left bg-slate-100 border-y border-slate-200 hover:bg-slate-200/70 transition-colors sticky top-0 z-10"
      style={{ borderLeft: `4px solid ${g.color}` }}>
      <span className="flex items-center gap-2 flex-shrink-0">
        {collapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-400" />}
        <span className="font-bold text-xs text-slate-700 tracking-widest uppercase">{g.label}</span>
        <span className="text-slate-400 text-xs">({g.employees.length})</span>
      </span>
      {g.avgUPH != null && (
        <div className="flex items-center gap-5 flex-1">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold">Avg UPH</span>
            <span className="text-xs font-bold text-slate-700">{g.avgUPH} o/h</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold">Στόχος</span>
            <span className="text-xs font-bold text-slate-700">{g.target} o/h</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase tracking-wide font-semibold">Gap</span>
            <span className="text-xs font-bold" style={{ color: gapColor }}>
              {g.gapPct != null ? `${g.gapPct >= 0 ? '+' : ''}${g.gapPct}%` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs ml-auto">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{g.above}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400  inline-block" />{g.near}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500    inline-block" />{g.below}</span>
            {g.noData > 0 && <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />{g.noData}</span>}
          </div>
        </div>
      )}
    </button>
  )
}

function EmpRow({ emp, stats, groupRole, isSelected, onClick }: { emp: Employee; stats: EmpStats; groupRole: string; isSelected: boolean; onClick: () => void }) {
  const bg = isSelected ? 'bg-blue-50' :
    stats.status === 'below' ? 'hover:bg-red-50/40' :
    stats.status === 'above' ? 'hover:bg-emerald-50/40' : 'hover:bg-slate-50'
  return (
    <tr onClick={onClick} className={`border-b border-slate-100 cursor-pointer transition-colors ${bg}`}
      style={isSelected ? { borderLeft: '3px solid #3b82f6' } : {}}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {initials(emp.full_name)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-800 truncate leading-tight">{emp.full_name}</div>
            <div className="text-[10px] text-slate-400 capitalize">
              {emp.primary_role === groupRole
                ? emp.primary_role
                : <span>{groupRole} <span className="opacity-60">(2ος ρόλος)</span></span>}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        {stats.liveUPH != null ? (
          <div className="flex flex-col items-center leading-none">
            <span className="text-sm font-bold text-slate-800">{Math.round(stats.liveUPH)}</span>
            <span className="text-[9px] font-semibold mt-0.5" style={{ color: stats.isLive ? '#22c55e' : '#94a3b8' }}>
              {stats.isLive ? '● LIVE' : 'μ.ο. μήνα'}
            </span>
          </div>
        ) : <span className="text-slate-300 text-xs">—</span>}
      </td>
      <td className="px-3 py-2.5 text-center"><span className="text-xs text-slate-500 font-mono">{stats.target}</span></td>
      <td className="px-3 py-2.5 text-center"><GapBadge gap={stats.gap} pct={stats.gapPct} /></td>
      <td className="px-3 py-2.5 text-center">
        {stats.trendPct != null ? (
          <span className={`text-xs font-bold ${stats.trendPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {stats.trendPct >= 0 ? '▲' : '▼'} {Math.abs(stats.trendPct)}%
          </span>
        ) : <span className="text-slate-300 text-xs">—</span>}
      </td>
      <td className="px-3 py-2.5"><AchieveBadge achieved={stats.achieveDays} total={stats.totalDays} pct={stats.achievePct} /></td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusDot status={stats.status} />
          <span className="text-[10px] text-slate-500">
            {stats.status === 'above' ? 'Above' : stats.status === 'near' ? 'Near' : stats.status === 'below' ? 'Below' : '—'}
          </span>
          {stats.streakBelow >= 3 && <span className="text-[9px] bg-red-100 text-red-600 font-bold px-1 rounded">↓{stats.streakBelow}d</span>}
          {stats.streakAbove >= 5 && <span className="text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1 rounded">🔥{stats.streakAbove}d</span>}
        </div>
      </td>
    </tr>
  )
}

interface Alert { level: 'critical' | 'warning' | 'info'; text: string }

function computeAlerts(groups: GroupInfo[], allStats: { emp: Employee; stats: EmpStats }[]): Alert[] {
  const alerts: Alert[] = []
  for (const g of groups) {
    if (g.below >= 3) alerts.push({ level: 'critical', text: `${g.below} ${g.label} κάτω από στόχο` })
    else if (g.below > 0) alerts.push({ level: 'warning', text: `${g.below} ${g.label} κάτω από στόχο` })
  }
  for (const { emp, stats } of allStats) {
    if (stats.streakBelow >= 3) {
      const p = emp.full_name.split(' ')
      alerts.push({ level: 'warning', text: `${p[0]} ${p[1]?.[0] ?? ''}.  κάτω από στόχο ${stats.streakBelow} συνεχόμενες ημέρες` })
    }
  }
  for (const { emp, stats } of allStats) {
    if (stats.streakAbove >= 7) {
      const p = emp.full_name.split(' ')
      alerts.push({ level: 'info', text: `${p[0]} ${p[1]?.[0] ?? ''}.  πάνω από στόχο ${stats.streakAbove} συνεχόμενες ημέρες 🔥` })
    }
  }
  return alerts
}

function RightPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Alerts</span>
        {alerts.length > 0 && <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{alerts.length}</span>}
      </div>
      {alerts.length === 0 ? (
        <div className="text-[11px] text-slate-400 italic px-1">Όλα εντάξει ✓</div>
      ) : alerts.map((a, i) => (
        <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-[11px] leading-snug ${
          a.level === 'critical' ? 'bg-red-50 border border-red-200 text-red-700' :
          a.level === 'warning'  ? 'bg-amber-50 border border-amber-200 text-amber-700' :
          'bg-blue-50 border border-blue-200 text-blue-700'}`}>
          <span className="flex-shrink-0">{a.level === 'critical' ? '🚨' : a.level === 'warning' ? '⚠️' : '🔥'}</span>
          {a.text}
        </div>
      ))}
    </div>
  )
}

// ── Historical stats table (generic, sortable, month filter) ──────────────────
type HistSort    = { col: string; dir: 'asc' | 'desc' }
type MonthFilter = 'total' | 'may' | 'jun'

interface HistTableConfig {
  data: HistoricalStat[]; label: string; target: number; barMax: number; rowLabel: string
  accentBg: string; accentBorder: string; accentText: string; accentSub: string
  footerBg: string; footerBorder: string; footerText: string
}

function HistoricalStatsTable({ cfg }: { cfg: HistTableConfig }) {
  const [sort,  setSort]  = useState<HistSort>({ col: 'avgUPH', dir: 'desc' })
  const [month, setMonth] = useState<MonthFilter>('total')
  const hasMonths = cfg.data.some(r => r.mayUPH != null || r.junUPH != null)

  function getUPH(r: HistoricalStat): number | null {
    if (month === 'may') return r.mayUPH ?? null
    if (month === 'jun') return r.junUPH ?? null
    return r.avgUPH
  }

  const sorted = useMemo(() => {
    const data = [...cfg.data]
    data.sort((a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1
      if (sort.col === 'name')     return dir * a.name.localeCompare(b.name)
      if (sort.col === 'monthUPH') return dir * ((getUPH(a) ?? -1) - (getUPH(b) ?? -1))
      if (sort.col === 'sessions') return dir * (a.sessions - b.sessions)
      if (sort.col === 'avgUPH')   return dir * (a.avgUPH - b.avgUPH)
      if (sort.col === 'minUPH')   return dir * (a.minUPH - b.minUPH)
      if (sort.col === 'maxUPH')   return dir * (a.maxUPH - b.maxUPH)
      if (sort.col === 'mayUPH')   return dir * ((a.mayUPH ?? -1) - (b.mayUPH ?? -1))
      if (sort.col === 'junUPH')   return dir * ((a.junUPH ?? -1) - (b.junUPH ?? -1))
      return 0
    })
    return data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, cfg.data, month])

  const included     = cfg.data.filter(r => !r.excluded)
  const totalSess    = included.reduce((s, r) => s + r.sessions, 0)
  const teamTotal    = totalSess > 0 ? Math.round(included.reduce((s, r) => s + r.avgUPH * r.sessions, 0) / totalSess * 10) / 10 : 0
  const teamMay      = (() => { const rs = included.filter(r => r.mayUPH != null); return rs.length ? Math.round(rs.reduce((s, r) => s + r.mayUPH!, 0) / rs.length * 10) / 10 : null })()
  const teamJun      = (() => { const rs = included.filter(r => r.junUPH != null); return rs.length ? Math.round(rs.reduce((s, r) => s + r.junUPH!, 0) / rs.length * 10) / 10 : null })()
  const teamDisplay  = month === 'may' ? teamMay : month === 'jun' ? teamJun : teamTotal

  function SI({ col }: { col: string }) {
    if (sort.col !== col) return <ArrowUpDown className="w-3 h-3 opacity-30" />
    return sort.dir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />
  }
  function ts(col: string) { setSort(p => p.col === col ? { col, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }) }
  const th = "px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-slate-700 transition-colors"

  return (
    <div className="mx-4 mb-6 mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className={`flex items-center gap-2 px-4 py-2.5 ${cfg.accentBg} border-b ${cfg.accentBorder}`}>
        <span className={`text-[11px] font-bold ${cfg.accentText} uppercase tracking-widest`}>{cfg.label}</span>
        <span className={`text-[10px] ${cfg.accentSub} ml-1`}>({totalSess} sessions · Μ.Ο {teamTotal} UPH · στόχος {cfg.target})</span>
        {hasMonths && (
          <div className="ml-auto flex items-center gap-0.5 bg-white/60 rounded-lg p-0.5 border border-slate-200">
            {(['total','may','jun'] as MonthFilter[]).map(m => (
              <button key={m}
                onClick={() => { setMonth(m); setSort({ col: m === 'total' ? 'avgUPH' : 'monthUPH', dir: 'desc' }) }}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${month === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {m === 'total' ? 'Σύνολο' : m === 'may' ? 'Μάιος' : 'Ιούνιος'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className={`${th} text-left`} onClick={() => ts('name')}>
                <span className="flex items-center gap-1">{cfg.rowLabel} <SI col="name" /></span>
              </th>
              <th className={th} onClick={() => ts('sessions')}>
                <span className="flex items-center justify-center gap-1">Sessions <SI col="sessions" /></span>
              </th>
              <th className={th} onClick={() => ts(month === 'total' ? 'avgUPH' : 'monthUPH')}>
                <span className="flex items-center justify-center gap-1">
                  {month === 'may' ? 'Μάιος UPH' : month === 'jun' ? 'Ιούν UPH' : 'Μ.Ο UPH'}
                  <SI col={month === 'total' ? 'avgUPH' : 'monthUPH'} />
                </span>
              </th>
              {month === 'total' ? <>
                <th className={th} onClick={() => ts('minUPH')}><span className="flex items-center justify-center gap-1">Min <SI col="minUPH" /></span></th>
                <th className={th} onClick={() => ts('maxUPH')}><span className="flex items-center justify-center gap-1">Max <SI col="maxUPH" /></span></th>
              </> : hasMonths && <>
                <th className={th} onClick={() => ts(month === 'may' ? 'junUPH' : 'mayUPH')}>
                  <span className="flex items-center justify-center gap-1">{month === 'may' ? 'Ιούν' : 'Μάιος'} <SI col={month === 'may' ? 'junUPH' : 'mayUPH'} /></span>
                </th>
                <th className={th} onClick={() => ts('avgUPH')}><span className="flex items-center justify-center gap-1">Σύνολο <SI col="avgUPH" /></span></th>
              </>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const uph = getUPH(row)
              const barPct  = uph != null ? Math.min(100, Math.round(uph / cfg.barMax * 100)) : 0
              const barColor = uph == null ? '#cbd5e1' : uph >= cfg.target ? '#22c55e' : uph >= cfg.target * 0.8 ? '#f59e0b' : '#ef4444'
              return (
                <tr key={row.name} className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${row.excluded ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono w-4 text-right">{i + 1}</span>
                      {row.name}
                      {row.excluded && <span className="text-[9px] bg-slate-100 text-slate-400 px-1 rounded">1 session</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-slate-500">{row.sessions}</td>
                  <td className="px-3 py-2 text-center">
                    {uph != null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: barColor }} />
                        </div>
                        <span className="font-bold w-10 text-right" style={{ color: barColor }}>{uph}</span>
                      </div>
                    ) : <span className="text-slate-300 block text-center">—</span>}
                  </td>
                  {month === 'total' ? <>
                    <td className="px-3 py-2 text-center text-slate-500">{row.minUPH}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{row.maxUPH}</td>
                  </> : hasMonths && <>
                    <td className="px-3 py-2 text-center text-slate-400 text-[11px]">{(month === 'may' ? row.junUPH : row.mayUPH) ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-slate-400 text-[11px]">{row.avgUPH}</td>
                  </>}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={`${cfg.footerBg} border-t-2 ${cfg.footerBorder}`}>
              <td className={`px-3 py-2 font-bold ${cfg.footerText}`}>TEAM Μ.Ο <span className="font-normal text-[10px] opacity-70">(≥2 sessions)</span></td>
              <td className={`px-3 py-2 text-center font-bold ${cfg.footerText}`}>{totalSess}</td>
              <td className={`px-3 py-2 text-center font-bold ${cfg.footerText}`}>{teamDisplay ?? '—'}</td>
              {month === 'total' ? <>
                <td className={`px-3 py-2 text-center ${cfg.accentSub}`}>—</td>
                <td className={`px-3 py-2 text-center ${cfg.accentSub}`}>—</td>
              </> : hasMonths && <>
                <td className={`px-3 py-2 text-center ${cfg.accentSub}`}>{month === 'may' ? (teamJun ?? '—') : (teamMay ?? '—')}</td>
                <td className={`px-3 py-2 text-center ${cfg.accentSub}`}>{teamTotal}</td>
              </>}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Employee Drawer ───────────────────────────────────────────────────────────
function EmployeeDrawer({ emp, stats, metrics, rank, groupSize, onClose, onNavigate }: {
  emp: Employee; stats: EmpStats; metrics: any; rank: number; groupSize: number
  onClose: () => void; onNavigate: () => void
}) {
  const impScore = metrics?.impactScore ?? 0
  const { label: ratingLabel, stars, color: ratingColor } = getRating(impScore)
  const chartData = stats.validDays.slice(-14).map(d => ({ day: d.DAY.substring(5), uph: d.UPH ?? 0 }))
  const avgOrders = stats.validDays.length > 0 ? Math.round(stats.validDays.reduce((s, d) => s + d.ORDERS, 0) / stats.validDays.length) : null
  const bestUPH   = stats.validDays.length > 0 ? Math.max(...stats.validDays.map(d => d.UPH ?? 0)) : null

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l border-slate-200 flex flex-col z-50">
        <div className="flex items-center gap-3 p-4 border-b border-slate-100 flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials(emp.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 text-sm truncate">{emp.full_name}</div>
            <div className="text-[10px] text-slate-500 capitalize">{emp.primary_role}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-1.5">
            {([['1ος Ρόλος', emp.primary_role], ['2ος Ρόλος', emp.secondary_role], ['3ος Ρόλος', emp.tertiary_role]] as [string, string|null][]).map(([label, value]) => (
              <div key={label} className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
                <div className="text-[9px] text-slate-400 uppercase font-semibold tracking-wide">{label}</div>
                <div className="text-[11px] font-bold text-slate-700 capitalize mt-0.5 truncate">{value ?? '—'}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-semibold mb-1">Impact Score</div>
              <div className="text-2xl font-black leading-none" style={{ color: impactColor(impScore) }}>{impScore}</div>
              <div className="text-[10px] text-slate-500 mt-1">{getImpactLabel(impScore)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-semibold mb-1">Rating</div>
              <div className="text-base leading-none" style={{ color: ratingColor }}>{'★'.repeat(stars)}{'☆'.repeat(5-stars)}</div>
              <div className="text-[10px] text-slate-500 mt-1">{ratingLabel}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg p-2.5 border border-slate-100 bg-slate-50">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Live UPH</div>
              <div className={`text-xl font-black leading-none mt-0.5 ${stats.status === 'above' ? 'text-emerald-600' : stats.status === 'below' ? 'text-red-500' : 'text-amber-500'}`}>
                {stats.liveUPH != null ? Math.round(stats.liveUPH) : '—'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">στόχος: {stats.target}</div>
            </div>
            <div className="rounded-lg p-2.5 border border-slate-100 bg-slate-50">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Target Ach.</div>
              <div className={`text-xl font-black leading-none mt-0.5 ${(stats.achievePct ?? 0) >= 80 ? 'text-emerald-600' : (stats.achievePct ?? 0) >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                {stats.achievePct != null ? `${stats.achievePct}%` : '—'}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{stats.achieveDays}/{stats.totalDays} ημέρες</div>
            </div>
          </div>
          {rank > 0 && groupSize > 0 && (
            <div className="rounded-lg p-2.5 bg-blue-50 border border-blue-100 flex items-center gap-3">
              <span className="text-2xl font-black text-blue-600">#{rank}</span>
              <div>
                <div className="text-[10px] text-blue-700 font-semibold">Ranking στο ρόλο</div>
                <div className="text-[10px] text-blue-400">από {groupSize} εργαζομένους</div>
              </div>
            </div>
          )}
          {(stats.streakAbove > 0 || stats.streakBelow > 0) && (
            <div className={`rounded-lg p-2.5 text-[11px] font-medium ${stats.streakAbove > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {stats.streakAbove > 0 ? `🔥 Πάνω από στόχο ${stats.streakAbove} συνεχόμενες ημέρες` : `⚠️ Κάτω από στόχο ${stats.streakBelow} συνεχόμενες ημέρες`}
            </div>
          )}
          {chartData.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1.5">UPH Ανά Ημέρα (τελευταίες {chartData.length})</div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={chartData} barSize={12} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 7, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <RTooltip content={({ active, payload }) => active && payload?.length ? (
                    <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow">{payload[0].payload.day}: {payload[0].value} o/h</div>
                  ) : null} />
                  <Bar dataKey="uph">
                    {chartData.map((d, i) => <Cell key={i} fill={d.uph >= stats.target ? '#22c55e' : d.uph >= stats.target * 0.9 ? '#f59e0b' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Μέσες Παρ./Ημέρα</div>
              <div className="text-sm font-bold text-slate-700 mt-0.5">{avgOrders != null ? `${avgOrders} orders` : '—'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">Καλύτερη Ημέρα</div>
              <div className="text-sm font-bold text-slate-700 mt-0.5">{bestUPH != null ? `${bestUPH.toFixed(0)} o/h` : '—'}</div>
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
            <div className="text-[9px] text-slate-400 uppercase font-semibold mb-1.5">Skill Level</div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full ${parseInt(emp.skill_level) > i ? 'bg-blue-500' : 'bg-slate-200'}`} />
              ))}
              <span className="text-xs font-bold text-slate-600 ml-1">{emp.skill_level}/5</span>
            </div>
          </div>
          <button onClick={onNavigate}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-blue-200 text-blue-600 text-xs font-semibold hover:bg-blue-50 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
            Πλήρες Προφίλ & Ιστορικό
          </button>
        </div>
      </div>
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function EmployeeListPage() {
  const navigate  = useNavigate()
  const employees = useAppStore(s => s.employees)
  const { prodSnap, allMetrics, loading } = useProductivityData()

  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState<'all'|'above'|'near'|'below'>('all')
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null)
  const [collapsed,   setCollapsed]   = useState<Record<string, boolean>>({})
  const [tableSort,   setTableSort]   = useState<{ col: string; dir: 'asc'|'desc' }>({ col: 'liveUPH', dir: 'desc' })

  const empStatMap = useMemo(() => {
    const map = new Map<string, EmpStats>()
    for (const emp of employees) {
      const metrics = allMetrics.find(m => m.employee.id === emp.id)
      map.set(emp.id, computeStats(emp, metrics, prodSnap))
    }
    return map
  }, [employees, allMetrics, prodSnap])

  const groupInfos: GroupInfo[] = useMemo(() =>
    ROLE_GROUPS.map(g => {
      const groupRole = g.roles[0]
      const emps = employees.filter(e => g.roles.some(r =>
        r === e.primary_role || r === (e as any).secondary_role || r === (e as any).tertiary_role))
      const getMetrics = (e: Employee) => allMetrics.find(m => m.employee.id === e.id)
      const withData = emps
        .map(e => ({ emp: e, stats: computeStats(e, getMetrics(e), prodSnap, groupRole) }))
        .filter(x => x.stats.liveUPH != null)
      const avgUPH = withData.length > 0 ? Math.round(withData.reduce((s, x) => s + (x.stats.liveUPH ?? 0), 0) / withData.length) : null
      const target = ROLE_TARGETS[groupRole] ?? 70
      const gapPct = avgUPH != null ? Math.round((avgUPH - target) / target * 100) : null
      return {
        label: g.label, color: g.color, role: groupRole, employees: emps, withData, avgUPH, target, gapPct,
        above:  withData.filter(x => x.stats.status === 'above').length,
        near:   withData.filter(x => x.stats.status === 'near').length,
        below:  withData.filter(x => x.stats.status === 'below').length,
        noData: emps.filter(e => e.primary_role === groupRole).length - withData.filter(x => x.emp.primary_role === groupRole).length,
      }
    }), [employees, allMetrics, prodSnap])

  const allWithStats = useMemo(() => employees.map(e => ({ emp: e, stats: empStatMap.get(e.id)! })), [employees, empStatMap])
  const alerts       = useMemo(() => computeAlerts(groupInfos, allWithStats), [groupInfos, allWithStats])

  const selectedStats   = selectedEmp ? empStatMap.get(selectedEmp.id)                           : null
  const selectedMetrics = selectedEmp ? allMetrics.find(m => m.employee.id === selectedEmp.id)  : null

  const selectedRank = useMemo(() => {
    if (!selectedEmp || !selectedStats?.liveUPH) return { rank: 0, groupSize: 0 }
    const group  = groupInfos.find(g => g.employees.some(e => e.id === selectedEmp.id))
    if (!group) return { rank: 0, groupSize: 0 }
    const sorted = [...group.withData].sort((a, b) => (b.stats.liveUPH ?? 0) - (a.stats.liveUPH ?? 0))
    return { rank: sorted.findIndex(x => x.emp.id === selectedEmp.id) + 1, groupSize: group.withData.length }
  }, [selectedEmp, selectedStats, groupInfos])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-slate-400 text-sm animate-pulse">Φόρτωση δεδομένων...</div>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-slate-800 leading-tight">Shift Management</h1>
          <p className="text-[11px] text-slate-400">Operations Control Center · Παραγωγικότητα Βάρδιας</p>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Αναζήτηση εργαζομένου..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 w-48" />
        </div>
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
          {(['all','above','near','below'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${filter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f === 'all' ? 'Όλοι' : f === 'above' ? '🟢 Πάνω' : f === 'near' ? '🟡 Κοντά' : '🔴 Κάτω'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {groupInfos.map(g => {
            const isCollapsed = !!collapsed[g.label]

            let visible = g.withData.filter(({ emp, stats }) => {
              const ms = !search || emp.full_name.toLowerCase().includes(search.toLowerCase())
              const mf = filter === 'all' || (stats?.status ?? 'none') === filter
              return ms && mf
            })
            visible = [...visible].sort((a, b) => {
              const dir = tableSort.dir === 'asc' ? 1 : -1
              switch (tableSort.col) {
                case 'name':    return dir * a.emp.full_name.localeCompare(b.emp.full_name)
                case 'liveUPH': return dir * ((a.stats.liveUPH ?? -1) - (b.stats.liveUPH ?? -1))
                case 'gap':     return dir * ((a.stats.gap ?? -9999) - (b.stats.gap ?? -9999))
                case 'trend':   return dir * ((a.stats.trendPct ?? -9999) - (b.stats.trendPct ?? -9999))
                case 'achieve': return dir * ((a.stats.achievePct ?? -1) - (b.stats.achievePct ?? -1))
                default: return 0
              }
            })
            if (filter !== 'all' && visible.length === 0) return null

            const histCfg: HistTableConfig | null =
              g.label === 'OPERATORS' ? {
                data: OPERATOR_HISTORY, label: 'Ιστορικό Operators', target: 180, barMax: 300, rowLabel: 'Χειριστής',
                accentBg: 'bg-amber-50', accentBorder: 'border-amber-100', accentText: 'text-amber-800', accentSub: 'text-amber-600',
                footerBg: 'bg-amber-50', footerBorder: 'border-amber-200', footerText: 'text-amber-900',
              } : g.label === 'PACKERS' ? {
                data: PACKER_HISTORY, label: 'Ιστορικό Packers', target: 75, barMax: 200, rowLabel: 'Packer',
                accentBg: 'bg-emerald-50', accentBorder: 'border-emerald-100', accentText: 'text-emerald-800', accentSub: 'text-emerald-600',
                footerBg: 'bg-emerald-50', footerBorder: 'border-emerald-200', footerText: 'text-emerald-900',
              } : g.label === 'PICKERS (ΡΑΦΙ)' ? {
                data: PICKER_HISTORY, label: 'Ιστορικό Pickers', target: 80, barMax: 200, rowLabel: 'Picker',
                accentBg: 'bg-blue-50', accentBorder: 'border-blue-100', accentText: 'text-blue-800', accentSub: 'text-blue-600',
                footerBg: 'bg-blue-50', footerBorder: 'border-blue-200', footerText: 'text-blue-900',
              } : null

            function SortTh({ col, label, center = true }: { col: string; label: string; center?: boolean }) {
              const active = tableSort.col === col
              return (
                <th onClick={() => setTableSort(p => p.col === col ? { col, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100 cursor-pointer select-none whitespace-nowrap transition-colors ${center ? 'text-center' : 'text-left'} ${active ? 'text-blue-500' : 'text-slate-400 hover:text-slate-600'}`}>
                  <span className={`inline-flex items-center gap-1 ${center ? 'justify-center' : ''}`}>
                    {label}
                    {active ? (tableSort.dir === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </span>
                </th>
              )
            }

            return (
              <div key={g.label}>
                <GroupHeader g={g} collapsed={isCollapsed}
                  onToggle={() => setCollapsed(p => ({ ...p, [g.label]: !p[g.label] }))} />
                {!isCollapsed && (
                  <>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-white">
                          <SortTh col="name"    label="Εργαζόμενος" center={false} />
                          <SortTh col="liveUPH" label="Live UPH" />
                          <th className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-b border-slate-100">Στόχος</th>
                          <SortTh col="gap"     label="Gap" />
                          <SortTh col="trend"   label="Trend" />
                          <SortTh col="achieve" label="Ημέρες / Στόχο" />
                          <th className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center border-b border-slate-100">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.length === 0 ? (
                          <tr><td colSpan={7} className="px-4 py-4 text-xs text-slate-400 text-center italic">Κανένας εργαζόμενος αντιστοιχεί στο φίλτρο</td></tr>
                        ) : visible.map(({ emp, stats }) => (
                          <EmpRow key={emp.id} emp={emp} stats={stats} groupRole={g.role}
                            isSelected={selectedEmp?.id === emp.id}
                            onClick={() => setSelectedEmp(p => p?.id === emp.id ? null : emp)} />
                        ))}
                      </tbody>
                    </table>
                    {histCfg && <HistoricalStatsTable cfg={histCfg} />}

                  </>
                )}
              </div>
            )
          })}
        </div>

        <div className="w-56 flex-shrink-0 bg-white border-l border-slate-200 overflow-y-auto">
          <RightPanel alerts={alerts} />
        </div>
      </div>

      {selectedEmp && selectedStats && (
        <EmployeeDrawer emp={selectedEmp} stats={selectedStats} metrics={selectedMetrics}
          rank={selectedRank.rank} groupSize={selectedRank.groupSize}
          onClose={() => setSelectedEmp(null)}
          onNavigate={() => navigate(`/team/employees/${selectedEmp.id}`)} />
      )}
    </div>
  )
}
