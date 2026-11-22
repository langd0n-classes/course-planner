# Phase 2A.3 — Redistribution & Polish

### Redistribution UI

- **Redistribution step is optional**: After choosing to cancel a session, the instructor sees at-risk skills (unique coverage) with dropdowns to pick target sessions. They can redistribute, skip redistribution, or partially redistribute.

- **dryRun validation via cancel endpoint**: The cancel endpoint accepts a `dryRun: true` parameter that runs all validation (including ordering checks) without persisting the cancellation. This avoids duplicating validation logic in a separate endpoint.

- **AI suggestion is mock-only**: The "Suggest Redistribution" button calls a mock AI service that uses same-module preference, related-category preference, and round-robin distribution. No real AI provider is integrated.

- **Empty cell interactions use a modal**: Clicking an empty calendar cell (class_day with no session) opens a modal with "Create new session" and "Assign existing session" options, rather than inline editing.

- **WhatIfPanel is a shared component**: The what-if panel was extracted from the calendar page into `src/components/WhatIfPanel.tsx` and is reused on both the calendar view and the term detail page.

- **Non-at-risk skills shown collapsed**: Skills with `uniqueCoverage: false` are shown in a collapsed "Also covered elsewhere" section rather than the main at-risk list, to reduce noise.

### API Client Cleanup

- **Typed API client is the source of truth for UI types**: Page components import types from `src/lib/api-client.ts` rather than defining local duplicates. The `as unknown as X` pattern is removed in favor of direct typed returns.

- **Coverage and assessment pages retain local types**: Some pages define extended local interfaces (e.g., `CoverageRow`) that add fields not in the api-client types. These were left as-is to avoid scope creep.
