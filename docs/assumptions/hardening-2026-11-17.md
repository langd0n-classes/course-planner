# Hardening decisions — 2026-11-17

- Measure the 400-day limit as elapsed UTC days between the two dates. Exactly 400 days is allowed; calendar iteration includes both endpoints. This keeps the limit independent of daylight saving time.
- Accept date strings as well as Date values at Term service boundaries. Routes preserve the original date text so that JavaScript cannot silently turn an impossible date such as February 30 into a valid March date. Date objects are checked for a finite timestamp.
- Reject duplicate codes in creation and clone previews as well as writes. A preview should describe a target that can be applied. Updates exclude the current Term from the duplicate check; archived Terms still reserve their codes because the database key includes them.
- Validate partial date updates against the stored counterpart, but write only supplied dates. A name-only edit must not overwrite dates read earlier in its transaction.
- Use ConcurrencyConflictError for duplicate codes and attached-reference removal blockers. Existing HTTP helpers map this error to 409. Check codes inside transactions and translate Prisma P2002 for races after the check.
- Add an owned service-level removal preview with counted Sessions and Term Activities, following the existing blocker shape. Count archived Activities too: their foreign keys still preserve history. Use the same preview inside removal so its message matches the refusal.
- Return calendar validation and read-only errors as 400; preserve 404 for missing resources. This follows other Term writes and exposes the new duration validation through preview and apply routes.
- Parse force-seed targets with URL and decode the database pathname before exact confirmation. Missing or malformed URLs fail closed with a message that contains no supplied URL. IPv6 loopback uses the bracketed hostname produced by URL.
- Keep the force-seed guard in a separate pure module so tests do not import the executable seed or create a Prisma client. Run its tests under scripts/, which the existing Vitest configuration discovers.
- Use a PostgreSQL service health check and set both Prisma URL variables in CI. Migrations require the unpooled URL even though a local service has no pooler. The runner's PostgreSQL client creates cp15 after the demo checks.

## Architecture notes

Term date parsing, ordering, duration checks, and code-conflict handling live in a shared service helper. Creation, updates, cloning, legacy calendar materialization, and adopted-calendar previews use it before building date sequences. The schema and frozen client contract do not change.

Calendar apply checks ownership and closed status before computing its preview or changing meeting patterns and slots. Open-Term calendar materialization retains its existing behavior.

The CI database job runs independently of the existing test job. It checks migration/schema parity and the demo database on cp_hardening, then migrations and destructive seed behavior on a separate cp15 database.
