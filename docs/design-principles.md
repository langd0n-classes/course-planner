# Design Principles

These principles guide every feature decision in the
course planner. When in doubt, check your work against
these.

## 1. The app IS the workspace

This is not a data entry form that produces downloads.
It is the instructor's primary planning environment.
Everything an instructor needs to see — term summaries,
Topic coverage, meeting and coursework details, module
overviews —
should be visible and interactive in the UI.

The instructor should plan, analyze, and reason about
their course inside this app. Someday it should be where
they build assignments, write lecture plans, reference
past semesters, and reason about course structure.

We are not there yet, but every decision should move
toward that vision, not away from it.

## 2. Exports are a failure state

Exports exist ONLY for feeding external systems the app
cannot replace:
- A `.docx` for Blackboard/LMS import
- A formatted prompt for GenAI content generation
  outside the system
- A term summary for the instructor's personal reference

If you're tempted to build "download as markdown" for
something, ask: should this just be a page or panel in
the app instead? The answer is almost always yes.

Exports are a concession to the systems we haven't
replaced yet, not a feature to optimize for.

## 3. What-if before commit

Schedule changes are the core use case. When an
instructor considers canceling a lecture, moving a
meeting or deadline, or redistributing Topic coverage,
they need to
**simulate the impact before committing**.

The app should always let you explore "what would happen
if..." without persisting anything. Only when the
instructor is satisfied with the outcome should they
click "apply." This what-if pattern should be the
default interaction model for any destructive or
significant change.

## 4. Gaps are more important than coverage

The coverage matrix exists to show what's MISSING, not
to celebrate what's present. Uncovered Topics, unassessed
competencies, and planning gaps (class days with no
session) are the primary signals the app should surface.

Every view should make gaps visually obvious. An empty
row in the coverage matrix, a dashed outline on an
unplanned class day, a broken line in the Topic flow —
these are the app's most important UI elements.

## 5. Topics flow through learning activities

A course is not a flat list of meetings. It is a directed
graph where Topics are introduced, practiced, and assessed
across meetings and coursework in a specific order.
Learning Modules organize those activities; they do not
own Topics directly. The app should make this flow visible.

The mental model: Topics are horizontal lines flowing left to right through
the semester. Meetings, assignments, projects, and exams are the nodes they
pass through. Coverage actions (I → P → A) are the progression. Repeating an
action may be intentional, so duplicates warn and cross-link rather than fail.
When a meeting is canceled or coursework changes, the app should show exactly
which lines break and where.

This "Topic flow" view is the app's signature
visualization and the thing that makes it a planning tool
rather than a database.

## 6. The calendar is container, activities are content

The academic calendar defines WHEN class could meet
(available time slots, holidays, breaks, and special periods). Meetings and
milestones define
WHAT happens in those slots. These are separate concepts:

- **Calendar slots**: "Tuesday Jan 20 is a class day."
  "Feb 16 is a holiday." Imported from the institution's
  academic calendar.
- **Meetings and milestones**: "Lecture 05: Programming Basics" or
  "Project 1 due." Placed
  into calendar slots by the instructor.
- **Planning gaps**: A class day with no session assigned.
  These are visible warnings, not invisible.

## 7. Generic by design

The app serves any course at any institution. Nothing
course-specific (skill codes, module names, assessment
types unique to one course) should be hardcoded.

Course-specific data enters the system through import
(JSON, CSV) or manual entry. The exemplar files in
`docs/ds100-exemplar/` show the complexity level the app
must handle, but they are reference material, not app
content.

## 8. Mock AI is a feature, not a placeholder

The mock AI service (`MockAiPlanner`) is intentionally
kept as the active implementation while workflows are
being designed. Mock responses should look realistic so
the UX can be designed and tested properly.

Real AI integration costs money and adds latency. It
should only be wired in when:
- The manual workflow is correct and complete
- The UX for displaying AI suggestions is settled
- The instructor has explicitly opted in

Until then, mocks are the right answer. They also enable
scripted demo scenarios for testing the what-if panel
without real data consequences.
