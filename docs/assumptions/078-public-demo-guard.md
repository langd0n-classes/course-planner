# Public demo guard (#78)

- Demo mode requires both the server variable `COURSE_PLANNER_DEMO=true` and
  the database marker table `public._demo_marker`.
- The flag conflicts with each sign-in variable: `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL`, `COURSE_PLANNER_PREVIEW_AUTH`, and
  `COURSE_PLANNER_PREVIEW_EMAIL`. A non-whitespace value causes a configuration
  error that stops the app when the guard is connected.
- No migration creates the marker table.
- The marker table is looked up in the `public` schema. A deployment that uses
  another schema must change `DEMO_MARKER_SCHEMA`.
