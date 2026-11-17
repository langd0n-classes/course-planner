# Phase 2B.2 — Skill Flow Visualization

- **Thread lines are CSS borders, not SVG**: The skill "thread" (design
  principle #5) is drawn with absolutely-positioned half-width border
  divs inside each table cell between a skill's first and last coverage.
  This honors the phase constraint (HTML/CSS only, no SVG/canvas) while
  still reading as a continuous line. Canceled or simulated-canceled
  sessions render their thread segment as a dashed red border — the
  "broken line".

- **Thread span is display-relative**: The line spans first→last coverage
  among *visible* columns. If a module/canceled filter hides a skill's
  outermost coverage, the thread shortens accordingly rather than pointing
  at hidden columns.

- **Flow rows are grouped by category, then code**: The grid sorts skills
  by category and inserts category divider rows. Skill codes sort
  lexicographically within a category.

- **What-if overlay is client-side and read-only**: The flow page's
  "Simulate cancellation" select calls the pure `simulateCancellation`
  from `src/domain/whatif.ts` on already-fetched data. Nothing persists;
  no API call is made (design principle #3).

- **Placeholder module groups sort last**: Sessions whose module isn't in
  the modules list (shouldn't happen, but defensive) get a placeholder
  group with MAX_SAFE_INTEGER sequence so they appear at the far right.

### Skill Flow Review Fixes

- **A broken flow thread represents lost unique coverage**: A canceled or
  simulated-canceled column is dashed red only when that cell contains a
  coverage level with no other available coverage for the same skill. Showing
  a break merely because an unrelated canceled session lies between two
  badges incorrectly implies the skill depended on that session; showing a
  break for duplicated coverage would likewise overstate cancellation impact.
  This aligns the line with the what-if unique-coverage signal while retaining
  normal lines for safely backed-up coverage.

- **Flow health borders use coverage-matrix status**: Flow's legacy
  `complete`/`partial`/`none` remains for its existing filters and labels,
  while the border color is driven by the canonical
  `fully_covered`/`partially_covered`/`uncovered` status calculated through
  `getSkillHealthStatus`. The models are equivalent for the I/P/A health
  rule, so no separate visual status mapping is needed.

- **Badge strike-through vs. thread-line breakage are different signals**:
  A coverage badge dims/strikes whenever its own session is
  canceled/simulated, regardless of whether the skill has backup coverage
  elsewhere -- it means "this entry no longer counts." The connecting
  thread *line* only renders broken/red when the skill's flow is genuinely
  at risk (its sole coverage at that level), via `doesThreadBreakAtCell`.
  A skill with redundant coverage on a canceled session now shows a
  struck-through badge on a still-unbroken thread line -- the badge tells
  you "this specific entry is gone," the line tells you "the skill is
  fine." Previously both used the same (too-lenient) signal.

- **Filtered-view summary reuses the full term's cancellation stats**:
  `summarizeFilteredFlowData` recomputes only the skill-health counts
  (fully/partially/uncovered) from the currently-visible rows -- each row's
  `healthStatus` was already computed against the full term in
  `buildFlowData`, so filtering which cells are *displayed* doesn't change
  it. `canceledSessions`, `skillsAtRiskFromCancellations`, and the other
  session-scope numbers come from the unfiltered summary unchanged:
  toggling "hide canceled sessions" is a display preference, not a claim
  that the term has fewer cancellations. Previously these were re-derived
  from the filtered session list, so hiding canceled sessions zeroed them.
