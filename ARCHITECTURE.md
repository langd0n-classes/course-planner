# Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────┐
│              Next.js App Router              │
│  ┌─────────────┐   ┌────────────────────┐   │
│  │  Pages (UI)  │   │  API Routes (/api) │   │
│  │  - terms     │   │  - CRUD endpoints  │   │
│  │  - skills    │   │  - clone, move     │   │
│  │  - coverage  │   │  - impact, export  │   │
│  │  - impact    │   │                    │   │
│  └──────┬───────┘   └────────┬───────────┘   │
│         │  fetch()           │               │
│         └───────────┬────────┘               │
│                     │                        │
│         ┌───────────▼───────────┐            │
│         │    Domain Rules       │            │
│         │  (pure functions)     │            │
│         │  - coverage ordering  │            │
│         │  - GAIE progression   │            │
│         │  - impact analysis    │            │
│         └───────────┬───────────┘            │
│                     │                        │
│         ┌───────────▼───────────┐            │
│         │   Service Interfaces  │            │
│         │  - AiPlanner          │            │
│         │  - ArtifactExporter   │            │
│         └───────────┬───────────┘            │
│                   ┌─┴─┐                      │
│                ┌──┘   └──┐                   │
│         ┌──────▼──┐  ┌───▼──────┐            │
│         │  Mocks  │  │  Real*   │            │
│         │ (tests) │  │ (future) │            │
│         └─────────┘  └──────────┘            │
│                     │                        │
│         ┌───────────▼───────────┐            │
│         │   Prisma ORM          │            │
│         └───────────┬───────────┘            │
└─────────────────────┼────────────────────────┘
                      │
              ┌───────▼───────┐
              │  PostgreSQL   │
              │  (Docker)     │
              └───────────────┘
```

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (REST endpoints)
│   │   ├── instructors/
│   │   ├── terms/
│   │   │   └── [id]/
│   │   │       ├── clone/
│   │   │       ├── impact/
│   │   │       ├── calendar-slots/
│   │   │       ├── import-calendar/
│   │   │       ├── import-structure/
│   │   │       ├── import-skills-csv/
│   │   │       └── whatif-compare/
│   │   ├── modules/
│   │   ├── skills/
│   │   ├── sessions/
│   │   │   └── [id]/
│   │   │       ├── move/
│   │   │       ├── cancel/
│   │   │       └── whatif/
│   │   ├── coverages/
│   │   ├── assessments/
│   │   ├── ai/
│   │   │   └── suggest-redistribution/
│   │   └── artifacts/
│   │       └── export/
│   ├── terms/              # Term pages
│   │   └── [id]/
│   │       ├── coverage/        # Coverage matrix
│   │       ├── impact/          # Validation report
│   │       ├── assessments/     # Assessment management
│   │       ├── calendar/        # Weekly calendar view
│   │       ├── import/          # Data import page
│   │       ├── modules/[moduleId]/  # Module detail view
│   │       ├── sessions/[sessionId]/ # Session detail view
│   │       └── skills/[skillId]/    # Skill detail view
│   ├── skills/             # Skills browser
│   ├── layout.tsx          # Root layout with nav + ToastProvider
│   └── page.tsx            # Homepage
├── domain/                 # Pure domain logic
│   ├── coverage-rules.ts   # Coverage ordering, GAIE progression, impact
│   ├── coverage-rules.test.ts
│   ├── coverage-matrix.ts  # Matrix assembly, health bar, gap filtering
│   ├── coverage-matrix.test.ts
│   ├── whatif.ts            # What-if cancellation simulation
│   └── whatif.test.ts
├── lib/                    # Shared utilities
│   ├── prisma.ts           # Prisma client singleton
│   ├── schemas.ts          # Zod validation schemas
│   ├── api-helpers.ts      # Response helpers
│   └── api-client.ts       # Client-side fetch wrapper
├── services/               # Ports and adapters
│   ├── interfaces/
│   │   ├── ai-planner.ts
│   │   └── artifact-exporter.ts
│   ├── mocks/
│   │   ├── mock-ai-planner.ts
│   │   ├── mock-ai-planner.test.ts
│   │   ├── mock-artifact-exporter.ts
│   │   └── mock-artifact-exporter.test.ts
│   ├── real/               # Future: real implementations
│   └── index.ts            # Service registry
├── components/             # Shared UI components
│   ├── WhatIfPanel.tsx     # What-if analysis + redistribution workflow
│   ├── Breadcrumbs.tsx     # Navigation breadcrumbs
│   ├── CoverageBadge.tsx   # I/P/A level badges with click actions
│   ├── EditableText.tsx    # Inline-editable text/textarea
│   ├── LoadingSkeleton.tsx # Loading states (card, table, lines)
│   ├── Providers.tsx       # Client-side context providers wrapper
│   ├── StatusBadge.tsx     # Session type/status, assessment type badges
│   └── Toast.tsx           # Toast notifications (context + provider)

prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Demo data seeder
```

## Data Model

```
Instructor ──< Term ──< Module ──< Session ──< Coverage >── Skill
                │         │                                    │
                │         └──< CalendarSlot                    │
                └──< Assessment >── AssessmentSkill >──────────┘
                         │
                         └──< Artifact
```

### Key Relationships
- **Term** belongs to an **Instructor** (multi-tenant)
- **Module** belongs to a **Term**, contains **Sessions**
- **Session** belongs to a **Module**, has **Coverage** entries, has a `status` (scheduled/canceled/moved)
- **Coverage** links a **Session** to a **Skill** with a level (I/P/A); may have `redistributedFrom` pointing to canceled session
- **CalendarSlot** belongs to a **Term**, represents a date+type (class_day/holiday/finals/break)
- **Assessment** belongs to a **Term**, links to **Skills** via join table
- **Artifact** has a polymorphic parent (session, assessment, or module)
- **Term** can be cloned from another term (`cloned_from_id`)

## Service Interfaces

### AiPlanner
- `suggestRedistribution()` — When a session is canceled/moved
- `analyzeCoverage()` — Identify gaps in the coverage matrix
- `chat()` — Contextual pedagogy consultation

### ArtifactExporter
- `exportModuleOverview()` — Markdown module summary
- `exportSessionDescription()` — Markdown session details
- `exportTermSummary()` — Full term markdown export
- `generateNotebookSkeleton()` — Jupyter notebook for assessments
- `exportSkillsList()` — Skills by category

Both interfaces have mock implementations for development/testing and are registered in `src/services/index.ts`. Real implementations (OpenAI, Anthropic) can be swapped in via environment variables.

## Domain Rules (Invariants)

Implemented as pure functions in `src/domain/coverage-rules.ts` and `src/domain/whatif.ts`:

### Coverage Rules (`coverage-rules.ts`)
1. **Coverage ordering**: Introduced before Practiced before Assessed
2. **GAIE progression**: copy-paste → modify → write-own
3. **Orphan detection**: Skills with no coverage
4. **Unassessed detection**: Skills with no assessment
5. **Impact analysis**: Compute affected skills when a session moves

### What-If Simulation (`whatif.ts`)
1. **simulateCancellation**: Pure function returning impact (at-risk skills, health diff, new violations)
2. **compareScenarios**: Side-by-side comparison of canceling two sessions
3. **validateRedistribution**: Check that redistributed coverages maintain I→P→A ordering
4. **computeCoverageHealth**: Summary of coverage state (introduced/practiced/assessed/fully covered counts)

## Import Subsystem

API routes for importing course data:
- `POST /api/terms/[id]/import-calendar` — Upsert CalendarSlots with date range validation
- `POST /api/terms/[id]/import-structure` — Transactional import of modules, sessions, skills, coverages, assessments
- `POST /api/terms/[id]/import-skills-csv` — CSV upload for skills (code, category, description)
- `GET /api/terms/[id]/calendar-slots` — Fetch calendar slots ordered by date

Seed script: `scripts/generate-ds100-exemplar.ts` generates `ds100-calendar.json` and `ds100-structure.json` from the exemplar files.

## Cancellation Workflow

- `POST /api/sessions/[id]/cancel` — Cancel session with optional redistribution; supports `dryRun: true` for validation without persistence
- `GET /api/sessions/[id]/whatif` — Simulate cancellation impact (read-only)
- `GET /api/terms/[id]/whatif-compare` — Compare two cancellation scenarios
- `POST /api/ai/suggest-redistribution` — Mock AI suggestions for skill redistribution targets

### Redistribution Flow (Phase 2A.3)

The what-if panel (`WhatIfPanel.tsx`) now supports a multi-step cancellation workflow:
1. **Impact** — See coverage health diff, at-risk skills, ordering violations
2. **Redistribute** — Assign at-risk skills to other sessions via dropdowns; optionally use AI suggestions
3. **Validate** — Dry-run validation against coverage ordering rules
4. **Confirm** — Apply cancellation with redistributions, or skip redistribution

The panel is shared between the calendar view and the term detail page.

## Content Views (Phase 2B.1)

### Coverage Matrix (`/terms/[id]/coverage`)
Uses domain logic from `coverage-matrix.ts` for matrix assembly, health computation, and gap filtering. Shows ALL skills as rows with session columns. Health summary bar at top with visual progress. Clickable empty cells for adding coverage.

### Module Detail (`/terms/[id]/modules/[moduleId]`)
Full module view with editable learning objectives, planning notes, session list with inline-editable descriptions, and skills summary table. Uses `EditableText` component for inline editing.

### Session Detail (`/terms/[id]/sessions/[sessionId]`)
Session view with editable description/notes, coverage entries, redistribution audit trail, linked assessments, and what-if panel integration. Shows canceled session info prominently.

### Skill Detail (`/terms/[id]/skills/[skillId]`)
Skill view with coverage status (I/P/A indicators), timeline visualization showing all coverage entries chronologically, and linked assessments.

### Domain Logic (`coverage-matrix.ts`)
Pure functions for matrix assembly:
- `assembleCoverageMatrix()` — build full matrix from skills, sessions, coverages
- `computeHealthBar()` — count fully/partially/uncovered skills
- `filterMatrixRows()` — filter by "all", "gaps", or "at_risk"

## E2E Testing

Playwright E2E tests live in `e2e/`. Config: `playwright.config.ts`. Run with `npm run e2e`.
