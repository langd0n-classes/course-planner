# Course Planner: Technical Requirements Document

**Purpose:** Technical specification for an open-source, AI-integrated
course planning system. Intended to be used alongside
`course-planner-research-brief.md` for architecture and implementation.

**License intent:** Open source (likely AGPL or similar copyleft to
encourage contributions while preventing proprietary forks).

---

## 1. System Overview

### 1.1 What it is
A web application that serves as the single source of truth for course
structure, replacing scattered markdown files, spreadsheets, and mental
tracking. The database holds all course planning data; the web UI is the
primary interface; exports produce artifacts for external systems.

### 1.2 What it is not
- Not an LMS (doesn't handle student submissions, grades, or delivery)
- Not a content authoring tool (doesn't replace Jupyter, LaTeX, etc.)
- Not a student-facing system

### 1.3 Core value propositions
1. **Single source of truth** — no drift between documents
2. **Change impact analysis** — move a session, see affected skills
3. **AI-assisted planning** — suggestions, gap analysis, pedagogy chat
4. **Export pipelines** — generate artifacts for Gradescope, LMS, print
5. **Historical reference** — query across semesters

---

## 2. Data Model

### 2.1 Core entities

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Term     │────<│   Module    │────<│   Session   │
└─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                          │                    │
                    ┌─────┴─────┐        ┌─────┴─────┐
                    │   Skill   │<───────│ Coverage  │
                    └───────────┘        └───────────┘
                          │
                    ┌─────┴─────┐
                    │Assessment │
                    └───────────┘
```

#### Term
A semester or quarter instance of a course.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | string | e.g., "S26", "F25" |
| name | string | e.g., "Spring 2026" |
| start_date | date | First day of term |
| end_date | date | Last day of term |
| course_code | string | e.g., "DS-100" |
| meeting_pattern | jsonb | Days/times classes meet |
| holidays | jsonb | Non-class dates |
| cloned_from | UUID | FK to parent term (for semester setup) |

#### Module
A thematic grouping of content (like a unit or chapter).

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| term_id | UUID | FK to Term |
| sequence | int | Order within term (0, 1, 2...) |
| code | string | e.g., "LM-01" |
| title | string | e.g., "Programming Basics" |
| description | text | Module overview |
| learning_objectives | text[] | High-level goals |

#### Skill
A specific, assessable competency.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| code | string | e.g., "A01", "B03", "C15" |
| category | string | e.g., "Foundations", "Analysis", "Communication" |
| description | text | What the student can do |
| prerequisites | UUID[] | Skills that should come before |
| is_global | bool | True if shared across terms, false if term-specific |

#### Session
A single class meeting (lecture or lab).

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| module_id | UUID | FK to Module |
| sequence | int | Order within module |
| session_type | enum | 'lecture' or 'lab' |
| code | string | e.g., "lec-05", "lab-03" |
| title | string | Session title |
| date | date | Scheduled date (nullable for unscheduled) |
| description | text | What happens in this session |
| format | string | e.g., "traditional", "flipped", "escape-room" |
| prior_art | UUID[] | Links to similar sessions in other terms |
| notes | text | Instructor notes |

#### Coverage
Junction table linking sessions to skills with coverage level.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| session_id | UUID | FK to Session |
| skill_id | UUID | FK to Skill |
| level | enum | 'introduced', 'practiced', 'assessed' |
| notes | text | Optional context |

#### Assessment
A graded artifact (assignment, exam, project).

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| term_id | UUID | FK to Term |
| code | string | e.g., "GAIE-01", "midterm", "final-project" |
| title | string | Assessment title |
| assessment_type | enum | 'gaie', 'assignment', 'exam', 'project' |
| description | text | What students do |
| skills_assessed | UUID[] | Skills this assessment verifies |
| session_id | UUID | FK to Session where it's assigned (nullable) |
| due_date | date | When it's due |
| rubric | jsonb | Grading criteria |
| progression_stage | string | For GAIEs: 'copy-paste', 'modify', 'write-own' |

#### Artifact
A generated or linked file (notebook, handout, etc.).

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| parent_type | enum | 'session', 'assessment', 'module' |
| parent_id | UUID | FK to parent entity |
| artifact_type | enum | 'notebook', 'handout', 'slides', 'ta-key', etc. |
| filename | string | e.g., "GAIE01.ipynb" |
| template | string | Template name for generation |
| generated_at | timestamp | Last generation time |
| metadata | jsonb | Type-specific metadata |

### 2.2 Constraints and invariants

1. **Skill ordering:** A skill cannot be 'practiced' in a session before
   it has been 'introduced' in an earlier session (same term).

2. **Skill assessment:** A skill cannot be 'assessed' before it has been
   at least 'practiced'.

3. **Session dating:** Sessions within a module should have sequential
   dates (if dated).

4. **GAIE progression:** GAIEs must follow the progression order:
   copy-paste → modify → write-own (within a term).

5. **Module coverage:** Each module should cover at least one skill
   (warning, not hard constraint).

6. **Orphan detection:** Flag skills that exist but have no coverage in
   any session.

### 2.3 Historical linking

Sessions can reference `prior_art` — similar sessions from previous
terms. This enables:
- "Show me how I taught bootstrap last semester"
- "Copy this session structure to current term"
- Side-by-side comparison of approaches

Skills marked `is_global=true` are shared across terms (same skill ID).
Term-specific skills (variations, experiments) use `is_global=false`.

---

## 3. User Stories

### 3.1 Semester setup

**US-1:** As an instructor, I want to clone a previous term's structure
to a new term, so I can start with a working baseline and adjust.

**US-2:** As an instructor, I want to import a calendar (holidays,
meeting pattern) for the new term, so sessions auto-populate dates.

**US-3:** As an instructor, I want to see which skills/sessions differ
from the cloned term, so I can track my changes.

### 3.2 Planning and editing

**US-4:** As an instructor, I want to drag sessions on a calendar view
to reschedule them, and see which skills are affected.

**US-5:** As an instructor, I want to view a coverage matrix (skills ×
sessions) showing I/P/A levels, so I can spot gaps.

**US-6:** As an instructor, I want to add a new skill and see "no
sessions cover this yet" as a warning.

**US-7:** As an instructor, I want to mark a session as "canceled" and
have the system suggest how to redistribute its skills.

**US-8:** As an instructor, I want to edit session details (description,
format, notes) in a form view.

**US-9:** As an instructor, I want to link a session to prior_art from
another term with one click.

### 3.3 AI assistance

**US-10:** As an instructor, when I cancel or move a session, I want AI
to suggest redistribution options ranked by pedagogical fit.

**US-11:** As an instructor, I want to chat with an AI about assessment
design, with the AI aware of my course structure and skills.

**US-12:** As an instructor, I want AI to analyze my coverage matrix and
identify weaknesses (e.g., "skill B07 is only introduced, never
assessed").

**US-13:** As an instructor, I want AI to review my session descriptions
against pedagogical principles and flag issues.

### 3.4 Historical reference

**US-14:** As an instructor, I want to search "bootstrap" and see all
sessions across all terms that mention it.

**US-15:** As an instructor, I want to see a timeline of how a specific
skill's coverage has evolved across terms.

**US-16:** As an instructor, I want to compare two terms side-by-side to
see structural differences.

### 3.5 Export

**US-17:** As an instructor, I want to export a module overview as
markdown (for archival or sharing).

**US-18:** As an instructor, I want to generate an Otter-Grader notebook
skeleton from an assessment definition.

**US-19:** As an instructor, I want to generate a printable PDF calendar
for my wall.

**US-20:** As an instructor, I want to export an LMS import package
(Blackboard or Canvas format) for a module.

**US-21:** As an instructor, I want to generate a student-facing
syllabus from term + module + session data.

### 3.6 Verification

**US-22:** As an instructor, I want to run a "pre-flight check" before
the term starts that validates: all sessions dated, no skill gaps, all
assessments have due dates, etc.

**US-23:** As an instructor, I want to see a diff of what changed since
last week (audit log).

---

## 4. Functional Requirements

### 4.1 Views

| View | Description |
|------|-------------|
| **Term Dashboard** | Overview of current term: progress, warnings, quick stats |
| **Calendar** | Drag-and-drop session scheduling, color-coded by module |
| **Module Editor** | Edit module details, reorder sessions, manage skills |
| **Session Editor** | Edit session details, manage coverage, link prior art |
| **Coverage Matrix** | Skills × Sessions grid with I/P/A indicators |
| **Skill Browser** | List/search skills, see coverage across sessions |
| **Assessment Manager** | List assessments, edit details, link to sessions |
| **History Browser** | Search across terms, compare structures |
| **AI Chat** | Contextual chat interface for pedagogy consultation |
| **Export Center** | Generate and download artifacts |

### 4.2 Actions

| Action | Trigger | Result |
|--------|---------|--------|
| Clone term | Button in term list | New term with copied structure |
| Move session | Drag on calendar | Date updated, impact shown |
| Cancel session | Context menu | Session marked canceled, redistribution suggested |
| Add skill | Button in skill browser | New skill created, orphan warning shown |
| Generate artifact | Button in export center | File generated, download offered |
| Run preflight | Button in dashboard | Validation report shown |
| Ask AI | Chat input | AI response with course context |

### 4.3 Notifications and warnings

| Condition | Warning level | Message |
|-----------|---------------|---------|
| Skill never introduced | Error | "Skill X is practiced/assessed but never introduced" |
| Skill not assessed | Warning | "Skill X has no assessment" |
| Session undated | Info | "Session Y has no date" |
| Module has no skills | Warning | "Module Z covers no skills" |
| GAIE progression broken | Error | "GAIE progression out of order" |
| Orphan skill | Info | "Skill X exists but is not covered" |

---

## 5. AI Integration Requirements

### 5.1 Context provision

The AI must have access to:
- Full term structure (modules, sessions, skills, coverage)
- Assessment details and rubrics
- Pedagogical principles (encoded as system prompt or RAG)
- Historical data (prior terms) for reference

### 5.2 AI capabilities

| Capability | Input | Output |
|------------|-------|--------|
| Redistribution suggestion | Canceled/moved session | Ranked options for skill redistribution |
| Coverage analysis | Coverage matrix | List of gaps, weaknesses, recommendations |
| Pedagogy consultation | User question + context | Conversational response |
| Content review | Session/assessment description | Feedback against principles |
| Historical search | Query string | Relevant sessions from past terms |

### 5.3 AI constraints

- AI should NOT invent policy (grading rules, requirements)
- AI should flag uncertainty rather than guess
- AI suggestions should be reviewable, not auto-applied
- AI should cite sources when referencing prior terms

### 5.4 Implementation approach

- Use Claude API (or similar) with structured context injection
- Pedagogical principles as system prompt or fine-tuned behavior
- RAG for historical search (embed session descriptions, query by
  similarity)
- Tool use for structured operations (list skills, find gaps, etc.)

---

## 6. Export Requirements

### 6.1 Markdown export

| Artifact | Template | Variables |
|----------|----------|-----------|
| Module overview | `module-overview.md.j2` | module, sessions, skills |
| Session description | `session.md.j2` | session, coverage |
| Skill list | `skills.md.j2` | skills by category |
| Term summary | `term-summary.md.j2` | term, modules, stats |

### 6.2 Notebook export (Otter-Grader)

- Generate `.ipynb` skeleton with Otter metadata
- Include question stubs based on assessment definition
- Include test cell stubs (instructor fills in actual tests)
- Follow `notebook-assignment-guide.md` structure exactly

### 6.3 LaTeX/PDF export

- Generate `.tex` from templates following `latex-printables-guide.md`
- Compile via `lualatex -shell-escape` (server-side or user's machine)
- Artifacts: calendar, answer sheets, handouts

### 6.4 LMS export

| LMS | Format | Notes |
|-----|--------|-------|
| Blackboard | SCORM or native zip | Module structure, content items |
| Canvas | Common Cartridge | Module structure, assignments |

### 6.5 Other exports

- iCal feed (sessions as calendar events)
- JSON dump (full term data for backup/migration)
- CSV (skills, coverage matrix for spreadsheet analysis)

---

## 7. Non-Functional Requirements

### 7.1 Performance

- Page load < 2s for typical views
- Calendar drag-and-drop should feel instant (optimistic UI)
- AI responses < 30s for complex queries
- Export generation < 60s for largest artifacts

### 7.2 Scalability

- Support 10+ terms of historical data
- Support 100+ skills per term
- Support 50+ sessions per term
- Single-user initially (multi-user nice-to-have)

### 7.3 Data integrity

- All changes logged with timestamp and (eventually) user
- Ability to restore previous state (soft deletes, audit log)
- Database backups (standard PostgreSQL approach)

### 7.4 Portability

- Docker-based deployment for easy self-hosting
- SQLite option for local-only use (dev, small deployments)
- PostgreSQL for production / shared use

### 7.5 Accessibility

- Keyboard navigable
- Screen reader compatible (ARIA labels)
- Mobile-responsive (at least read views)

---

## 8. Technical Preferences

### 8.1 Stack recommendation

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Database | PostgreSQL | Rich JSON support, temporal features, mature |
| Backend | Django or FastAPI | Python ecosystem (matches Jupyter/Otter), mature ORM |
| Frontend | htmx + Alpine.js or React | htmx for simplicity, React if rich interactivity needed |
| AI | Claude API | Best reasoning, tool use support |
| Templates | Jinja2 | Standard Python templating |
| PDF | LuaLaTeX (server-side) | Per latex-printables-guide.md |

### 8.2 Alternative: Dolt for version control

If git-style branching/merging of data is desired:
- Use Dolt instead of PostgreSQL
- Enables `dolt checkout fall-2025` to see historical state
- Adds complexity but provides true data versioning

### 8.3 Development approach

- Start with CLI tools for data manipulation (validate model)
- Add web UI incrementally
- AI integration can be layered on after core CRUD works
- Export pipelines can be developed independently

---

## 9. MVP Scope

### 9.1 MVP (v0.1) — Core planning

- [ ] Data model implemented (Term, Module, Session, Skill, Coverage)
- [ ] Basic web UI: term list, module editor, session editor
- [ ] Coverage matrix view (read-only)
- [ ] Markdown export for module overview
- [ ] Import: CSV for skills, basic calendar setup

### 9.2 v0.2 — Calendar and validation

- [ ] Calendar view with drag-and-drop
- [ ] Change impact analysis (show affected skills on move)
- [ ] Preflight validation checks
- [ ] Clone term functionality

### 9.3 v0.3 — AI integration

- [ ] AI chat interface with course context
- [ ] Redistribution suggestions
- [ ] Coverage gap analysis

### 9.4 v0.4 — Exports

- [ ] Otter notebook skeleton generation
- [ ] LaTeX/PDF generation
- [ ] LMS export (one format)

### 9.5 v0.5 — History

- [ ] Prior art linking
- [ ] Cross-term search
- [ ] Term comparison view

---

## 10. Open Questions

1. **Multi-user:** Should the system support multiple instructors
   (TAs, co-instructors) from the start, or is single-user sufficient
   for MVP?

2. **Hosting model:** Self-hosted only, or offer a hosted instance for
   the open-source community?

3. **LMS integration depth:** Read-only export, or bidirectional sync
   (pull grades, push content)?

4. **AI model choice:** Claude-only, or abstract to support multiple
   providers (OpenAI, local models)?

5. **Mobile:** Native app needed, or responsive web sufficient?

6. **Real-time collaboration:** Needed for co-instructors editing
   simultaneously, or optimistic locking sufficient?

---

## 11. Relationship to Existing Workflow

This system would replace:
- `lm-##-overview.md` files → Module + Session data in DB
- `WORKPLAN.md` → Term Dashboard + validation
- Scattered lecture `.md` files → Session editor
- Mental skill tracking → Coverage matrix
- Manual exports → Export center

The existing `course-info/course-prompt-materials/` rulebooks would be:
- Encoded as validation rules in the system
- Used as prompts for AI consultation
- Referenced in export templates

---

## Appendix A: Example Data

### Example: DS-100 Spring 2026

```
Term: S26
├── Module: LM-01 "Programming Basics"
│   ├── Session: lec-05 (2026-01-28)
│   │   └── Coverage: A01 (introduced), A02 (introduced)
│   ├── Session: lab-02 (2026-01-29)
│   │   └── Coverage: A01 (practiced), A02 (practiced)
│   └── Assessment: GAIE-01 (copy-paste)
│       └── Skills assessed: A01, A02
├── Module: LM-02 "Tabular Data"
│   └── ...
└── Skills:
    ├── A01: "Write and execute Python expressions"
    ├── A02: "Use variables to store and retrieve values"
    └── ...
```

---

## Appendix B: References

- `course-planner-research-brief.md` — Problem statement and market
  research prompts
- `course-info/course-prompt-materials/notebook-assignment-guide.md` —
  Otter notebook structure
- `course-info/course-prompt-materials/latex-printables-guide.md` —
  LaTeX export requirements
- `course-info/README_CANONICAL_AI_RULES.md` — Pedagogical constraints
  to encode

---

*Document created: 2026-02-03*
*Origin: DS-100 course redesign project*
