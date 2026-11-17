# Term revision, placement, and daily driver corrections

## Decisions and reasons

- Delivered revisions supply placement occupancy; delivered cancellations occupy no slot. Delivered meetings cannot enter placement, even when undated. The planned-pointer compare-and-swap also requires no delivered pointer, so delivery recorded during apply cannot be overwritten by placement.
- Past planned meetings remain unconfirmed until an instructor records delivery or cancellation. Their existing slot or instant prevents automatic placement. No clock-based delivery inference is introduced.
- Omitted Topic actions and milestones inherit from the revision selected by the requested pointer: planned edits use planned; delivered edits use delivered, falling back to planned. Explicit empty arrays remove the collection. Preview hashes the inherited content, and apply writes that same content, so a changed source requires another preview.
- Every revision snapshot validates milestone anchors before writing any rows. A source template must belong to the snapshot's base Activity version. Self links are rejected. Follow anchors require another Activity in the same Term; fixed and standalone anchors require a date. Preview performs the same checks to surface errors before apply.
- A planned edit advances only the planned pointer when a delivered pointer exists. The pointer update also guards the observed delivered pointer, so a concurrent delivered edit cannot make the lifecycle decision stale.
- Adoption and delivered Learning Module revision unique-index races are conflicts. Delivered module updates compare the expected pointer in the database, including null, and roll back the new version when the comparison loses.
- Calendar apply replaces patterns only for Activity Type versions present in the request. An empty pattern input preserves all existing patterns. Retained calendar dates are updated in place; removed dates are deleted and new dates inserted. Historical meeting and exception references therefore survive retained dates.
- Daily-driver meeting counts and ordinals exclude archived and canceled meetings. The Term's first ordered meeting pattern supplies its display zone, matching order checks. Without a zone, instant comparisons use UTC; date-only inputs remain as written. The workspace supplies today's date in the Term zone when available.
- Request routes distinguish lookup, validation, and concurrency errors by class. Lookup failures formerly identified by their message now throw `NotFoundError`. Calendar routes that historically returned 404 for all domain errors retain that behavior.
- The demo database script applies the existing seed guard before constructing Prisma. Its integration checks also verify retained meeting-slot references and a stored pattern outside the apply input against PostgreSQL.
- Client review: the typed API forwards omitted and empty lists unchanged. The daily-driver editor and effort editor already send complete collections intentionally. The mock backend inherits omitted Term revision collections, includes them in preview tokens, and preserves explicit empty arrays; master Activity revision omission behavior remains unchanged.

## Architecture notes

`src/lib/term-revision-rules.ts` exports `effectiveRevision`, `isUndatedMeeting`, and `localDate`. Placement, milestone dating, order checks, the daily driver, and Term workspace components share the applicable rules. Local wall-time-to-instant conversion remains in meeting placement and is reused by milestone dating. Milestone dating continues to date planned linked meetings; this correction does not change its planning contract.

`createRevisionSnapshot` remains the common persistence boundary for milestone validation. Revision preview reuses the same validator. No schema, migration, or dependency changes are needed.

Removed unused service exports: `reviseDeliveredLearningModuleForTerm` and `computeSessionMoveImpact`. The live delivered-module path is `createDeliveredRevision`. `computeMoveImpact` remains exported for tests of hypothetical coverage ordering: the product uses that ordering rule through `validateAllCoverageOrdering` and the live planning workflows. The shared `localDate` export moves from meeting placement into the library; it is not deleted.

## HTTP status changes

- Adoption unique-index races: 500 to 409.
- Delivered Learning Module revision unique-index races: 500 to 409. A pointer race formerly allowed to succeed now returns 409.
- Unknown milestone source template: 500 to 400. A template from another base version, or a self link formerly accepted, now returns 400.
- A follow anchor with a missing or cross-Term target: 404 to 400. Missing follow links and missing fixed/standalone dates already returned 400 at the request schema; internal revision paths now reject them before database writes too.
- Previously unhandled `ConcurrencyConflictError` instances now map from 500 to 409 in Term Activity revision preview, Term adoption preview, Term sessions (GET and POST), Term assessments (GET and POST), Term Learning Modules (GET and POST), Term impact, and Term what-if comparison.
- Other known route statuses remain unchanged, including closed-Term calendar apply returning 404.

## Review fixes

- Calendar candidates merge all stored patterns with the submitted patterns, replacing only the submitted Activity Type versions. Empty input preserves the stored patterns. Preview and apply use the same merge.
- Removal checks count distinct Term Activities across all meeting revision references, including historical revisions. Referenced calendar exceptions and legacy Sessions also block removal. Preview exposes the affected meeting count and a conflict naming all three counts. Apply returns 409 before writes.
- A stale slot id reserves its date only if the meeting has no start instant or its local start date matches the slot. Daily-driver moves select the slot on the new local date or clear the link. The server revision boundary also normalizes changed start instants using the ordered Term pattern zone, with UTC when no pattern exists.
- The daily driver and Term workspace use the browser zone when the Term has no meeting pattern. Shared `localDate` throws `RangeError` for an invalid zone. Advisory order checks and daily-driver milestone dates retain their explicit fallback from an old invalid milestone zone to the Term zone.
- Placement falls back to planned meeting detail when delivered detail is absent, and rejects slots before the injected clock's current date in each meeting's zone. Existing historical placement fixtures inject their original clock.
- Daily-driver corrections inherit milestones unless the correction edits a milestone, so cancellation and movement preserve legacy self-links.
- Revision drafts must match the Activity Type's behavior family. Milestones supplied by a request remain fully validated. Internal snapshot calls can identify inherited milestones; an unchanged inherited self-link survives cancellation, placement, or dating. Newly supplied self-links remain invalid.
- Milestone dating reads linked meetings from their effective revisions, including delivered cancellation reasons. Coursework milestone edits still advance planned revisions.
- Local destructive database operations require a `course_planner` or `cp` name prefix, or an exact explicit name confirmation. `db:reset` validates both pooled and direct URLs before Prisma runs. The container-oriented `.env.example` retains its database and uses an explicit `SEED_FORCE_DATABASE` confirmation. CI's `cp_hardening` and `cp15` names pass without confirmation.
- The unused public exports `formatMinutes`, `toTermCalendarSlotProvenanceDto`, `toActivityTopicActionSiblingDto`, and `toActivityVersionTopicActionDto` become private helpers because exported functions still use them internally. Direct tests of the removed `formatMinutes` export are removed; effort-range tests remain. `computeMoveImpact` stays exported. Placement's `dateOnly` helper is shared in `term-revision-rules`.
- The mock applies the same milestone ownership, same-Term follow target, anchor date, detail family, and lifecycle rules, and normalizes moved meeting slot links. Its next revision number is the maximum historical number plus one.
- The PostgreSQL calendar regression uses an isolated transaction and rolls back its fixture after its assertions. It verifies partial reapply with Lecture and Lab meetings and verifies unchanged database state on refused removal.
- Seed integration accepts dedicated `cp15` and `cp15_<suffix>` database names and applies the destructive database guard before connecting.
