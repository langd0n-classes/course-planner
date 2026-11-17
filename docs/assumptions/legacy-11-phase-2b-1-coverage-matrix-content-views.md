# Phase 2B.1 — Coverage Matrix + Content Views

### Coverage Matrix

- **Matrix shows ALL skills**: The coverage matrix now shows every skill registered for the term, including those with zero coverage. Previously only skills with at least one coverage entry were visible, hiding gaps.

- **Health summary uses three-state model**: Skills are classified as "fully covered" (I + P + A), "partially covered" (at least one level but not all three), or "uncovered" (no coverage at all). The health bar shows all three states.

- **Canceled sessions excluded from health tracking**: Coverage entries on canceled sessions don't count toward a skill's coverage levels. The coverage entries are still visible in the matrix (for audit trail) but are not considered for the health summary.

- **Empty cell click-to-add via popover**: Clicking an empty matrix cell opens a small popover with I/P/A buttons rather than a modal or inline form. This minimizes disruption to the matrix view.

### Content Views

- **Module.notes field added**: A free-text `notes` field was added to the Module model for planning notes. This supports the "workspace" design principle — instructors can annotate modules with planning thoughts without it being formal content.

- **Session detail shows redistribution audit trail**: Redistributed coverage entries (those with `redistributedFrom` set) are shown in a separate section with orange styling to distinguish them from original coverage.

- **Skill detail uses timeline visualization**: Coverage entries for a skill are displayed as a vertical timeline sorted by session date/sequence, showing the progression through I → P → A.

- **Content views use shared components**: Breadcrumbs, CoverageBadge, StatusBadge, EditableText, LoadingSkeleton, and Toast are extracted to `src/components/` for reuse across all content views.

### Tech Debt Cleanup

- **Import page uses api-client**: The import page was the last holdout using raw `fetch()`. A new `importSkillsCsv` method with `requestRaw` helper was added to api-client to handle the text/csv content type.

- **Impact and assessment pages use shared types**: Local duplicate type definitions in the impact and assessments pages were removed in favor of types imported from `api-client.ts`. New `ImpactReport` and `ValidationItem` types were added to the api-client.
