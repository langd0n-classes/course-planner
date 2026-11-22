# Authentication

- **No auth for MVP**: Single-user local dev. Data is scoped by instructor but there's no login/password system. The UI lets you switch instructors implicitly via term ownership.

- **Multi-tenant ready**: The data model supports multiple instructors. Auth can be layered on without schema changes.

- **Single allowed Google account**: Google OAuth access is restricted by the `ALLOWED_EMAIL` environment variable, which may contain one or more comma-separated email addresses for local and deployed environments.

- **JWT sessions only**: Auth.js uses its default stateless JWT session strategy. No Prisma adapter or auth-related schema changes are added.

- **Identity routes are additive, not contract rewrites**: Learning Module and Topic detail routes use small additive update DTOs that only cover identity/archive state (`stableCode` and `archivedAt`; a Topic has no Learning Module owner since #91). Version prose still changes only through `/versions`, which preserves the immutable published-revision rule.
