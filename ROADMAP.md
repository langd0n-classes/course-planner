# Roadmap

## Completed (MVP)

- [x] Data model: Term, Module, Skill, Session, Coverage, Assessment, Artifact, Instructor
- [x] CRUD API routes for all entities
- [x] Domain rules: coverage ordering, GAIE progression, orphan detection
- [x] Coverage matrix view with filters
- [x] Impact/validation report
- [x] Term cloning with deep copy
- [x] Session move with impact feedback
- [x] Assessment management with skill linking
- [x] Skills browser with categories
- [x] Service interfaces (AiPlanner, ArtifactExporter) with mocks
- [x] Seed data: 2 instructors, 12 skills, 2 terms
- [x] 25 unit tests passing
- [x] Multi-tenant data model

## Next Phase: Calendar & Polish

- [ ] **Calendar display view**: Weekly grid showing sessions by date, color-coded by module, with lecture/lab numbers
- [ ] **Drag-and-drop session scheduling**: Move sessions on the calendar
- [ ] **Session cancel action**: Mark session as canceled, trigger AI redistribution suggestion
- [ ] **Inline editing**: Edit session details without leaving the term page
- [ ] **Better empty states**: Guided onboarding for first-time use
- [ ] **Error handling**: Toast notifications, form validation feedback

## Phase 3: AI Integration

- [ ] **OpenAI adapter**: Real implementation of `AiPlanner` using GPT-4
- [ ] **Anthropic adapter**: Real implementation using Claude
- [ ] **Redistribution suggestions**: When a session is moved/canceled
- [ ] **Coverage gap analysis**: AI-powered review of the coverage matrix
- [ ] **Pedagogy chat**: Contextual conversation about course design
- [ ] **Content review**: AI checks session descriptions against pedagogical principles

## Phase 4: Exports & Artifacts

- [ ] **Markdown export**: Module overview, session descriptions, term summary
- [ ] **Notebook generation**: Otter-Grader compatible `.ipynb` from assessment definitions
- [ ] **LaTeX/PDF export**: Printable calendars, answer sheets, handouts
- [ ] **LMS export**: Blackboard and Canvas import packages
- [ ] **iCal feed**: Session calendar events
- [ ] **JSON/CSV dump**: Full term data backup

## Phase 5: History & Search

- [ ] **Cross-term search**: Find sessions mentioning a topic across all terms
- [ ] **Prior art linking UI**: One-click link to similar sessions from past terms
- [ ] **Term comparison**: Side-by-side diff of two terms
- [ ] **Skill evolution timeline**: How a skill's coverage changed across terms
- [ ] **Audit log**: Track all changes with timestamps

## Phase 6: Authentication & Collaboration

- [ ] **User authentication**: Login system (OAuth or email/password)
- [ ] **Role-based access**: Instructor, TA, viewer roles
- [ ] **Real-time collaboration**: Multiple users editing simultaneously
- [ ] **Comments/annotations**: Discussion on sessions and assessments

## Phase 7: Advanced Features

- [ ] **Preflight validation**: One-click "pre-semester check"
- [ ] **CSV import**: Bulk import skills and sessions from spreadsheets
- [ ] **SQLite option**: Lightweight local-only deployment
- [ ] **Mobile-responsive views**: Read-only mobile interface
- [ ] **Keyboard shortcuts**: Power-user navigation
- [ ] **API documentation**: OpenAPI/Swagger spec
