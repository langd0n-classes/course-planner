# DS-100 — Implementation Spec v1
**Target:** Spring 2026  
**Inputs:** Phase 0, Phase 0.5 (Design Brief), Phase 1.2 + Instructor Reactions  
**Purpose:** Authoritative implementation guidance for doc + repo rewrite

---

## 0. Non-Negotiables & Constraints

**Semester / Context**
- Term: Spring 2026
- Enrollment: ~52 students
- Staffing: no changes from prior runs
- Platform assumptions:
  - Blackboard = authoritative course record
  - Gradescope = submission + grading (via LTI where possible)
  - Piazza = communication
  - TerrierGPT = available and assumed

**Hard constraints**
- No new exams without explicit instructor approval
- No participation grading (artifact-based evidence only)
- No reliance on additional TA labor
- No assumption that students read the full syllabus
- Course is **not** being rewritten from scratch

---

## 1. Decision Ledger (Phase 1.2 → Implementation)

| Phase 1.2 Area | Recommendation | Decision | Rationale | Notes / Pointer |
|---|---|---|---|---|
| Lecture Pace | Slow down lectures | Reject | Fast pace is intentional in flipped model; issue was expectation-setting, not pace | Phase 1.2: Student Feedback |
| Flipped Model | Strengthen flipped structure | Adopt | Core course identity; needs clearer signaling + onboarding | Phase 1.2: Diagnosis |
| GAIE Timing | GAIEs before lecture | Modify | Full GAIE workflow begins at Lecture 5 | Phase 1.2: GenAI Integration |
| GAIE Role | Optional / moderate GenAI use | Reject | Undermines learning-to-learn-with-AI goal | Phase 1.2: Moderate option |
| Labs / Discussions | Treat as discussions | Modify | Labs are verification / demonstration | Phase 1.2: Structure |
| Assessment Load | Reduce frequency | Modify | Keep practice, reduce quiz feel | Phase 1.2: Assessment Load |
| Oral Check-ins | Scale oral verification | Defer | Valuable but logistically hard | Phase 1.2: Ambitious |
| Projects | More authentic assessment | Adopt | Aligns with goals | Phase 1.2: Project Design |
| Platform Clarity | Single home base | Adopt (BB) | Expedient Spring choice | Phase 1.2: Communication |
| Visual Learners | More visual support | Adopt | Visual paths in GAIEs | Design Brief |
| Content Volume | Reduce content | Reject | Issue was tooling/timing | Phase 1.2: Pacing |

---

## 2. Syllabus Delta List

### 2.1 Course Structure & Pedagogy
Add clarifying language on flipped model and expectations.

### 2.2 Labs / Discussions
Reframe as verification labs.

### 2.3 GenAI Policy
Clarify intent; discourage copy/paste; ramp full GAIE use at Lecture 5.

### 2.4 Assessment Philosophy
Clarify drop-lowest intent and practice vs graded work.

### 2.5 Platforms
Explicit authority statement.

---

## 3. Schedule Blueprint (Spec-Level)

### Lectures 1–4
Onboarding phase: mechanics, expectations, light content.

### Lecture 5
Transition to full GAIE workflow.

### Lectures 5–N
Steady state: GAIEs before lecture; labs for verification.

### Late Semester
Shift toward projects; reduce quiz density.

---

## 4. Assessment Design Intent

- GAIEs: practice, low-stakes
- Labs: verification
- Mini-projects: formative
- Final project: summative, team-based (2–3)

---

## 5. Repo / Content Restructuring Rules

- One module per artifact
- Fix off-by-one errors
- Use git mv / git rm
- No deletions without approval

---

## 6. Open Questions / Needs-Human

1. Checkpoint / Mini-Exam 1 status
2. Mini-project integration
3. Oral verification logistics
4. Lab grading model
5. GAIE alternatives

---

## 7. Intended Use

Authoritative spec for agents; higher priority than best practices.
