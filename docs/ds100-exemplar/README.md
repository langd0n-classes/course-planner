# DS-100 Exemplar Files

These files are copied from a real course (DS-100: Intro to Data
Science, Boston University, Spring 2026) to serve as exemplar data
for the course planner app. The app itself should be **generic** --
nothing DS-100-specific should be hardcoded. These files show the
complexity level the app needs to handle.

## What's Here

### Course-Level Documents

- `ds100_skills_canonical.md` -- 46+ skills organized by learning
  module, with codes (e.g., `LM01-C01`), categories, and
  descriptions. Core vs. expansion skills.
- `ds100_schedule_instructor.md` -- 27 lectures + 13 labs with
  dates, module alignment, and weekly rhythm. Some lectures already
  marked canceled with consolidation notes.
- `ds100_implementation_spec.md` -- Authoritative implementation
  spec for the term. Hard constraints, assessment design, staffing.
- `gaie-adaptation-index.md` -- 15 GenAI-Integrated Exercises with
  progression stages (copy-paste, modify, write-own) and module
  links.
- `ds100_syllabus_student.md` -- Student-facing policies, grading
  weights (GAIE 20%, Demos 40%, Projects 40%), GenAI zones.
- `blackboard-ultra-lm-mapping.md` -- How modules map to LMS
  structure in Blackboard Ultra.

### Reference

- `academic-calendar-2025-2027.md` -- BU academic calendar with
  both human-readable and machine-readable sections. Defines class
  days, holidays, and finals periods.

### Module Overviews (3 examples)

- `lm00-overview.md` -- Onboarding module (simple, 2 lectures)
- `lm-03-overview.md` -- Seeing Patterns (mid-complexity, 2
  lectures + 1 lab + 2 GAIEs)
- `lm-05-overview.md` -- Uncertainty (complex, 4 lectures + 2 labs
  + 4 GAIEs)

### Session Descriptions (4 examples)

- `lec-05-programming-basics.md` -- Lecture session plan
- `lec-07-data-manipulation.md` -- Lecture session plan
- `lab-03-tables-practice.md` -- Lab/discussion session plan
- `lab-05-histogram-interpretation.md` -- Lab/discussion session
  plan

### Scripts

- `extract_blackboard.py` -- Shows how Blackboard Ultra docx
  export/import works. This is the kind of external-system export
  the app needs to support.

## How to Use These

1. Study the **skills file** to understand skill taxonomy structure
2. Study the **schedule** to understand session/module organization
3. Study the **module overviews** to understand what a "module"
   contains and how it's documented
4. Study the **session descriptions** to understand the level of
   detail per lecture/lab
5. Use all of the above to design the **import format** and build
   an exemplar seed script that generates import JSON from this data
