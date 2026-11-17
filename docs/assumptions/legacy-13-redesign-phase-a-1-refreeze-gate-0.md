# Redesign Phase A.1 refreeze (Gate 0)

- **Seed uses Path A (split write), not a simplified compound key**: The
  nested `Term.learningModules.create` failure under `Term.create` is a
  Prisma nested-write ordering limitation, not a schema defect — the
  `TermLearningModule` FK to `Term` is intentionally the compound
  `[termId, courseId] -> [id, courseId]` per v2's Course-scoping design. The
  seed now creates the `Term`, then the `TermLearningModule`, as two
  top-level calls sharing the resolved `term.id`.

- **`assessmentType` is a string, not an enum, everywhere in the stack**:
  Prisma schema, the frozen contract (`redesign-contract.ts`), and the
  legacy `api-client.ts` all use `string`. GAIE is real seed/UI data for the
  ds100 exemplar, not app vocabulary — enumerating it in the schema would
  hardcode one course's structure into a generic tool (OPS.md's generic-app
  rule).

- **Term lifecycle is a tri-state enum plus `closedAt`, not derived from
  dates**: `startDate`/`endDate` describe the academic calendar, not
  instructor intent. An instructor may want a Term marked `closed`
  (read-only) before its end date, or reopen a past-dated Term to fix a
  mistake. `status` + `closedAt` make that intent explicit and queryable.

- **Calendar capacity and Session instructional mode are advisory-only,
  not enforced anywhere in Phase A.1**: They're informational fields with
  defaults (`normal`/`baseline`, `standard`) that nothing currently reads.
  The heuristic that would set them automatically from academic calendar
  proximity is explicitly Phase B+ work; Phase A.1 only proves the fields
  round-trip through the seed.

- **Delivered-pointer mutation is a command, not a field**: Removed
  `deliveredLearningModuleVersionId` from `UpdateTermLearningModuleRequest`
  and added a typed `CreateDeliveredRevisionRequest`/`Response` command
  instead (types + 501 stub only). Advancing the delivered pointer without
  creating an immutable revision would let a client silently repoint a
  Term's delivered curriculum at an unrelated version, breaking the
  planned-vs-delivered diff's invariant that the delivered pointer always
  names a revision that was actually created during that Term's delivery.

- **Legacy Module/Skill routes are retired (410), not reimplemented as
  stubs**: `/api/modules*`, `/api/skills*`, the old JSON/CSV import routes,
  and the old artifact export route have no place in `CanonicalRoute` — they
  addressed a data model (`Module`, `Skill`, `AssessmentSkill`) that no
  longer exists in the schema. A typed 501 stub implies "not yet built
  against this contract"; 410 with `legacy_route_retired` says "this
  contract is gone," which is the true state. The ad-hoc calendar import
  route is retired for the same reason: Institution/AcademicCalendar
  materialization (`/api/academic-calendars`) supersedes it.

- **Bare `/api/sessions`, `/api/coverages`, `/api/assessments` are retired,
  not promoted to canonical**: The Phase A.1 canonical route list only adds
  the Term/Session-nested forms (`/api/terms/[id]/sessions`,
  `/api/sessions/[id]/coverages`, `/api/terms/[id]/assessments`). The old
  bare list routes were Module/Skill-scoped by construction (their `where`
  clauses filtered on `termId`/`moduleId`/`skillId` against removed
  models) and have no schema-compatible meaning as global collections.

- **`src/app/page.tsx` is a placeholder shell, not deleted**: It was the
  only server-rendered page directly querying Prisma fields removed by the
  redesign (`Term.instructor`, `Term.courseCode`). Deleting it would break
  the root route; rewriting it is Lane C's job. A minimal static shell lets
  the branch build without pre-empting Lane C's UI decisions.

- **The Artifact API exposes generator provenance and metadata**: Phase B
  found that the frozen `ArtifactDto` omitted `generatorKey`, `generatedAt`,
  and `metadata` even though the accepted schema and lossless package design
  require them. The DTO correction is additive and keeps those create fields
  optional. Without it, generated material could be stored and exported but
  not faithfully read back through the canonical API.

- **The B.1 cockpit adds three read-only canonical query routes**: Real UI
  wiring exposed mock-only lookup gaps for the current authenticated Instructor,
  all Topic prerequisite edges in a Course, and a referenced Topic Version by
  ID. `/api/instructors/me`, `/api/courses/[id]/topic-prerequisites`, and
  `/api/topic-versions/[id]` are additive read surfaces with ownership checks;
  they do not weaken the frozen mutation contracts or authorization boundary.
