# DS-100 Instructor Schedule & Execution Plan — Spring 2026

DRAFT — Work in progress.

**Audience:** Instructor & TAs only
**Status:** Draft execution document for Spring 2026
**Student-facing policy reference:** `ds100_syllabus_student.md`
**Controlling redesign spec:** `ds100_implementation_spec.md`

---

## Purpose of this Document

This file defines *how the course runs week-to-week*
in Spring 2026.

It is **not** a syllabus and is **not student-facing**.

- Policies, grading rules, and contractual language
  live in the student syllabus.
- This document captures execution logic, sequencing,
  and instructional intent.
- This document may be adjusted mid-semester without
  revising the syllabus.
- This document is the source for building the
  Blackboard calendar (manual process).

---

## Touchpoint Definitions (Operational)

- **Lecture (Tue/Thu):**
  Concept introduction, live walkthroughs, short
  practice, framing for verification.
- **Discussion / Lab (Fri):**
  Verification exercises, debugging, guided practice,
  and project work time.
  Default is no-AI or limited-AI verification unless
  explicitly stated.
  Not a mini-lecture unless explicitly noted.
- **Office Hours:**
  Help, follow-ups, makeup logistics per syllabus
  policy.

---

## Weekly Course Rhythm (Default)

Unless otherwise specified:

- **Before Tuesday lecture:**
  GAIE due (completion-graded, submitted via
  Gradescope).
- **Tuesday lecture:**
  New concepts + worked examples.
- **Thursday lecture:**
  Integration, application, and transition to
  verification.
- **Friday discussion/lab:**
  No-AI or limited-AI verification, practice, and
  project scaffolding.

---

## Semester Phases (Instructor View)

### Phase 1: Foundations (Weeks 1–4, Jan 20 – Feb 13)

LM-00 through LM-03.

- Python fundamentals, data organization,
  manipulation, and visualization basics.
- Lec 03 and 04 canceled (instructor absence).
  LM-01 consolidated into Lec 05; LM-02 merged
  into Lec 06.
- GAIE workflow begins Week 2 (GAIE-01 before
  Lec 05).
  Pattern: copy-paste prompts.
- Emphasis on recognizing and correcting AI errors.

### Phase 2: Statistics & Testing (Weeks 5–9, Feb 19 – Mar 27)

LM-04 through LM-06.

- Variation, probability, sampling, bootstrap,
  hypothesis testing, A/B testing.
- GAIE pattern progresses: modify prompts (LM-04/05),
  then write own prompts (LM-06).
- Regular no-AI verification in labs.
- Mini-project (team) released Week 7, due Week 8,
  oral verification Week 9.

### Phase 3: Modeling & Communication (Weeks 10–14, Mar 31 – Apr 30)

LM-07.

- Regression, classification, model evaluation,
  ethics, data storytelling, synthesis.
- GAIE-07 continues write-own-prompts pattern.
- Final project released Week 10 (Lab 10, Apr 3).
  Proposals due Weeks 11–12.
- Lectures 26–27 are project work time and course
  wrap-up.
- Oral interviews during finals period (May 4–8).

---

## Meeting-by-Meeting Schedule Spine

This spine enumerates every scheduled meeting for
Tue/Thu lectures and Fri labs.

- Lec 03 and 04 (Jan 27, 29) canceled due to
  instructor absence.
  LM-01 consolidated into Lec 05 (Feb 3).
  LM-02 merged into Lec 06 (Feb 5).
- Tue 2026-02-17 follows Monday schedule (no class).
- Spring recess: 2026-03-07 to 2026-03-15.
- No Fri lab in the final week (Apr 28).

| Date       | Day | Type | Meeting | LM    | Focus      | Prep  |
| ---------- | --- | ---- | ------- | ----- | ---------- | ----- |
| 2026-01-20 | Tue | Lec  | Lec 01  | LM-00 | Onboard    | [L01] |
| 2026-01-22 | Thu | Lec  | Lec 02  | LM-00 | Workflow   | [L02] |
| 2026-01-23 | Fri | Lab  | Lab 01  | LM-00 | Setup      | [B01] |
| 2026-01-27 | Tue | ---  | Lec 03  | LM-01 | CANCELED   |       |
| 2026-01-29 | Thu | ---  | Lec 04  | LM-01 | CANCELED   |       |
| 2026-01-30 | Fri | Lab  | Lab 02  | LM-01 | Practice   | [B02] |
| 2026-02-03 | Tue | Lec  | Lec 05  | LM-01 | Catch-up   | [L05] |
| 2026-02-05 | Thu | Lec  | Lec 06  | LM-02 | Tables+claims | [L06] |
| 2026-02-06 | Fri | Lab  | Lab 03  | LM-02 | Practice   | [B03] |
| 2026-02-10 | Tue | Lec  | Lec 07  | LM-03 | Manip      | [L07] |
| 2026-02-12 | Thu | Lec  | Lec 08  | LM-03 | Viz        | [L08] |
| 2026-02-13 | Fri | Lab  | Lab 04  | LM-03 | Practice   | [B04] |
| 2026-02-19 | Thu | Lec  | Lec 09  | LM-04 | Variation  | [L09] |
| 2026-02-20 | Fri | Lab  | Lab 05  | LM-04 | Histogram  | [B05] |
| 2026-02-24 | Tue | Lec  | Lec 10  | LM-05 | Probability | [L10] |
| 2026-02-26 | Thu | Lec  | Lec 11  | LM-05 | Simulation | [L11] |
| 2026-02-27 | Fri | Lab  | Lab 06  | LM-05 | Lab        | [B06] |
| 2026-03-03 | Tue | Lec  | Lec 12  | LM-05 | Sampling   | [L12] |
| 2026-03-05 | Thu | Lec  | Lec 13  | LM-05 | Bootstrap  | [L13] |
| 2026-03-06 | Fri | Lab  | Lab 07  | LM-05 | Lab        | [B07] |
| 2026-03-17 | Tue | Lec  | Lec 14  | LM-06 | Testing    | [L14] |
| 2026-03-19 | Thu | Lec  | Lec 15  | LM-06 | A/B        | [L15] |
| 2026-03-20 | Fri | Lab  | Lab 08  | LM-06 | Lab        | [B08] |
| 2026-03-24 | Tue | Lec  | Lec 16  | LM-06 | Buffer     | [L16] |
| 2026-03-26 | Thu | Lec  | Lec 17  | LM-06 | Review     | [L17] |
| 2026-03-27 | Fri | Lab  | Lab 09  | LM-06 | Lab        | [B09] |
| 2026-03-31 | Tue | Lec  | Lec 18  | LM-07 | Regression | [L18] |
| 2026-04-02 | Thu | Lec  | Lec 19  | LM-07 | Reg prac   | [L19] |
| 2026-04-03 | Fri | Lab  | Lab 10  | LM-07 | Showdown   | [B10] |
| 2026-04-07 | Tue | Lec  | Lec 20  | LM-07 | Classify   | [L20] |
| 2026-04-09 | Thu | Lec  | Lec 21  | LM-07 | Evaluation | [L21] |
| 2026-04-10 | Fri | Lab  | Lab 11  | LM-07 | Clinic     | [B11] |
| 2026-04-14 | Tue | Lec  | Lec 22  | LM-07 | Ethics     | [L22] |
| 2026-04-16 | Thu | Lec  | Lec 23  | LM-07 | Comm       | [L23] |
| 2026-04-17 | Fri | Lab  | Lab 12  | LM-07 | Newsroom   | [B12] |
| 2026-04-21 | Tue | Lec  | Lec 24  | LM-07 | Synthesis  | [L24] |
| 2026-04-23 | Thu | Lec  | Lec 25  | LM-07 | Story      | [L25] |
| 2026-04-24 | Fri | Lab  | Lab 13  | LM-07 | Defense    | [B13] |
| 2026-04-28 | Tue | Lec  | Lec 26  | LM-07 | Project    | [L26] |
| 2026-04-30 | Thu | Lec  | Lec 27  | LM-07 | Wrap       | [L27] |

[L01]: ../../lms/lm-00-onboarding-course-info/lec-01-onboarding-tools.md
[L02]: ../../lms/lm-00-onboarding-course-info/lec-02-course-workflow.md
[B01]: ../../lms/lm-00-onboarding-course-info/lab-01-setup-verification.md
[L05]: ../../lms/lm-01-programming-basics/lec-05-programming-basics.md
[B02]: ../../lms/lm-01-programming-basics/lab-02-programming-foundations.md
[L06]: ../../lms/lm-02-data-claims/lec-06-claims-data-quality.md
[B03]: ../../lms/lm-02-data-claims/lab-03-tables-practice.md
[L07]: ../../lms/lm-03-patterns/lec-07-data-manipulation.md
[L08]: ../../lms/lm-03-patterns/lec-08-visualization-basics.md
[B04]: ../../lms/lm-03-patterns/lab-04-patterns-practice.md
[L09]: ../../lms/lm-04-variation/lec-09-variation-histograms.md
[B05]: ../../lms/lm-04-variation/lab-05-histogram-interpretation.md
[L10]: ../../lms/lm-05-uncertainty/lec-10-probability-foundations.md
[L11]: ../../lms/lm-05-uncertainty/lec-11-simulation-randomness.md
[B06]: ../../lms/lm-05-uncertainty/lab-06-probability-lab.md
[L12]: ../../lms/lm-05-uncertainty/lec-12-sampling-distributions.md
[L13]: ../../lms/lm-05-uncertainty/lec-13-bootstrap-foundations.md
[B07]: ../../lms/lm-05-uncertainty/lab-07-sampling-lab.md
[L14]: ../../lms/lm-06-testing-ideas/lec-14-hypothesis-testing.md
[L15]: ../../lms/lm-06-testing-ideas/lec-15-ab-testing.md
[B08]: ../../lms/lm-06-testing-ideas/lab-08-testing-lab.md
[L16]: ../../lms/lm-06-testing-ideas/lec-16-review-reinforcement.md
[L17]: ../../lms/lm-06-testing-ideas/lec-17-applied-review.md
[B09]: ../../lms/lm-06-testing-ideas/lab-09-review-lab.md
[L18]: ../../lms/lm-07-modeling-communication/lec-18-regression-concepts.md
[L19]: ../../lms/lm-07-modeling-communication/lec-19-regression-practice.md
[B10]: ../../lms/lm-07-modeling-communication/lab-10-regression-lab.md
[L20]: ../../lms/lm-07-modeling-communication/lec-20-classification-concepts.md
[L21]: ../../lms/lm-07-modeling-communication/lec-21-model-evaluation.md
[B11]: ../../lms/lm-07-modeling-communication/lab-11-classification-lab.md
[L22]: ../../lms/lm-07-modeling-communication/lec-22-ethics-modeling.md
[L23]: ../../lms/lm-07-modeling-communication/lec-23-communicating-results.md
[B12]: ../../lms/lm-07-modeling-communication/lab-12-ethics-communication-lab.md
[L24]: ../../lms/lm-07-modeling-communication/lec-24-project-synthesis.md
[L25]: ../../lms/lm-07-modeling-communication/lec-25-storytelling-synthesis.md
[B13]: ../../lms/lm-07-modeling-communication/lab-13-synthesis-lab.md
[L26]: ../../lms/lm-07-modeling-communication/lec-26-final-project-work.md
[L27]: ../../lms/lm-07-modeling-communication/lec-27-course-wrap-up.md

---

## Student-Facing Due Dates (for Blackboard Calendar)

Single chronological calendar of everything students
need to plan around: GAIE releases and deadlines,
project milestones, and semester boundaries.

Do NOT include lab or lecture verification dates —
students should not know which sessions have graded
in-class activities.

All due times are 8:00 AM Eastern unless noted.

| Date       | Day | Action  | Item                | LM   | Notes                              |
| ---------- | --- | ------- | ------------------- | ---- | ---------------------------------- |
| 2026-01-20 | Tue |         | SEMESTER BEGINS     |      | First day of classes               |
| 2026-01-22 | Thu | Release | GAIE-01             | LM01 | Programming basics                 |
| 2026-02-03 | Tue | Due     | GAIE-01             | LM01 | Before Lec 05 (catch-up)           |
| 2026-02-03 | Tue | Release | GAIE-02             | LM03 | Data manipulation                  |
| 2026-02-10 | Tue | Due     | GAIE-02             | LM03 | Before Lec 07                      |
| 2026-02-12 | Thu | Release | GAIE-03             | LM04 | Variation/distributions            |
| 2026-02-17 | Tue |         | NO CLASS            |      | Monday schedule substituted        |
| 2026-02-19 | Thu | Due     | GAIE-03             | LM04 | Before Lec 09                      |
| 2026-02-19 | Thu | Release | GAIE-04             | LM05 | Probability/simulation             |
| 2026-02-24 | Tue | Due     | GAIE-04             | LM05 | Before Lec 10                      |
| 2026-02-26 | Thu | Release | GAIE-05             | LM05 | Sampling/bootstrap                 |
| 2026-03-03 | Tue | Due     | GAIE-05             | LM05 | Before Lec 12                      |
| 2026-03-03 | Tue | Release | Mini-project        | MPRO | Teams assigned; specs posted       |
| 2026-03-05 | Thu | Release | GAIE-06             | LM06 | Hypothesis testing                 |
| 2026-03-07 | Sat |         | SPRING BREAK        |      | Mar 7–15, no classes               |
| 2026-03-17 | Tue | Due     | GAIE-06             | LM06 | Before Lec 14                      |
| 2026-03-23 | Mon | Due     | Mini-project        | MPRO | Code + report, 8 AM                |
| 2026-03-24 | Tue |         | Mini-proj orals     | MPRO | Scheduled in lab/OH, week of 3/24  |
| 2026-03-24 | Tue | Release | GAIE-07             | LM07 | Regression/modeling                |
| 2026-03-31 | Tue | Due     | GAIE-07             | LM07 | Before Lec 18                      |
| 2026-04-03 | Fri | Release | Final project       | FPRO | Single proposal specs + team assign |
| 2026-04-06 | Mon | Due     | Single proposal     | FPRO | 8 AM; 5% of project grade          |
| 2026-04-06 | Mon | Release | Full proposal       | FPRO | Full proposal specs posted         |
| 2026-04-13 | Mon | Due     | Full proposal       | FPRO | 8 AM; 10% of project grade         |
| 2026-04-20 | Mon |         | NO CLASS            |      | Patriots' Day                      |
| 2026-04-30 | Thu |         | LAST DAY            |      | All GAIEs hard deadline            |
| 2026-04-30 | Thu | Due     | Final report + code | FPRO | Soft deadline (no penalty)         |
| 2026-05-01 | Thu |         | STUDY PERIOD        |      | May 1–3                            |
| 2026-05-03 | Sun | Due     | Peer review         | FPRO | Team contribution eval, 8 AM       |
| 2026-05-04 | Mon | Due     | Final report + code | FPRO | Hard deadline, 8 AM (late -10%)    |
| 2026-05-05 | Tue |         | ORAL INTERVIEWS     | FPRO | Final exam block for DS-100        |
| 2026-05-08 | Fri |         | FINALS END          |      | Last possible oral date            |

### Notes

**GAIEs:**

- LM-00 and LM-02 have no GAIEs (by design).
- LM-04 has only one lecture (Thu Feb 19) because
  Tue Feb 17 follows a Monday schedule.
  GAIE-03 is due before that Thursday.
- LM-05 has two GAIEs (04 and 05).
  GAIE-04 prepares for the probability block
  (Lec 10–11).
  GAIE-05 prepares for the sampling block
  (Lec 12–13).
- Release dates are set so students have ~5–7 days
  to complete each GAIE.
- All GAIEs must be submitted by 2026-04-30 (last
  day of classes) to receive a final grade.
- Late GAIEs still count for completion but do not
  restore preparation value for that week.

**Mini-project:**

- Spring break (Mar 7–15) falls within the
  mini-project window.
  Students have Week 7 (4 class days) + break +
  Week 8 (full week) to complete.
- Due Monday 8 AM to give students the weekend.
- Oral verification during the week of Mar 24
  (scheduled in lab slots and office hours).
- Late submissions up to 48h with -10% penalty.
  Not accepted after 48h.

**Final project:**

- Released in Lab 10 (Apr 3) so teams can start
  during structured lab time.
- By single proposal (Apr 6): students have
  regression (Lec 18–19).
  Enough to propose a dataset, question, and
  sketch an approach.
- By full proposal (Apr 13): students also have
  classification and evaluation (Lec 20–21).
  Enough to specify a full analysis plan.
- Soft deadline Apr 30 (last day of classes, no
  penalty).
  Hard deadline May 4 8 AM (late policy: -10%
  from Apr 30 to May 4; not accepted after May 4).
- Peer review (team contribution evaluation) due
  May 3 — after the study period begins, before
  hard deadline.
  This gives teams time to reflect after submitting.
- Oral interviews during finals block (May 5 is
  the DS-100 exam slot; additional dates through
  May 8 if needed).
- Individual oral multiplier applied to final
  project grade (0.8 / 1.0 / 1.1).
- Peer review multiplier also applied
  (0.8 / 1.0).

---

## Blackboard / LMS Mapping

- Create lecture folders for Tue/Thu each week.
- Create one discussion/lab folder per week with
  verification materials.
- Each "Release" row in the calendar above = open
  the Gradescope/Blackboard link on that date.
- Each "Due" row = close the submission link at
  8 AM on that date.

---

## Known Drift from Fall 2025 (Reference)

See `reference_fa25_schedule_outline_midsemester.md`
for mid-semester pacing changes, checkpoint removals,
and lessons learned.

Spring 2026 design intentionally:

- Blends stats + coding earlier
- Increases hands-on typing and verification
- Reduces reliance on copy/paste from GenAI

---

## Change Log

- 2026-02-02: Full rewrite. Marked Lec 03/04 as
  canceled in spine; shifted LM-01 to Lec 05 and
  LM-02 to Lec 06. Added single chronological
  student-facing calendar with release and due dates
  for all GAIEs, mini-project, and final project.
  Removed stale "Open Design Question" section (now
  resolved by LM-07 content). Updated semester phases
  to match actual module/week mapping. Removed
  redundant assessment timing section. Updated lab
  Focus column to show actual lab format names.
- Initial Spring 2026 execution plan drafted from
  Phase 1.2 redesign.
