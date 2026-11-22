# Topic module independence (#91)

- Learning Module Topic snapshots validate Course membership only. The snapshot
  link itself records module membership; a Topic can serve several modules.
- Learning Module removal previews count distinct Topics linked across all module
  revisions. The `topics_assigned` blocker reports that count because snapshot
  foreign keys restrict deletion and removal does not clear those links.
- Planning emits no warning for coverage outside a module's Topic snapshots.
  Topics belong to Courses and can span several Learning Modules.
- Delete the unused `buildTopicBrowserBuckets` helper and its unused bucket type.
- Remove the legacy ownership field from Topic DTOs and create/update contract
  types as well as serializers. It no longer describes an application relation.
  Other entities' `learningModuleId` fields retain their meaning.
- Topic `learningModuleCode` is optional and nullable in the exemplar import
  contract. Topic forms and REST schemas already omit this field and require no
  new controls or display fallback. The source-specific DS100 extraction script
  still records the source's module labels; no code snapshot is regenerated.
- Keep the nullable database column unchanged for the later removal migration.
  Default seed and demo creation use the corrected Topic creation/import paths.
- Use a syntax-tree regression guard for Topic Prisma call arguments, nested
  Topic selects, known property reads and contract types. Scan application
  sources, `prisma/seed.ts` and `scripts/`. Call boundaries prevent matches
  against another model's fields. Arbitrary aliases and computed property
  access remain outside this narrow guard.

## Architecture notes

`revision-service` creates Course-owned Topics without module ownership writes
and validates module Topic snapshots by Course. `exemplar-import-service` accepts
Topics without `learningModuleCode` and omits the legacy ownership column on
insert; the seed and demo services use these same paths. `redesign-mock-backend`
creates the same Topic shape. Topic contracts and `redesign-serializers` omit
`learningModuleId`; Topic routes continue to use those serializers.

`archive-removal-service` blocks module removal when version snapshots link
Topics, counting distinct Topic identities across revisions. Snapshot foreign
keys restrict deletion, and removal does not delete the links.
`planning-service` emits no out-of-offering Topic warning.
The unused `buildTopicBrowserBuckets` helper and its unused bucket type are deleted.
The Course workspace's secondary `TopicBrowser` remains Course-wide.
Topic forms and code suggestions retain their existing behavior. The nullable
Prisma column remains until its separate removal migration.
