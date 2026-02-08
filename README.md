# Course Planner

An open-source web application for course planning, skill coverage tracking, and assessment management. Built for higher education instructors teaching technical courses.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (or Podman) for PostgreSQL
- npm

### Setup

```bash
# 1. Start the database
docker compose up -d

# 2. Install dependencies
npm install

# 3. Generate Prisma client & push schema
npx prisma generate
npx prisma db push

# 4. Seed demo data (2 instructors, sample term with modules/sessions/skills)
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://courseplanner:courseplanner@localhost:5432/courseplanner` | PostgreSQL connection string |
| `OPENAI_API_KEY` | *(not set)* | Future: OpenAI API key |
| `ANTHROPIC_API_KEY` | *(not set)* | Future: Anthropic API key |

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run unit/integration tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |
| `npm run format` | Prettier formatting |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Reset database |

## Features (MVP)

- **Terms**: Create/edit/delete/clone semester instances
- **Modules**: Organize content into thematic units within a term
- **Sessions**: Manage lectures and labs with dates, descriptions, formats
- **Skills**: Define assessable competencies (global or term-specific)
- **Coverage Matrix**: View skills x sessions grid with I/P/A indicators
- **Assessments**: Create assignments, GAIEs, exams, projects linked to skills
- **Impact Analysis**: Validate coverage ordering, detect orphan skills, GAIE progression
- **Term Cloning**: Deep-copy a term's structure to a new semester
- **Move Session**: Reschedule sessions with immediate impact feedback
- **Artifact Export**: Stub interface for notebook/handout/slides generation
- **Multi-tenant**: Instructor-scoped data (2 demo instructors)

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS
- **Database**: PostgreSQL via Docker
- **ORM**: Prisma 6
- **Validation**: Zod
- **Testing**: Vitest (25 unit tests)
- **Services**: Ports-and-adapters pattern with mock implementations

## Documentation

- [ASSUMPTIONS.md](ASSUMPTIONS.md) — Design decisions and defaults
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and directory structure
- [TESTING.md](TESTING.md) — Test organization and commands
- [ROADMAP.md](ROADMAP.md) — Future features beyond MVP

## License

GPL — see [LICENSE](LICENSE).
