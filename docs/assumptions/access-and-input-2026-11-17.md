# Access and input rules

## Architecture notes

- Instructor identity comes from the authenticated session through
  `getAuthenticatedInstructor`. `GET /api/instructors` returns that Instructor
  in a one-item list. Instructor creation through that endpoint returns the
  shared retired-route response (410); sign-in provisions identity. The legacy
  Terms page shows the current Instructor and uses that identity for creation
  and cloning because ownership is determined by sign-in.
- Creating an Institution trims the name and collapses whitespace runs before
  matching or creating, so formatting differences do not create separate names.
  Case-insensitive matches select the oldest Institution (`createdAt asc`) for
  a consistent join target. Pattern characters `_`, `%`, and `\` match literally
  so a name cannot join an unrelated Institution. Existing Institution fields
  stay unchanged because joining does not authorize editing shared identity.
  Memberships are created or set to active so a successful join grants membership.
  Existing membership defaults are preserved to avoid changing the instructor's
  chosen default. An archived name returns 409 with “An institution with this
  name is archived.” to prevent silently restoring archived data. The response
  retains the `institution` envelope and adds `created: true | false` to
  distinguish creation (201) from joining (200). A transaction advisory lock
  on the normalized name serializes concurrent create-or-join requests without
  a schema change.
- Instructors can belong to multiple Institutions and attach their own Courses
  to those Institutions. Membership grants no access to another instructor's
  Courses, Terms, or Activities. Each member can currently read and write the
  Institution's Academic Calendars; each instructor has separate overrides.
  Write access to a shared calendar is an open question.
- Editable JSON handlers use `readJsonBody`, including the shared Course effort
  handlers. Malformed JSON returns 400 with “The request body is not valid
  JSON.” This treats invalid syntax as a client error. Authentication precedes
  body parsing so unauthenticated requests cannot reach input processing.
  Retired handlers do not parse bodies because those endpoints cannot accept edits.
- Artifact path IDs, parent query IDs, and parent body IDs must be UUIDs. Course
  Topic and Learning Module collection path IDs must also be UUIDs. Invalid
  IDs return 400 before a database query, so they are client validation errors.
- Topic, Learning Module, and Institution creation preserve known Prisma
  errors as 400 responses with their original messages, so duplicate codes
  remain client errors. Unexpected errors return a fixed 500 message and are
  logged on the server to keep private diagnostics out of responses.
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
  Intl implementation, excluding numeric UTC offsets. These bounds accommodate
  course planning while keeping imported values finite.
- Local PostgreSQL publishes only on `127.0.0.1`. Public documents use neutral
  placeholders for private paths, hosts, and contact information. Generic
  shell locations such as `~/bin` and `~/.bashrc` remain executable conventions;
  they do not identify an operator or a private directory layout. Attribution
  trailer templates retain their prescribed text.

## Not in this change

- Cross-site request filtering moves to a later change. It needs a test through
  the real Auth.js proxy and a browser run: wrapping `auth` with a handler stops
  page sign-in redirects, and Auth.js rewrites the request host inside that
  handler, which can reject valid preview-host requests.

## Known limits

- Joining an Institution by name sets a membership that is not `active` back
  to `active`. No code sets a membership to another status today, and there is
  no way to remove a member. When removal is added, a removed member must not
  be able to rejoin by typing the name. See #116.
- The name match collapses runs of spaces in the name that the instructor
  types. A stored name that holds a run of spaces is matched only by the same
  run.
- The tests for `_` and `%` in a name use a stand-in for the database match.
  No test runs that match on PostgreSQL.
