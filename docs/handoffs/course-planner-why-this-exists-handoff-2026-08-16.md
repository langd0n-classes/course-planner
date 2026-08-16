# Handoff: Course Planner rationale evidence pass — 2026-08-16

## Current state

The active work is the operator evidence pass in:

`/home/lwhite/loc-projects/course-planner/docs/why-this-exists.md` on **x1**.

As of this handoff, x1 has 31 uncommitted added lines in that file. They are
intentional operator work and must be preserved. Do not run `git restore`,
`git reset`, or a pull that overwrites the file before the operator chooses to
commit or otherwise preserve it.

The x1 checkout also has an untracked `.vscode/` directory; treat it as local
editor state unless the operator says otherwise.

## What the operator is doing

The document is deliberately in raw-evidence mode, not prose-editing mode. The
operator has started the first narrative section with concrete live-course
failure modes:

- lost instructional time from snow, injury, delayed starts, broken room
  technology, prior room occupants, or an activity taking longer than expected;
- deciding whether to continue content, cut/rebuild an activity, compress later
  work, or rely on later coverage; and
- the need to understand downstream coverage impact rather than merely move a
  calendar entry.

The operator explicitly said they plan to complete the whole document before a
proper review. Do not interrupt the evidence pass with line editing, document
reorganization, or a premature blog draft.

## Document structure clarification

The six-part `Operator narrative pass` at the top is a guide for gathering
evidence. The existing four tool categories remain lower in the document under
`## How the tools fail, by cluster`:

1. PM-shaped — Asana, Notion, spreadsheets
2. LMS-shaped — Blackboard, Gradescope, Canvas
3. Curriculum-mapping-shaped — Coursetune, Watermark, Nuventive
4. Post-GenAI — prompting for a plan

The operator added the two guiding questions beneath the categories on x1:

1. What job is this category actually designed to do?
2. What happens when it is asked to preserve and revise a live course plan?

This temporary separation between the top-level outline and the detailed
categories is acceptable during evidence capture. Consolidate it only in the
later full review.

## Working thesis

Course Planner is not an LMS or a course-design generator. It is the operational
planning layer between course design and LMS delivery. It preserves intended
structure, records actual delivery, and helps an instructor simulate the impact
of the next change before committing it.

Strong public formulation, for later use:

> A course plan has to survive contact with the course.

Avoid saying the product "runs a course" without qualification; it runs the
**plan** while the course is moving. It does not own enrollment, students,
grades, or content delivery.

The earlier "roughly 87 tools" claim was corrected to "many tools,
spreadsheets, and approaches." Do not restore a precise count unless a real
inventory is recovered.

## Next session

1. Let the operator finish raw answers in `why-this-exists.md`, especially the
   markdown/git workaround, closest near-miss, post-GenAI failure, and precise
   product boundary.
2. When the operator says the evidence pass is complete, run one structured
   review to separate:
   - canonical product rationale;
   - operator evidence that supports it;
   - material for the future blog post, working title: **The Missing Layer
     Between Course Design and the LMS**; and
   - claims needing source verification or removal.
3. Only then decide the blog attribution level and draft route. Do not copy the
   product rationale directly into a blog post.

## Related publishing context

The immediate thought-leadership quick release candidate remains
`Narration Is a Content-Scope Bug` (AI-G) after operator review of its sanitized
example and attribution approval. `STE100 for Agents` is the next AI-G quick
candidate; `Codex Async Inbox` needs a more attentive technical review. The
new Commission-boundary essay supersedes the old Buzz/bus-versus-runtime thesis
and remains a separate AI-C architectural piece.

## Environment notes

- `ssh x1` resolves to a stale public address. Use
  `ssh x1g12.home.fishjump.com` from p1.
- p1's Course Planner checkout currently has unrelated pre-existing untracked
  paths: `.agents/`, `docs/plans/course-planner-gate-0-checkpoint-2026-07-12.md`,
  `docs/prompts/fable-capability-build-2026-07.md`, `production`, and `skills/`.
  Do not commit them as part of rationale work without separate review.
