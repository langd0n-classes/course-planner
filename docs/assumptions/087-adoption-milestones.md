# Adoption milestone templates (#87, first build)

- Already-adopted Activities are omitted from adoption candidates and writes. A fresh preview and repeat apply therefore leave their revisions and milestones unchanged, while the existing preview token/count checks still reject stale applies.
- The preview counts every template, but its standalone warning list includes templates whose linked Activity is absent from both the Term and the selected adoption, archived in the Term, or the template’s own Activity. Archived Term Activities still count as already adopted. Archived targets and self links produce standalone milestones without a link. Unlinked templates need no missing-link warning.
- Adoption reads templates in sequence order and resolves anchors after creating all selected Term Activities. Template content participates in the preview token so a changed template requires another preview.
- The Term workspace has an Activity adoption panel after Learning Module adoption. It previews all planned Learning Module versions together, then requires an explicit apply. This lets instructors review unresolved links and resolves links across selected modules.
- The generic exemplar importer accepts milestone templates with stable Activity-code links, resolves them after allocating all Activity identities, and writes them only for newly imported versions. Repeat imports and existing demo Terms retain their content.
- The demo uses two coursework Activities with release and due templates anchored to a meeting in their own module. One also has an unlinked review template. A Model Comparison Studio meeting supplies the second module's anchor. UTC, a seven-day due offset, and generic labels keep the example independent of an institution. These defaults are stored on templates; adoption does not calculate dates or copy relative offsets into Term milestones.
- The importer sets no provenance on templates; new Term milestones identify their source through sourceTemplateId. Adoption copies only the requested content fields and leaves milestone provenance null.

## Correction after merge (2026-11-16)

- The first build created a `standalone` milestone with no date for a template
  that had nothing to follow. The database rejects that row: the check
  `term_activity_milestones_anchor_policy_check` requires a `standalone`
  milestone to have a date. The demo load failed on it. The unit tests used a
  mock transaction and did not see the check.
- Adoption now creates a milestone only when it can follow a Term Activity. A
  template with no link, a link to an Activity that is not in the Term or is
  archived there, or a link to its own Activity creates no milestone. The
  preview lists each one with the reason, and `milestoneCount` counts only the
  milestones that will be created. The instructor adds such a milestone by hand
  with a date.
- Statements above that a template "gets no link and `standalone`" are replaced
  by this rule.

## Architecture notes

`term-activity-service.ts` loads ordered Activity Version milestone templates for adoption. Preview excludes already-adopted Activities and reports each candidate's milestone count and missing-anchor warnings. Apply creates all Term Activity identities first, then creates the first planned revisions. A template creates an undated `follow_activity` milestone only when it can follow another unarchived Term Activity among the existing or newly created Activities. A template with no link, a self-link, or no available Term Activity creates no milestone. Existing transaction timeouts and stale-preview checks remain in force.

`POST /api/terms/[id]/adoption-preview` serializes the extended response through `toTermAdoptionPreviewDto` in `redesign-serializers.ts`. `redesign-contract.ts` defines the milestone count and `notCreatedMilestones` fields, and `redesign-api-client.ts` exposes those types to UI callers. `ActivityAdoptionPanel`, rendered by `TermWorkspacePage`, previews the planned Learning Module selections and shows milestone counts and missing-link reasons before applying.

The generic snapshot in `exemplar-import-service.ts` includes two coursework template sets and same-module meeting anchors. Its importer resolves stable Activity codes to template links after creating Activity identities. `demo-course-service.ts` uses this imported content in its existing current-Term adoption transaction; its next Term remains unadopted. The database smoke script checks four undated Term milestones and repeat-load stability. No schema or migration changes are required.
