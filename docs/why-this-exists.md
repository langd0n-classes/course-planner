# Why this exists

**Status: skeleton.** The evidence and prior-art findings below were gathered on 2026-08-14 and
are factual. The narrative, the history, and the voice are the operator's and are not written yet.
Sections marked TODO need something only he can supply.

---

## The thesis

Existing tools help you **design** a course. Nothing helps you **run** one while it is moving and
you are inside it.

> "live fire course running"

That phrase is the scope test. When a feature is proposed, ask which it serves. Outcome roll-up is
design-time and review-time. "Probability didn't land, redo it in week 9" is live fire.

## The search

The operator evaluated roughly 87 tools, spreadsheets, and approaches — before and after generative
AI — trying to solve course planning and design. None fit. He then built a bespoke system in
markdown and git and has run his course on it since.

That last fact matters more than the count. A costly workaround maintained for years is stronger
evidence of an unmet need than any number of tools tried and abandoned.

**TODO (operator):** the actual list, or as much of it as is worth recovering. Which one got
closest, and what specifically made you stop using it — the near-miss defines the gap better than
the far misses do.

## How the tools fail, by cluster

Four clusters, from the operator's own experience except where noted.

### PM-shaped — Asana, Notion, spreadsheets

Infinitely flexible, no domain model. The structure lives in your head, and it rots the moment the
term slips. The spreadsheet was abandoned quickly.

**TODO (operator):** what specifically broke down — was it maintenance cost, or that the structure
could not represent the thing?

### LMS-shaped — Blackboard, Gradescope, Canvas

Built for delivery and measurement, not planning.

- **Blackboard Ultra does not let an instructor author a goal at all.** You may only align to goals
  the institution has already loaded. This is why DS-100's learning outcomes live in a syllabus
  markdown file rather than in the LMS.
- **Canvas** lets you author outcomes, organizes them hierarchically, and tracks per-student mastery
  through rubrics. Evaluated and judged not to bring enough to warrant leaving the in-house
  Blackboard setup, even free.
- **Canvas freezes an outcome once it has been used for grading.** That is the opposite of what
  running a course needs, where a topic can be reopened because office hours revealed a gap.
- **Gradescope** is adjacent rather than overlapping — assessment delivery and grading.
- No LMS models **the plan as a separate revisable artifact from what happened**. Move something in
  a Canvas calendar and it is simply moved: no diff, no impact preview, no record that the plan
  changed.

### Curriculum-mapping-shaped — Coursetune, Watermark, Nuventive

Correct domain model, wrong tempo, wrong buyer. Aimed at annual program review and accreditation.

Not evaluated by the operator, and the reason is structural rather than a gap in diligence: these
are sold through institutional channels to assessment offices, not to instructors.

**Coursetune began selling in 2017 tailored to course design — helping professors "tune" their
courses.** Institutions and administrators were more interested in curriculum mapping for
accreditation, so the company redirected there. It was later acquired by Academic Partnerships.

That is the whole market structure in one data point. A company launched at the instructor-side
problem and was pulled to the buyer within a few years. The gap is real *because* it is
commercially unattractive: instructors do not hold budget.

### Post-GenAI — prompting for a plan

Produces a plausible plan once, then has nowhere to live. No state, so replanning starts from
scratch. The operator's own attempts are the `ds100` and `pantheon` repos.

**TODO (operator):** this is the newest failure mode and the one worth writing about publicly.

## The strongest evidence, from the operator's own repo

DS-100's Fall 2026 redesign plan, written months before this application could have influenced it:

> The previous fall content was built on the **old topic map** and was structurally unreliable, so
> it was archived rather than trusted as a base… Salvage from it; do not trust its sequencing…
> **Re-home each piece by topic** because the old lecture structure uses the old map.

An entire term's work was discarded because the topic map moved underneath it, and the salvage
procedure is *re-home by topic* — because topics are the stable anchor and lecture structure is not.

That is ADR-0002 and ADR-0004 stated as an operational fact rather than a design argument. If topics
were owned by modules, re-homing by topic would not be possible.

The same document describes the fall term as a clone of summer that must be "un-crashed" from a
compressed schedule into a full September–December cadence, driven by the canonical topic map and
the calendar. That is this application's core operation, being performed by hand with git branches
and folder conventions.

## What this application therefore is

The operational layer between designing a course and delivering it in an LMS.

- It owns **structure**: topics, activities, learning modules, terms, coverage, and what changed
  from plan.
- Content stays where content belongs — GitHub, Drive, the LMS.
- It never stores a row that identifies a student. See ADR-0004.
- Handoff to the LMS is by instructor-performed export (Common Cartridge, copy/paste), never by
  LTI or OneRoster integration, which requires institutional procurement an instructor cannot do.

## References

- Blackboard Ultra goals are institution-provided; instructors align but do not author:
  <https://help.blackboard.com/Learn/Instructor/Ultra/Performance/Goals>
- Canvas outcomes, rubric-mediated alignment and mastery tracking:
  <https://www.iit.edu/cli/canvas/outcomes-instructor-guide>
- Coursetune's redirection from course design to curriculum mapping:
  <https://www.edsurge.com/news/2021-09-02-is-curriculum-mapping-becoming-a-priority-for-online-college-programs>
- Curriculum mapping conventions, including I/R/M and taught-versus-assessed gap analysis:
  <https://manoa.hawaii.edu/assessment/resources/curriculum-mapping-curriculum-matrix/>
- Constructive alignment (Biggs, 1996): <https://en.wikipedia.org/wiki/Constructive_alignment>
