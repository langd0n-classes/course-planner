# Course Planner B.4.1 implementation handoff

Date: 2026-07-19

## State

- Worktree: `/home/lwhite/cloud-sync/projects/wt/34-b4-1-course-shell`
- Branch: `redesign-b4-1-course-shell`
- Base: `d222dc5` (`Add B.4 kickoff handoff for a dedicated course-planner session`)
- Status: uncommitted implementation draft; no commit, review, or test gate has been completed.
- Scope: B.4.1 Course shell and vocabulary only. B.4.2 through B.4.5 were not intentionally started.

The issue prompt is on GitHub issue #34. Use the latest `## BUILD PROMPT v3` comment; it names `d222dc5` as the base and preserves the B.3 route/client constraints.

## Draft implementation

The worktree has modified these files:

- `src/components/redesign/CourseIndexPage.tsx`
- `src/components/redesign/CourseIndexPage.test.tsx` (new)
- `src/components/redesign/CourseWorkspacePage.tsx`
- `src/components/redesign/CourseWorkspacePage.test.tsx`
- `src/components/redesign/CreateTermPanel.tsx`
- `src/components/redesign/TopicBrowser.tsx`
- `src/components/redesign/TopicBrowser.test.tsx`
- `src/lib/redesign-api-client.ts`
- `src/lib/redesign-activity-type-api-client.test.ts`
- `src/lib/redesign-workspace.ts`
- `src/lib/redesign-workspace.test.ts`

Intended behavior added or changed:

- Course creation redirects directly to `/courses/:id`.
- The Course workspace loads and creates instructor Activity Types through `redesignApi`.
- Activity Type UI exposes custom label separately from its stable behavior family and displays historical-version language.
- Topic creation/editing adds a suggested `topic-...` stable code with Tab acceptance and supports inline title/category/code/prerequisite changes.
- Term setup receives prerequisite-oriented empty states for Institution and calendar creation.
- `redesignApi.createActivityType` now obtains the authenticated instructor from `/api/instructors/me` and injects `createdByInstructorId`; `createTopicVersion` was added to the client.

## Required review before committing

1. Review the entire diff against the frozen B.2R contract and ADR-0002. The draft still uses direct `Topic.learningModuleId` state and UI controls. That may be legacy behavior superseded by the activity-first model, where Learning Modules place Activities and Topics attach through I/P/A actions. Do not accept or extend that behavior without confirming it is a permitted B.4.1 compatibility seam.
2. Confirm the Activity Type client behavior against the accepted B.3 authenticated API. The draft adds a client-side `/api/instructors/me` lookup to supply `createdByInstructorId`; verify this matches the real handler rather than papering over an API mismatch.
3. Review the expanded Course workspace component for scope drift. It changes existing Term/Institution presentation as well as the B.4.1 Course/Topic/Activity-Type concerns.
4. Inspect the new and modified tests for assertions that reflect the accepted product behavior rather than the prior Topic-led workspace.
5. Decide whether the B.4.1 design should remain in this legacy component or be rebuilt from the accepted B.2R prototype, as directed by issue #34.

## Verification status

- `git diff --check` passed.
- No unit tests, typecheck, lint, browser tests, importer seed, or Podman Node 22 build were run after these changes.
- The B.4.5 planning worktree (`redesign-b4-5-test-plan`) is clean; no Sonnet plan was persisted to disk.

## Suggested continuation

1. Read the latest issue #34 prompt plus the B.4 kickoff handoff.
2. Perform the contract/scope review above before making further edits.
3. Run focused tests for the changed components and client, then typecheck.
4. If the direct Topic-to-LM behavior is rejected, revert only that draft behavior and rebuild Topic editing around the B.4 activity-first seams.
5. Once the draft passes review and validation, commit explicit paths only with the required bot identity and attribution trailers.
