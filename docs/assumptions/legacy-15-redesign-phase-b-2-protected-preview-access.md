# Redesign Phase B.2 — protected preview access

- **The UX review deployment may use one-click preview authentication only
  behind Vercel Deployment Protection**: The provider is available only when
  Vercel itself reports `VERCEL_ENV=preview` and the branch-scoped
  `COURSE_PLANNER_PREVIEW_AUTH` flag is exactly `true`. It signs in as the
  explicitly configured, already-seeded Instructor email so ownership checks
  remain active. Production continues to expose only configured OAuth
  providers; this is a review seam, not an alternative production auth mode.
