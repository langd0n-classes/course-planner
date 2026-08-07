# BUILD PROMPT — Fable capability build: course-planner

Repo: `langd0n-classes/course-planner` · you have local filesystem access to the repo root.
Branch convention: `feat/<issue>-<slug>` (or `feat/<slug>` for un-issued work), branched off `main`.

## 0. What this is (read first)

This is **two things at once**:
1. A real build — take course-planner from its current state to a materially better, more capable app.
2. A **capability assessment of you (Fable)** — we want to see how far you get running autonomously
   over a long session: your design judgment, your discipline, your initiative, your self-review.

So: **be ambitious, make and defend real design decisions, and leave a rich trail** (see §6). Don't
sandbag to be safe, and don't cut corners to look fast. Build like a strong senior engineer who's been
handed a well-specced project and trusted to run with it.

**Autonomy contract:** human review (Langdon) is an *eventual* gate you do **NOT wait for**. Review
your own work rigorously, open the PR, and immediately move to the next branch. **Never merge to `main`
yourself; never force-push.** If you'd normally stop to "ask for review," instead: write down the
decision and your reasoning in the BUILD-LOG (§6), make the call, and keep going.

## 1. Preflight

1. Read, in the repo: `CLAUDE.md`, `AGENTS.md`, `ASSUMPTIONS.md`, `ARCHITECTURE.md`,
   `docs/design-principles.md`, `docs/phase-roadmap.md`, `docs/course-planner-requirements.md`, and the
   `docs/ds100-exemplar/` reference. Internalize the 8 design principles — they are binding.
2. Read the existing build prompts already attached to GitHub issues **#5 (Phase 2B.2 Skill Flow
   Visualization)** and **#6 (Phase 2C External-System Exports)** — those are your specs for Stage 1.
3. Establish a baseline: install deps, run the test suite, run the build. **Heads-up: CI on `main` has
   been failing since late May 2026** — determine whether that's a genuine code break or stale CI config.
   - If `main` is *genuinely* broken locally (build/tests fail), your **first branch** is
     `fix/green-baseline`: get build + tests green, commit, open a PR, *then* proceed. Do NOT build new
     features on a broken base.
   - If it's only CI-config noise and the app builds/tests fine locally, note that in the BUILD-LOG and
     proceed. Either way, record the starting test count.
4. Current state for reference: MVP + Phase 2A + Phase 2A.3 + Phase 2B.1 + Google OAuth are **done**.
   Everything below is new.

## 2. The build loop (work these in order; each stage = its own branch off `main`)

### Stage 1 — Finish the well-specced work (prove baseline competence)
- **2B.2 Skill Flow Visualization** (issue #5): build per that issue's prompt and **design principle #5**
  (skills as horizontal lines flowing L→R through sessions; I→P→A progression; **broken lines where
  sessions are canceled**) and **#4** (gaps are the point — uncovered skills are prominent empty rows).
  Owns `src/app/terms/[id]/flow/` and `src/components/flow/` (new files). Branch, build, test, commit
  incrementally, open PR `Closes #5`. Do not merge.
- **2C External-System Exports** (issue #6): build per that issue, honoring **design principle #2**
  (exports are a *failure state* — only for systems the app can't replace: Blackboard `.docx`, term
  summary markdown, GenAI content prompt). New branch off `main`, build, test, PR `Closes #6`.

### Stage 2 — The ambitious thing (show range: Phase 3, real AI)
New branch off `main`. Design **and** build the real `AiPlanner` (Anthropic/Claude) to replace/augment
`MockAiPlanner` for redistribution suggestions, coverage-gap analysis, and course-design reasoning.
- **Honor design principle #8:** mock stays the **default**; real AI is wired **behind an explicit
  opt-in flag/config**, off by default. Never call the real API in tests (mock it). Read the key from
  env/config (`ANTHROPIC_API_KEY`); if it's absent, the real path should be wired-but-dormant, and the
  app must still run fully on mocks. Do not hardcode secrets or rack up API cost.
- This phase has **no pre-written spec** — that's deliberate. Design it: define the provider interface,
  prompt construction from real course context, response shaping into the existing suggestion UI, error/
  latency/timeout handling, and a fallback-to-mock path. **Document the design and the alternatives you
  rejected** in the BUILD-LOG. File a GitHub issue for it first (title `Phase 3: Real AI Integration`)
  so the work is tracked, then PR against it.

### Stage 3 — Emergent ideas (show initiative: 1–2 of them)
As you build, you'll see opportunities — from the roadmap's future phases (4: content authoring, 5:
history/search/comparison) or your own. **Pick the 1–2 highest-value ideas that genuinely fall out of
the work** (not busywork). For each: open a GitHub issue stating the idea + why it matters, then a new
branch off `main`, build/test/commit, open a PR. In the BUILD-LOG, record what you considered and why
you chose these over the alternatives — that judgment is part of what we're assessing.

## 3. Working discipline ("defended", like a junior-dev-team lead)
- **One branch per effort, always off `main`.** Never stack unrelated work on one branch.
- **Small, incremental, conventional commits** (`feat:`/`fix:`/`test:`/`docs:` … `(#N)`), pushed as you
  go — so nothing is lost if you're interrupted.
- **Test before every commit that claims to work:** run the relevant tests + lint + build. Add tests for
  new logic (the repo values this — 61 unit tests today; keep that discipline). Keep CI green.
- **Open a PR per branch** (title <70 chars; Summary / Files changed / Verification; `Closes #N` where
  applicable). Then **move on — do not wait for review, do not merge.**
- **Never break existing features.** Work additively; if you must change shared code, keep behavior for
  everything else intact and covered by tests.

## 4. Guardrails / must-nots
- Do **not** merge to `main`, force-push, or rewrite shared history.
- Do **not** change the default AI to real (principle #8) or call paid APIs in tests.
- Do **not** hardcode course-specific data (principle #7 — generic by design) or secrets.
- Do **not** delete/rewrite working features to "clean up"; keep scope additive.
- Stay inside `langd0n-classes/course-planner`. Don't touch other repos or the operator's wider system.

## 5. Definition of a good outcome
Multiple clean PRs (2B.2, 2C, Phase 3, 1–2 emergent), each green, tested, self-reviewed, and NOT merged;
the app still runs on mocks by default; the design principles visibly honored (a real, legible skill-flow
view; gaps surfaced everywhere; what-if intact); and a BUILD-LOG that lets us judge how you worked.

## 6. The assessment trail — `docs/BUILD-LOG-fable-2026-07.md`
Create and continuously update this file (commit it on each branch, or on a `docs/fable-build-log`
branch). For each stage capture, briefly and candidly:
- **What you built** and how it maps to the design principles.
- **Key design decisions + the alternatives you rejected + why.**
- **What you tested and the results** (numbers).
- **Emergent ideas** you considered, which you pursued/deferred, and your reasoning.
- **Self-assessment:** confidence level, known-shaky areas, what you'd do with more time, anything you
  were unsure about and decided anyway (with your reasoning).
Be honest about limitations — a candid "here's what I'm unsure about" is more useful to us than polish.

## 7. Completion
When done (or when you sense you're near the end of your runway): ensure every branch is pushed with an
open PR, the BUILD-LOG is current, and post a short wrap-up comment on the most relevant issue linking all
PRs with a one-paragraph self-summary. If `tg-notify` exists, send one ambient completion note; otherwise
just leave the trail. Do not silently stop — always leave enough that we (or another agent) can continue.
