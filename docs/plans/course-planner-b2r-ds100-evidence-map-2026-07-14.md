# Course Planner B.2R DS100 evidence map

Date: 2026-07-14

Status: reviewed evidence synthesis for the B.2R contract gate

## Scope and handling

This pass used only the three operator-approved DS100 trees and excluded every
`grading/` subtree before listing or reading files:

- `/home/lwhite/loc-areas/courses/ds100/current-term/202602/`
- `/home/lwhite/loc-areas/courses/ds100/terms/202504-ds100/`
- `/home/lwhite/loc-areas/courses/ds100/terms/202601-ds100/`

The evidence is an importer exemplar, not generic product vocabulary. Counts are
profiles for realistic fixtures, not schema constraints. The current Summer 2026
tree contains hundreds of files, roughly 65 explicitly enumerated core/expansion
Topics in its current map, 18 lectures, several labs, six assessments, seven GAIEs,
and two cross-cutting projects. The production UI must still be comfortable at the
operator's approximately 150-Topic target.

## Stable Course design versus Term occurrence

| Source evidence | Target concept | Boundary | Confidence | Notes |
|---|---|---|---|---|
| `202602/course-info/course-prompt-materials/` and `202601-ds100/course-info/course-prompt-materials/` | teaching patterns, authoring templates, Artifact templates | Course/reference | high | Pedagogical framework and content conventions recur independently of dates. |
| `202602/course-info/term/lm-structure.md`, `202602/course-info/term/topic-map.md` | Learning Module, Topic identity/version, intended Topic actions | Course design adopted by a Term | medium-high | Codes and intent are reusable; delivered marks and prose locations are Term evidence. |
| `202504-ds100/lms/module-*`, `202601-ds100/lms/lm-*`, `202602/lms/lm-*` | Learning Module and Activity versions | Course design | high for identity; medium for cross-Term matching | Naming changed from `module-00..13` to `lm-00..07` and again for Summer compression. Match by explicit code/title and provenance, never directory position alone. |
| lecture/lab/GAIE/assessment files under each `lms/` tree | meeting or coursework Activity identity/version plus Artifacts | reusable definition with Term adoption | medium-high | Roles recur, while filenames (`l`, `lec`, `d`, `lab`, `gaie-e`, `gaie`) and exact content change. |
| `202601-ds100/course-info/term/ds100_schedule_instructor.md` | Term Activity occurrences, meeting ordinals, planned/delivered changes | Term | high | Enumerates Lec 01–27, Lab 01–13, cancellations, catch-up, prep, and due/release events. |
| `202504-ds100/course-info/fall/ds100-fall2025-schedule-outline.md` | Fall Term cadence | Term | high | Thanksgiving removes Thursday/Friday meetings and moves releases/deadlines. |
| `202601-ds100/course-info/term/academic-calendar.md` → `course-info/reference/academic-calendar-2025-2027.md` | Institution Academic Calendar version | Institution | high | A Term points at a shared multi-Term reference rather than copying its source calendar. |
| `202602/course-info/reference/academic-calendar-2025-2027.md` | Institution events and special periods | Institution | high | Includes holidays, recesses, session boundaries, substitute schedules, and last-class facts. |
| project directories in `202601-ds100/projects/` and `202602/projects/` | cross-cutting project Activity, milestone templates/occurrences, Artifacts | Course design plus Term dates | high | Projects have reusable descriptions/rubrics and Term-specific releases, proposals, deadlines, orals, team choices, and scope. |

The key boundary is not "file under course-info versus file under lms." It is
identity/version/adoption/occurrence:

1. A Course owns reusable Topic, Learning Module, and Activity identities.
2. Published versions capture reusable design and content intent.
3. A Term pins the versions it planned to use.
4. Scheduled meetings, exact deadlines, exceptions, and delivery corrections are
   Term occurrences or revisions.
5. Closeout may explicitly promote useful delivered changes into new Course
   versions; running a Term must not silently rewrite the reusable Course.

## Representative activity graph evidence

### Meetings and coursework are peers in the plan

Spring 2026's schedule spine distinguishes Lecture, Discussion/Lab, and Office
Hours by behavior, while retaining instructor vocabulary. It also records canceled
Lec 03/04, a snow-day cancellation of Lec 10, consolidation into later lectures,
and project work in Labs 07 and 10. See
`202601-ds100/course-info/term/ds100_schedule_instructor.md`.

Fall 2025 uses a different directory vocabulary (`lNN`, `dNN`, `gaie-eNN`, `aNN`)
but the same broad behaviors. For example:

- `202504-ds100/lms/module-01-programming-basics/l03-first-python-code.md`
- `202504-ds100/lms/module-01-programming-basics/d02-programming-foundations-lab.md`
- `202504-ds100/lms/module-01-programming-basics/gaie-e01-programming-concepts.md`
- `202504-ds100/lms/module-06-chart-interpretation-eda/exam1-course-checkpoint.md`

The importer therefore needs configurable source aliases mapped to stable behavior
families. It must not infer lifecycle solely from filename prefixes.

### Topics attach to the activity where learning happens

Summer 2026's `course-info/term/topic-map.md` records delivered Topics with prose
locations such as an L07 claims demo, an L07 jury activity, and L08 cleaning. This
is direct evidence that one Topic may be used more than once, even within the same
meeting, and that the meaningful relationship is Topic + Activity + I/P/A action.

The evidence does not consistently encode I/P/A as structured source data. Some
actions can be inferred from lecture, lab, assessment, or rubric context, but an
importer must emit a confidence/provenance warning rather than manufacture certainty.
No historical file tree proves that directory membership is Topic ownership.

### Projects are cross-cutting and milestone-rich

Summer's mini-project and final project live outside an LM and span multiple LMs.
Their project descriptions, rubrics, and oral guides live under:

- `202602/projects/mini-project/`
- `202602/projects/final-project/`

The mini-project is released around L09, due at 08:00 on June 11, and uses a later
oral-assessment slot. The final project has release, proposal, exact-time delivery,
and oral-assessment events. Spring 2026 gives the same underlying pattern a much
longer cadence:

- `202601-ds100/projects/mini-project/mini-project-description.md` reserves lab
  work before spring break and schedules later interviews.
- `202601-ds100/projects/final-project/final-project-description.md` and
  `final-project-oral-guide.md` put oral verification in the finals period.

This requires milestone roles independent of Activity type. A milestone can anchor
to another Activity occurrence (release during a lecture, work time in a lab), to
an exact date/time, or both through an explicit override. A project can have no
primary LM while carrying scope links to several LMs and Topics.

## Calendar and cadence evidence

### Fall is interrupted; Spring requires re-entry

Fall 2025's Thanksgiving week has only the Tuesday class. Thursday and Friday are
not usable, GAIE release/deadline cadence changes, and the final project is delivered
in a distinct finals-period session. Exact evidence includes:

- `202504-ds100/lms/module-12-predictive-modeling/m12-overview.md`
- `202504-ds100/lms/module-12-predictive-modeling/gaie-e13-regression.md`
- `202504-ds100/course-info/fall/ds100-fall2025-schedule-outline.md`
- `202504-ds100/course-info/fall/semester-prompt-materials/202504-2025F.md`

Spring recess, by contrast, is a full March 7–15 gap. Spring deliberately places
mini-project planning in the March 6 lab, assigns no ordinary meetings during the
break, resumes with Lec 14, and allows a longer project window. See:

- `202601-ds100/course-info/term/ds100_schedule_instructor.md`
- `202601-ds100/projects/mini-project/mini-project-description.md`

The product must represent both missing slots and pedagogical consequences. A
break is not merely a date filter: the Plan/Run workspace needs room for preparation
before it and recovery/re-entry after it.

### Finals are an explicit special period

Spring 2026 ends ordinary classes April 30, has a May 1–3 study period, a hard final
project deadline May 4, oral interviews beginning May 5, and finals ending May 8.
Fall likewise places the project delivery/presentation in finals rather than an
ordinary meeting slot. Finals therefore belong to the Term calendar but use special
meeting rules; they are neither assumed ordinary instruction nor assumed outside
the Term.

### Institution facts and offering exceptions are separate

Institution events include holidays, recesses, substitute schedules, study periods,
and finals. Term-specific evidence includes instructor absence, snow cancellation,
faculty retreat, shortened meetings, catch-up, and slot reuse. The Term materializes
from a pinned Institution Academic Calendar version, then overlays Term-only
exceptions. No instructor-wide exception model is needed for launch.

## Import profile and provenance rules

The one-way importer should stage, preview, and require confirmation. Each proposed
record carries source path, source locator when available, confidence, and warnings.

| Source pattern | Proposed record | Import behavior |
|---|---|---|
| LM overview/directory | LM identity + draft version | Match explicit code/title; flag ordinal-only matches. |
| lecture/lab/discussion file | Activity identity/version; Term meeting occurrence when scheduled | Map the instructor label to an adopted Activity Type behavior family. |
| assignment/GAIE/assessment/project file | coursework/assessment Activity identity/version | Keep subtype lifecycle and Artifacts; do not flatten into a meeting. |
| schedule spine | Term Activity adoption/occurrence and milestone dates | Preserve cancellations and moved/consolidated delivery as evidence, not deletion. |
| Topic map or canonical skills list | Topic identity/version | Preserve undelivered Topics as planned gaps. |
| prose Topic location | Activity-Topic I/P/A proposal | Require review when action or Activity match is inferred. |
| project calendars/descriptions | cross-cutting scope + milestones | Keep release, phase, work, review, submission, and oral events distinct. |
| institution calendar reference | Academic Calendar version/events/periods | Import once per Institution/version, then let Terms pin it. |
| offering narrative exception | Term exception | Never promote automatically to Institution or Instructor scope. |
| notebooks, slides, rubrics, configs, datasets | Artifact metadata/provenance | Reference or package losslessly; do not parse content merely to create a title. |

## Ambiguities the contract must preserve

These are review warnings or explicit unknowns, not reasons to reject the import:

- whether an undelivered Topic remains planned, was deliberately deferred, or was
  removed from Term scope;
- whether an unscheduled lab is synchronous, asynchronous, or simply missing its
  calendar evidence;
- the exact I/P/A action for prose-only Topic locations;
- mixed assessment modality, including oral, notebook, written, and project-based
  assessment;
- whether a GAIE or project revision is reusable Course content or a Term-only
  adaptation;
- whether a hard break is a calendar constraint, room/logistics fact, or pedagogical
  pattern;
- cross-Term identity when codes and directory naming conventions changed;
- the relation between finals-period events and ordinary meeting ordinals.

None of these justify DS100-specific fields. They justify provenance, confidence,
explicit adoption, preserved history, and a preview-before-apply importer.
