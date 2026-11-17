# Authenticated demo loading

- **First data request creates the Instructor**: A signed-in email is used to create or find an Instructor when an authenticated route first needs it. A unique-key conflict from concurrent creation resolves to the winning row. The session name is used only for the initial row; later sign-ins do not overwrite a name the instructor may have edited.
- **The in-app demo creates one Course per Instructor**: The action imports the generic exemplar course structure into a new Course identified by the unique `(instructorId, demoKey)` pair. Repeating the action returns that Course without importing again. It does not create a Term because the generic exemplar snapshot has no institution or academic-calendar context for a usable Term.

- **The in-app demo now creates a Term as well (2026-10-04 operator decision)**: A dedicated demo Institution and Academic Calendar supply the missing context. The load creates the current or next Spring or Fall Term with weekly meetings and adopted Activities in the same transaction as the Course. Repeating the load makes no changes.
