# Testing

## Test Runner

- **Unit/Integration**: [Vitest](https://vitest.dev/) v4
- **Config**: `vitest.config.ts`

## Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npx vitest run --coverage

# Run a specific test file
npx vitest run src/domain/coverage-rules.test.ts
```

## Test Organization

### Domain Rules (`src/domain/coverage-rules.test.ts`)
17 tests covering:

- **validateSkillCoverageOrder**: Correct I→P→A ordering, error on wrong order, same-session multi-level
- **validateAllCoverageOrdering**: Multi-skill validation in one pass
- **findOrphanSkills**: Skills with no coverage entries
- **findUnassessedSkills**: Skills never assessed
- **validateGAIEProgression**: copy-paste → modify → write-own ordering
- **computeMoveImpact**: Affected skills and new violations when a session moves

### Service Mocks (`src/services/mocks/`)

**MockAiPlanner** (3 tests):
- Returns redistribution suggestions
- Returns coverage analysis
- Returns chat responses

**MockArtifactExporter** (5 tests):
- Exports module overview (markdown)
- Exports session description (markdown)
- Exports term summary (markdown)
- Generates notebook skeleton (valid .ipynb)
- Exports skills list (markdown)

## Test Philosophy

- **Domain rules are pure functions** — no database, no network, fast
- **Service mocks verify the contract** — ensure mock implementations match interfaces
- **API routes tested via integration** with the dev server and seed data
- **TDD cadence**: Tests written first (or alongside) for domain logic

## Future Testing

- **E2E (Playwright)**: Smoke test for create term → add module → add session → add coverage → verify matrix
- **API route tests**: Using Next.js test server for endpoint-level testing
- **CI pipeline**: GitHub Actions running `npm run typecheck && npm test`
