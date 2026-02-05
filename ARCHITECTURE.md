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
│   │   │       └── impact/
│   │   ├── modules/
│   │   ├── skills/
│   │   ├── sessions/
│   │   │   └── [id]/move/
│   │   ├── coverages/
│   │   ├── assessments/
│   │   └── artifacts/
│   │       └── export/
│   ├── terms/              # Term pages
│   │   └── [id]/
│   │       ├── coverage/
│   │       ├── impact/
│   │       └── assessments/
│   ├── skills/             # Skills browser
│   ├── layout.tsx          # Root layout with nav
│   └── page.tsx            # Homepage
├── domain/                 # Pure domain logic
│   ├── coverage-rules.ts   # Coverage ordering, GAIE progression, impact
│   └── coverage-rules.test.ts
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
└── components/             # Shared UI components (future)

prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Demo data seeder
```

## Data Model

```
Instructor ──< Term ──< Module ──< Session ──< Coverage >── Skill
                │                                              │
                └──< Assessment >── AssessmentSkill >──────────┘
                         │
                         └──< Artifact
```

### Key Relationships
- **Term** belongs to an **Instructor** (multi-tenant)
- **Module** belongs to a **Term**, contains **Sessions**
- **Session** belongs to a **Module**, has **Coverage** entries
- **Coverage** links a **Session** to a **Skill** with a level (I/P/A)
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

Implemented as pure functions in `src/domain/coverage-rules.ts`:

1. **Coverage ordering**: Introduced before Practiced before Assessed
2. **GAIE progression**: copy-paste → modify → write-own
3. **Orphan detection**: Skills with no coverage
4. **Unassessed detection**: Skills with no assessment
5. **Impact analysis**: Compute affected skills when a session moves
