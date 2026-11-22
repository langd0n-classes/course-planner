# Demo data carries the current and next Term (#70)

- **The demo data rolls with the date.** The in-app demo load and the default
  seed both give the exemplar course two Terms: the Spring or Fall semester
  that is in progress (or the next to begin when none is), and the semester
  after it. Issue #70 offered two paths: rolling demo data, or more calendars
  entered once through the calendar editor. Entered-once calendars go stale
  again each semester, so the demo data computes its Terms from the date.
- **Demo dates come from weekday rules, not from a registrar.** Spring classes
  begin on the Tuesday after the third Monday of January. Fall classes begin on
  the first Wednesday of September. Classes end on the Friday of the fifteenth
  calendar week. The Demo Institution and Example University are not real, and
  the generic-app rule excludes one institution's calendar from app data. The
  earlier fixed dates (January 15, September 1) could fall on a weekend. The
  rules give 2026-09-02 and 2027-01-19, which are also real start dates at the
  exemplar's source institution; that agreement is a check on plausibility, not
  a requirement.
- **The current Term is populated; the next Term has its calendar only.**
  Pacing views need an active Term with adopted Activities. The next Term keeps
  adoption undone so the instructor can run the adoption preview and apply
  themselves. This also keeps the load transaction near its earlier size.
- **One Academic Calendar per academic year.** `(institutionId, academicYear,
  version)` is unique, so a Fall Term and the following Spring Term share one
  calendar. A Spring Term and the following Fall Term use two.
- **A repeat load or seed run adds missing Terms and changes nothing else.** A
  Term is matched by its code within the Course. An existing Term, calendar, or
  calendar version is reused as it is. When a repeat run adds the current Term
  to an existing Course, it adopts the modules that have a current version and
  skips the instructor's draft-only modules. A new demo Course still fails when
  a module has no current version, because that is an importer defect.
- **A demo Course without its demo Institution link is left alone.** The link
  identifies where the calendars belong. If the instructor removed it, a repeat
  load returns the Course and adds nothing.
- **The seeded foundation course keeps its fixed Spring 2026 Term.** That Term
  has hand-placed slots, sessions, and differing planned and delivered pins that
  tests depend on. It now serves as the past-Term example.
- **The demo calendars carry no holidays or recesses.** Adding rule-based
  events is a possible follow-up; it is outside #70.
