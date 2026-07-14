# ADR-0003: Pin Course design and revise Term delivery separately

- **Status:** accepted 2026-07-14
- **Date:** 2026-07-14
- **Deciders:** Langdon White, course-planner coordinator (Mimir review)

## Context

ADR-0002 moves the planning seam from direct Topic-to-Learning-Module ownership
to learning activities. The remaining decision is how reusable Course design,
Learning Module ordering, active-Term corrections, and historical truth share that
graph without becoming one universal nullable record or silently rewriting future
Terms.

DS100 evidence shows the same broad activity identities recurring with different
content, calendars, labels, ordinals, cancellations, and project milestones. The
active-Term workspace also needs fast inline correction with a planned-versus-
delivered comparison. This is a **product** decision: it determines whether the
application can be both a Course designer and a daily driver.

## Options considered

1. **Extend the current LM Topic snapshot** — preserve `TermLearningModule` planned
   and delivered pointers and add Activities beside Topics. This is the smallest
   migration but retains the ownership model ADR-0002 superseded.
2. **Version one aggregate Course-plan graph** — publish a complete Course snapshot
   containing every LM, Activity, Topic action, and milestone template. Historical
   consistency is simple, but every local edit republishes a large graph and
   cross-cutting Activities make aggregate ownership awkward.
3. **Version reusable identities independently, then pin them into a Term** — Course
   Activity versions hold reusable design; LM versions order Activity versions;
   a Term pins its plan and records immutable delivery revisions. This adds an
   explicit adoption seam but matches the product's Course/Term boundary.

## Decision

Choose option 3.

- Course-scoped Topic, Learning Module, and Activity identities have immutable
  published versions and mutable drafts.
- A Learning Module version orders Activity versions. It does not snapshot Topics.
- A cross-cutting Activity can remain outside any Learning Module and carry
  independent LM/Topic scope links.
- A Term adopts an Activity version into a shared `TermActivity` planning identity.
  It pins the planned version and the adopted Activity Type version/label.
- Active-Term changes create immutable, Term-scoped delivery revisions. They never
  advance the Course Activity's current version implicitly.
- Meeting, coursework, and assessment detail remains in explicit subtype records
  behind the shared Activity/TermActivity identity.
- Topic I/P/A relationships are versioned children of Course Activity versions and
  are copied into Term delivery revisions when the delivered use changes.
- Milestone templates are versioned children of an Activity version. Term milestone
  occurrences may follow another Term Activity, use an exact instant, or retain a
  contextual Activity link while staying fixed to an instant.
- Term closeout may explicitly promote selected delivered revisions into new Course
  Activity drafts. Promotion is preview-before-apply and never automatic.

## Why

The Course version says "what I intend to reuse"; the Term pin says "what I planned
this time"; the delivery revision says "what actually happened." Those are distinct
facts in the DS100 evidence and distinct tasks in the UI. Combining them makes a
mid-semester fix either corrupt reusable design or disappear from history.

Independent versions avoid republishing an entire course because one assignment
changed, while LM-version membership still creates a coherent ordered design for
normal activities. Explicit Term adoption handles cross-cutting projects and
offering-only work without inventing a fake Learning Module.

Revisit this decision if concurrent multi-instructor Course-plan publication needs
an atomic whole-graph release, or if real imports repeatedly produce inconsistent
sets of independent current versions. At that point an aggregate `CoursePlanVersion`
may be justified as a manifest over the same version nodes, not as a replacement
for their identities.

## Consequences

- `LearningModuleVersionTopic` and direct `Topic.learningModuleId` leave the target
  contract.
- Current planned/delivered LM pointers become migration inputs, not the final
  delivery-revision mechanism.
- Term creation/adoption must pin versions explicitly and validate that LM members
  use the Activity versions named by the LM version.
- Inline delivery edits require optimistic revision checks and an apply command;
  generic PATCH cannot mutate published or historical snapshots.
- Closeout gains a meaningful review flow: compare plan to delivery, then selectively
  promote evidence-backed changes into the next reusable design.
- A future aggregate Course release remains possible as a thin manifest if actual
  collaboration or consistency pressure earns that complexity.
