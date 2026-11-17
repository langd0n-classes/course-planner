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

# 4. Add the demo instructor, courses, and terms (one past, the current, and the next)
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Local Development

### Path A: Full stack (recommended for first run)

```bash
cp .env.example .env
# edit .env with your values
podman compose up        # or: docker compose up
# app is at http://localhost:3000
```

### Path B: DB only + hot reload (for active development)

```bash
cp .env.example .env.local
# edit .env.local — set DATABASE_URL to point at local/containerized DB
podman compose up db     # or: docker compose up db
npm install
npm run dev              # hot-reload dev server at http://localhost:3000
```

`podman compose` requires Podman 4.x+. On older systems, use
`podman-compose` (`pip install podman-compose`).

### Environment Variables

Compose users should copy `.env.example` to `.env`. For local Next.js
development, `.env.local.example` mirrors the overlapping app/auth
variables for `.env.local`.

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `courseplanner` | PostgreSQL username for the `db` service |
| `POSTGRES_PASSWORD` | `courseplanner` | PostgreSQL password for the `db` service |
| `POSTGRES_DB` | `courseplanner` | PostgreSQL database name for the `db` service |
| `DATABASE_URL` | `postgresql://courseplanner:courseplanner@db:5432/courseplanner?schema=public` | App database connection string in the compose network |
| `AUTH_SECRET` | *(not set)* | Auth secret; generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | *(not set)* | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | *(not set)* | Google OAuth client secret |
| `NEXTAUTH_URL` | `http://localhost:3000` | Public app URL for auth callbacks |
| `ALLOWED_EMAIL` | *(not set)* | Comma-separated allowed sign-in emails; checked at sign-in and on every session read |
| `COURSE_PLANNER_PREVIEW_AUTH` | `false` | Enables review login when `VERCEL_ENV=preview`; scope this to a protected preview branch |
| `COURSE_PLANNER_PREVIEW_EMAIL` | *(not set)* | Instructor email used by preview login; provisioned at the first authenticated request |
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
| `npm run db:seed` | Add missing demo rows; safe to rerun |
| `npm run db:seed -- --force` | Wipe all application data, then reseed the demo |
| `npm run db:reset` | Reset database |
| `npm run test:seed` | Check seed behavior against a dedicated test database |

The default seed uses stable demo identifiers. Re-running it preserves existing rows and instructor changes. It gives the exemplar course the Terms that are current and next on the day it runs, so a run in a later semester adds the Terms that are then missing. Set `SEED_INSTRUCTOR_EMAIL` and optionally `SEED_INSTRUCTOR_NAME` before the first run to match the sign-in account. Use `npm run db:seed -- --force` only when you intend to delete **all** application data. To run the database checks, create an empty dedicated database named `cp15`, apply migrations, then set `SEED_TEST_DATABASE_URL` to its connection URL and run `npm run test:seed`. The check wipes that database.

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

- [docs/assumptions/](docs/assumptions/) — Design decisions and defaults, one file for each change
- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture and directory structure
- [TESTING.md](TESTING.md) — Test organization and commands
- [ROADMAP.md](ROADMAP.md) — Future features beyond MVP

## License

GPL — see [LICENSE](LICENSE).
