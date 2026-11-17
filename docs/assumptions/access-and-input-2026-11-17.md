# Access and input rules

## Architecture notes

- Instructor identity comes from the authenticated session through
  `getAuthenticatedInstructor`. `GET /api/instructors` returns that Instructor
  in a one-item list. Instructor creation through that endpoint returns the
  shared retired-route response (410); sign-in provisions identity. The legacy
  Terms page shows the current Instructor and uses that identity for creation
  and cloning because ownership is determined by sign-in.
- Creating an Institution trims the name and matches it without case. An
  existing active Institution is returned and the instructor gets an active
  membership if none exists. Existing memberships, including inactive ones,
  and Institution fields are unchanged. An archived name returns 409 with
  “An institution with this name is archived.” The route retains the
  `institution` envelope and adds `created: true | false` locally; the shared
  contract stays unchanged. New Institutions return 201; joins return 200.
  A transaction advisory lock on the normalized name serializes concurrent
  create-or-join requests without a schema change.
- Instructors can belong to multiple Institutions and attach their own Courses
  to those Institutions. Membership grants no access to another instructor's
  Courses, Terms, or Activities. Each member can currently read and write the
  Institution's Academic Calendars; each instructor has separate overrides.
  Write access to a shared calendar is an open question.
- Editable JSON handlers use `readJsonBody`, including the shared Course effort
  handlers. Malformed JSON returns 400 with “The request body is not valid
  JSON.” Authentication still precedes body parsing. Retired handlers do not
  parse bodies. The Term and Term Activity route trees retain their existing
  implementations because they are outside this change's scope.
- Artifact path IDs, parent query IDs, and parent body IDs must be UUIDs. Course
  Topic and Learning Module collection path IDs must also be UUIDs. Invalid
  IDs return 400 before a database query, so they are client validation errors.
- Preview sign-in keeps the provider and configuration from `origin/main`.
  The project is before its production release, and previews stay simple.
  No preview secret or additional production rule is introduced.
- Google profiles must have the boolean `email_verified: true`. The current
  allowlist is evaluated at sign-in and each session read. A disallowed session
  has no user, so both proxy authorization and route identity lookup refuse
  access. The preview email remains an allowed identity only while preview
  authentication is enabled. Demo-mode configuration and database guards retain
  their existing behavior.
- Every response receives `nosniff`, a strict-origin-when-cross-origin referrer
  policy, frame denial, disabled camera/microphone/geolocation, and HSTS with
  `max-age=31536000`. This change adds no Content-Security-Policy; a CSP needs
  separate application resource and script policy decisions. HSTS does not
  opt into subdomains or preload because those affect deployment beyond this
  application.
- Mutating API requests with an Origin must have the same host, including port,
  as the request URL. Invalid and opaque Origins return 403. GET, HEAD, OPTIONS,
  absent Origins, non-API paths, and `/api/auth/` retain existing behavior.
  The proxy remains wrapped by Auth.js so its sign-in redirects remain active.
- Exemplar import reads at most 2 MiB (2,097,152 bytes) before parsing JSON.
  Both Content-Length and streamed bytes are checked because a request can omit
  Content-Length. Exceeding either limit returns 413. Other JSON routes retain
  their existing size policy.
- Exemplar snapshots use a strict nested schema after grading-field exclusion.
  Unknown retained fields are rejected, keeping the supported snapshot contract
  explicit. An explicit null snapshot is invalid; omitting the snapshot selects
  the generic demo. Validation reports the first problem's JSON path and returns 400.
  Topics and Activities are limited to 500 each; Learning Modules to 100;
  Topic actions to 50 per Activity; milestone templates to 20 per Activity.
  Activity Types and objectives per Learning Module are each limited to 100
  to bound the remaining collections.
- Snapshot identifiers and references are limited to 200 characters; titles,
  labels, and categories to 500; descriptions, objectives, summaries, and notes
  to 20,000; time zones to 100. Required identity strings must be nonempty.
  Milestone offsets are integral days in the range -3650 to 3650, times use
  24-hour HH:MM, and time zones must be accepted as IANA zones by the runtime's
  Intl implementation, excluding numeric UTC offsets. These bounds accommodate course planning while keeping
  imported values finite. The batch regression uses up to 100 Learning Modules
  and still checks constant database-operation counts.
- Local PostgreSQL publishes only on `127.0.0.1`. Public documents use neutral
  placeholders for private paths, hosts, and contact information. Generic
  shell locations such as `~/bin` and `~/.bashrc` remain executable conventions;
  they do not identify an operator or a private directory layout. Attribution
  trailer templates retain their prescribed text.
