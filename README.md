# Warehouse Copilot MVP

Real-time workforce allocation system for warehouse supervisors. Built with React, TypeScript, Tailwind CSS, Supabase, and Vercel.

---

## Features

- **Live Dashboard** — Role allocation table with Pressure Ratio and Time-to-Empty per queue
- **Ops Snapshot** — Manual entry of live workload (pending picking/packing/sorting, remaining SLA orders)
- **Allocation Engine** — 10-step algorithm combining workforce capacity + live workload
- **Team Management** — Employee status board, break requests, sick/vacation tracking
- **Schedule** — Weekly shift view with Excel import
- **Daily Forecast** — Order volume input driving staffing requirements
- **AI Copilot** — Claude-powered chat with full warehouse context

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd warehouse-copilot
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL** and **anon public key** from Settings → API

### 3. Run database migrations

In the Supabase SQL Editor, run both files **in order**:

```
supabase/migrations/001_schema.sql   ← schema, tables, RLS
supabase/migrations/002_seed.sql     ← 30 demo employees + today's data
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 5. Set up the AI Copilot Edge Function

The AI Copilot routes through a Supabase Edge Function to keep the Anthropic API key server-side.

**Install Supabase CLI:**
```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
```

**Deploy the function:**
```bash
supabase functions deploy copilot
```

**Set the API key secret:**
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
warehouse-copilot/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── AllocationTable.tsx     ← Role capacity table with pressure/TTE
│   │   │   ├── BreakRequestsPanel.tsx  ← Pending breaks with safety gate
│   │   │   ├── OpsSnapshotPanel.tsx    ← Sidebar queue/SLA panel
│   │   │   └── SuggestionBar.tsx       ← Algorithm reallocation suggestions
│   │   ├── layout/
│   │   │   ├── DataLoader.tsx          ← Mounts all global data hooks
│   │   │   └── Layout.tsx              ← Sidebar navigation
│   │   ├── team/
│   │   │   └── EmployeeModal.tsx       ← Add/edit/delete employee
│   │   └── ui/
│   │       ├── AlertItem.tsx           ← Alert banner + list
│   │       ├── Badge.tsx               ← Role, status, pressure badges
│   │       ├── PageHeader.tsx          ← Consistent page headers
│   │       └── StatCard.tsx            ← KPI stat cards
│   ├── hooks/
│   │   └── index.ts                    ← All Supabase data hooks + realtime
│   ├── lib/
│   │   ├── engine.ts                   ← Allocation algorithm v1.1 (10 steps)
│   │   ├── supabase.ts                 ← Supabase client
│   │   └── utils.ts                    ← cn(), formatTime(), etc.
│   ├── pages/
│   │   ├── CopilotPage.tsx             ← AI chat interface
│   │   ├── DashboardPage.tsx           ← Main live operations view
│   │   ├── ForecastPage.tsx            ← Daily order forecast input
│   │   ├── OpsSnapshotPage.tsx         ← Live workload entry screen
│   │   ├── SchedulePage.tsx            ← Weekly schedule + Excel import
│   │   └── TeamPage.tsx                ← Employee status board
│   ├── store/
│   │   └── index.ts                    ← Zustand global state
│   ├── types/
│   │   └── index.ts                    ← All TS interfaces + constants
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── supabase/
│   ├── functions/
│   │   └── copilot/
│   │       └── index.ts                ← Edge Function: AI proxy
│   └── migrations/
│       ├── 001_schema.sql              ← Full DB schema (11 tables)
│       └── 002_seed.sql                ← Demo data (30 employees)
├── .env.example
├── vercel.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Database Tables

| Table | Description |
|---|---|
| `warehouses` | Tenant table — one row per warehouse |
| `employees` | All employees with roles, skill levels, status |
| `employee_productivity` | Units/hour per employee per role |
| `shifts` | Weekly schedule (importable from Excel) |
| `daily_forecasts` | Morning order volume forecast |
| **`ops_snapshots`** | **Live workload entry (new in v1.1)** |
| `workforce_allocations` | Reallocation log (algorithm output) |
| `break_requests` | Break approval workflow |
| `sla_snapshots` | Algorithm output audit log |
| `alerts` | Live alert feed |
| `ai_conversations` | Copilot chat history |

---

## Allocation Algorithm (v1.1 — 10 Steps)

| Step | Description |
|---|---|
| 1 | Collect workforce state (capacity per role via skill multipliers) |
| 2 | Load ops snapshot (with stale fallback to forecast) |
| 3 | Map queue depths to roles; derive Transporter demand |
| 4 | **Compute Pressure Ratio** = queue ÷ effective_capacity_per_hour |
| 5 | **Compute Time-to-Empty** per queue in minutes |
| 6 | Identify bottleneck (highest adjusted pressure, not just headcount gap) |
| 7 | Build reallocation plan (pressure-aware greedy, respects min coverage) |
| 8 | Compute SLA risk scores (dual-signal: time buffer + pressure) |
| 9 | Break safety gate (pressure-aware, not just headcount check) |
| 10 | Persist, cache to Redis keys, broadcast via WebSocket |

**Key thresholds:**
- Pressure < 0.5× → Surplus (candidate for redeployment)
- Pressure 0.5–1.0× → OK
- Pressure 1.0–1.5× → Risk
- Pressure > 1.5× → Critical (triggers suggestion)
- Pressure > 2.0× → Break blocked pending supervisor review

---

## Deploying to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow prompts. Then set environment variables:

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

### Option B: Vercel Dashboard

1. Push to GitHub
2. Import repo at [vercel.com/new](https://vercel.com/new)
3. Framework preset: **Vite**
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy

The `vercel.json` in the root handles SPA routing (all paths → `index.html`).

---

## SLA Windows

| Day | Due Date | Same Day | Intraday |
|---|---|---|---|
| Mon–Fri | 19:00 | 13:00 | 24:00 |
| Saturday | 15:00 | — | — |
| Sunday | 17:00 | — | 24:00 |

---

## Roles

| Code | Role | Queue-Driven | Min Coverage |
|---|---|---|---|
| OP | Operator | No (AutoStore) | 1 |
| PK | Picker | Yes | 3 |
| PA | Packer | Yes (critical path) | 4 |
| VA | Validator | No | 1 |
| SO | Sorter | Yes | 1 |
| TR | Transporter | Derived | 2 |

---

## Skill Multipliers

| Level | Label | Throughput Multiplier |
|---|---|---|
| 1 | Trainee | 0.6× |
| 2 | Junior | 0.8× |
| 3 | Standard | 1.0× |
| 4 | Senior | 1.2× |
| 5 | Expert | 1.5× |

---

## v2 Roadmap

- Multi-tenant auth (Supabase Auth + per-warehouse RLS)
- Real-time WebSocket pressure broadcast (Supabase Realtime channels)
- Historical analytics dashboard (recharts)
- Mobile supervisor app (React Native)
- Productivity auto-tracking (WMS integration)
- Shift optimizer (ML-based staffing recommendations)
