# Research Brief: AI-Native Course Planning System

**Purpose:** This document provides context and research questions for a
deep investigation into building (or buying) an AI-integrated course
planning and content management system for higher education instructors.

**Intended use:** Feed this document to Claude Research, OpenAI Deep
Research, or similar deep-dive research tools to produce:
- Validated requirements
- Comprehensive OTS/competitor landscape
- Market viability analysis
- Lean Canvas or Venture Feasibility Analysis

---

## 1. Problem Statement

### The pain
Instructors teaching technical courses (data science, programming, etc.)
face a coordination problem: course content lives in many places and
must stay synchronized.

A typical course has:
- **Skills/learning outcomes** (what students should be able to do)
- **Modules** (thematic groupings of content)
- **Sessions** (lectures, labs) mapped to calendar dates
- **Assessments** (assignments, exams, projects) that verify skills
- **Supporting materials** (slides, handouts, notebooks, datasets)

When something changes (a lecture is canceled, a skill gets
deprioritized, an assessment is restructured), the instructor must
manually update multiple documents and hope nothing drifts out of sync.

### Current workarounds
- Markdown files in a git repo (version-controlled but not queryable)
- Spreadsheets (queryable but no relationships, no version control)
- LMS platforms (delivery-focused, weak on planning/authoring)
- Mental tracking (doesn't scale, error-prone)

### The gap
There is no system that:
1. Treats course structure as a **relational data model** (skills,
   sessions, assessments with real relationships)
2. Provides **change impact analysis** (move a lecture → see which
   skills are affected)
3. Offers **AI-assisted planning** (suggest redistributions, analyze
   coverage gaps, consult on pedagogy)
4. **Exports to real teaching artifacts** (autograded notebooks, LMS
   packages, printable materials)
5. Maintains **historical context** (what did I teach on this topic
   last semester?)

---

## 2. Current Workflow (Concrete Example)

This research brief originates from a real course redesign project:
DS-100 (Intro to Data Science) at Boston University.

### What exists today
- 7 learning modules (LM-00 through LM-07)
- ~50 skills tracked across modules
- 27 lectures + 13 labs mapped to a semester calendar
- 7 GenAI-integrated exercises (GAIEs) with progression stages
- Autograded Jupyter notebooks using Otter-Grader
- LaTeX templates for printable student handouts
- Blackboard as the LMS (content uploaded manually)
- All content authored as Markdown files in a git repo
- GenAI agents (Claude Code) assist with content generation, constrained
  by "binding rulebooks" (markdown docs specifying rules)

### Pain points observed
1. **Drift:** Overview docs list skills, but lecture descriptions may
   not match; no automated consistency check
2. **Change propagation:** Moving a lecture requires updating the
   calendar, the module overview, the lecture file, and potentially
   assessments — all manually
3. **Coverage uncertainty:** "Do we actually assess skill B07?" requires
   grepping across files
4. **Historical amnesia:** "What worked last time I taught bootstrap?"
   requires digging through old repos
5. **No AI leverage for planning:** AI helps write content but can't
   reason about course structure (skills coverage, schedule conflicts,
   pedagogical trade-offs)

---

## 3. Envisioned Solution

### Core system
A web application backed by a relational database that models:
- **Skills** (ID, description, category, prerequisites)
- **Modules** (sequence, skills covered, learning objectives)
- **Sessions** (type, date, skills introduced/practiced/assessed, prior
  versions)
- **Assessments** (type, skills verified, rubric, linked sessions)
- **Terms** (calendar, holidays, meeting patterns)
- **Content artifacts** (notebooks, handouts, slides — metadata and
  generation templates)

### Key capabilities

**Planning & tracking:**
- Drag-and-drop calendar with sessions
- Coverage matrix (skill × session, showing I/P/A status)
- Gap detection ("skill C03 has no assessment")
- Change impact analysis ("moving lecture 12 orphans skills B04, B05")

**AI integration:**
- **Redistribution suggestions:** When schedule changes, AI proposes how
  to redistribute affected skills
- **Pedagogical consultation:** Chat interface to discuss assessment
  design, activity structure, etc., with AI that understands the course
  context
- **Coverage analysis:** AI reviews the coverage matrix and identifies
  weaknesses
- **Content review:** AI checks generated content against pedagogical
  principles

**Export pipelines:**
- Otter-Grader notebooks (autograded Jupyter)
- LaTeX → PDF (printable handouts, answer sheets)
- LMS import packages (Blackboard, Canvas)
- Student-facing syllabus
- iCal feeds

**Version control:**
- Full audit history (who changed what, when)
- Semester snapshots (clone S26 → F26, adjust dates)
- Possibly git-style branching (Dolt or similar)

### User experience
The web app IS the source of truth. Instructors don't edit markdown
files — they use the UI. "Export to disk" happens only when producing
artifacts for external systems (Gradescope, LMS, print shop).

---

## 4. Research Questions

### A. OTS / Competitor Landscape

1. **LMS platforms (Canvas, Blackboard, Moodle, Brightspace):**
   - Do any have robust course *planning* features (not just delivery)?
   - What AI features exist for instructors (not students)?
   - How do they handle skills/outcome mapping?
   - Can they do change impact analysis?

2. **Curriculum mapping tools (Chalk, Atlas, Curriculum Mapper,
   Coursedog, Kuali):**
   - Are any designed for higher education (not just K-12)?
   - Do they support semester-level planning (not just program-level)?
   - Any AI integration?
   - What do they cost? (Enterprise sales vs. self-serve)

3. **Course design / authoring tools:**
   - OpenStax, Pressbooks, LibreTexts — do they have planning features?
   - Coursera/edX studio tools — applicable to non-MOOC contexts?
   - Any tools specifically for technical/programming courses?

4. **AI-native education tools:**
   - Khanmigo, Synthesis, Eduaide, MagicSchool — any for instructor
     planning (not student tutoring)?
   - Any startups in "AI course design" space?
   - What does "AI for instructors" look like in current products?

5. **Adjacent tools:**
   - Notion/Airtable/Coda — anyone using these for course planning?
     Templates? Limitations?
   - Obsidian with plugins — viable for this use case?
   - Project management tools (Asana, Linear) adapted for courses?

6. **Technical education specific:**
   - Tools for managing programming assignments (Gradescope, CodeGrade,
     Vocareum) — do they have planning features?
   - Jupyter ecosystem tools — anything for course structure management?

**Deliverable:** Comprehensive competitor matrix with feature comparison
against the envisioned capabilities.

### B. Market Viability

1. **Market size:**
   - How many higher education instructors in the US? Globally?
   - How many teach technical/STEM courses specifically?
   - What's the TAM/SAM/SOM for a course planning tool?

2. **Current spending:**
   - What do institutions spend on LMS platforms?
   - What do instructors spend on supplementary tools (personally or via
     department)?
   - Is there budget for "course design" tools separate from LMS?

3. **Pain validation:**
   - Is the "drift and coordination" problem widely recognized?
   - What do instructors currently do about it? (Forums, blog posts,
     academic papers on course design workflows)
   - Any surveys or studies on instructor pain points in course
     planning?

4. **Buyer dynamics:**
   - Who buys? (Instructor, department, institution, consortium)
   - What's the sales cycle for education tools?
   - Freemium vs. enterprise — what works in this space?

5. **Trends:**
   - Is AI adoption in higher education accelerating?
   - Are instructors open to AI-assisted planning?
   - Any regulatory or institutional barriers?

**Deliverable:** Market sizing estimate with assumptions, buyer persona
analysis, and trend assessment.

### C. Technical Feasibility

1. **Data model complexity:**
   - Are there existing standards for course/curriculum data models?
   - (IMS Global, xAPI, CASE, etc.)
   - Should we use a standard or build custom?

2. **LMS integration:**
   - What APIs do Canvas, Blackboard, Moodle expose?
   - Can we push content programmatically?
   - LTI integration — what's possible?

3. **AI integration:**
   - What context window is needed for meaningful course reasoning?
   - How to encode pedagogical principles for AI?
   - Retrieval-augmented generation (RAG) for historical reference?

4. **Export complexity:**
   - Otter-Grader notebook generation — documented? Stable?
   - LMS import formats — documented? Consistent across versions?
   - LaTeX compilation — cloud services available?

**Deliverable:** Technical risk assessment and architecture
recommendations.

### D. Business Model & Viability

1. **Revenue models in EdTech:**
   - What works? (SaaS, per-seat, per-course, freemium, enterprise)
   - Examples of successful instructor-facing tools and their models

2. **Competitive moat:**
   - If we build this, what prevents LMS vendors from copying?
   - Is AI integration a durable advantage?
   - Is course data / historical reference a switching cost?

3. **Go-to-market:**
   - Bottom-up (individual instructors) vs. top-down (institutional
     sales)?
   - Role of open source in education tool adoption?
   - Conference / community channels (SIGCSE, etc.)?

4. **Startup viability:**
   - Is this a venture-scale opportunity or a lifestyle business?
   - Comparable exits / acquisitions in EdTech?
   - Investor appetite for EdTech in current market?

**Deliverable:** Lean Canvas or similar framework, with assumptions
clearly stated.

---

## 5. Requested Deliverables

After researching the above, produce:

1. **Validated Requirements Document**
   - Confirm or revise the envisioned capabilities based on findings
   - Prioritize features (must-have vs. nice-to-have)
   - Identify requirements we missed

2. **Competitor Landscape Matrix**
   - Tools evaluated against key capabilities
   - Pricing where available
   - Gaps in current market

3. **Market Analysis**
   - TAM/SAM/SOM estimates with methodology
   - Buyer personas
   - Willingness-to-pay indicators

4. **Technical Architecture Recommendation**
   - Recommended stack
   - Integration approach (LMS, AI)
   - Build vs. buy for components

5. **Lean Canvas**
   - Problem, solution, key metrics, unfair advantage
   - Channels, customer segments, cost structure, revenue streams
   - Clearly stated assumptions to test

6. **Go/No-Go Recommendation**
   - Is this worth building?
   - If yes, what's the MVP scope?
   - If no, what's the best alternative (OTS + customization)?

---

## 6. Context & Constraints

### About the originating user
- University instructor teaching data science
- Technical (comfortable with Python, git, Jupyter, LaTeX)
- Has GenAI integrated into course design workflow
- Values automation but also pedagogical intentionality
- Not primarily motivated by startup/profit — but open to it if viable

### Constraints to consider
- Must work for a single instructor initially (not enterprise-first)
- Should not require institutional IT buy-in to start
- AI features are core, not an add-on
- Export to existing systems (Gradescope, Blackboard) is non-negotiable
- Historical data (prior semesters) is high value

### What success looks like
- Instructor can plan a semester in the tool, not in markdown files
- When schedule changes, system shows impact and suggests fixes
- Can ask "what did I do last time for bootstrap?" and get useful answer
- Exporting to Gradescope/Blackboard is one click, not a manual process
- AI consultation feels like talking to a knowledgeable colleague

---

## 7. How to Use This Document

### For Claude Research / OpenAI Deep Research:

```
I'm exploring whether to build a course planning system for higher
education instructors. The attached research brief describes the problem,
envisioned solution, and specific research questions.

Please investigate thoroughly and produce:
1. A competitor landscape matrix
2. Market viability analysis (TAM/SAM/SOM, buyer dynamics)
3. Technical feasibility assessment
4. A Lean Canvas with clearly stated assumptions
5. A go/no-go recommendation with reasoning

Focus especially on:
- Whether any OTS solution already solves this problem
- Whether there's real market demand (not just one instructor's pain)
- Whether AI-native course planning is a defensible product category
```

### For a human researcher:
The research questions in Section 4 can be tackled independently. Start
with the OTS landscape (A) — if something already exists, the rest may
be moot.

---

## Appendix: Glossary

- **LMS** — Learning Management System (Canvas, Blackboard, etc.)
- **Otter-Grader** — Autograding framework for Jupyter notebooks
- **GAIE** — GenAI-Integrated Exercise (course-specific term)
- **Coverage matrix** — Grid showing which skills are addressed in which
  sessions
- **I/P/A** — Introduced / Practiced / Assessed (skill coverage levels)
- **Dolt** — Git-for-databases tool (SQL database with version control)
- **LTI** — Learning Tools Interoperability (standard for LMS
  integration)
- **TAM/SAM/SOM** — Total/Serviceable/Obtainable Addressable Market

---

*Document created: 2026-02-03*
*Origin: DS-100 course redesign project, Boston University*
