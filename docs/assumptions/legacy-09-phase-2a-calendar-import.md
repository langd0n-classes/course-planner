# Phase 2A — Calendar & Import

### Calendar Model

- **CalendarSlot separates container from content**: CalendarSlots define when a class COULD meet (holidays, class days, breaks, finals). Sessions define what is planned for a given date. They are matched by date, not by foreign key, to allow importing calendars independently from course structure.

- **SlotType `break_day` instead of `break`**: The enum uses `break_day` because `break` is a reserved word in most languages and could cause issues in code generation.

- **Calendar days only, no time of day**: The calendar models days (Tue/Thu/Fri) but not specific time slots. Time-of-day scheduling is deferred.

- **Substitute schedules remain a follow-up**: Alternate "Monday-on-Tuesday" or other substitute-day schedules are not modeled as a new slot/event enum in this packet. Current heuristics use only explicit break-day proximity plus instructor overrides; substitute-schedule semantics need a separate, designed follow-up.

### Import

- **Imports are additive only**: Import endpoints do not delete or overwrite existing data. If imported codes conflict with existing data, the import is rejected with a warning. This prevents accidental data loss from re-imports.

- **Skills created as term-scoped on import**: Imported skills use `isGlobal: false` and are linked to the importing term. Global skills can still be created manually.

- **Session sequences auto-assigned**: When importing sessions within a module, sequences are assigned based on array order if not explicitly provided.

- **Coverage redistribution is historical**: When a session is canceled and skills are redistributed, the original coverage entries remain on the canceled session. New entries are created on target sessions with `redistributedFrom` pointing back to the canceled session. This maintains a full audit trail.

### What-If

- **What-if is read-only until Apply**: The what-if panel runs pure simulation functions without touching the database. Only the "Apply cancellation" action persists changes.

- **New violations only**: The what-if simulation reports only NEW ordering violations caused by a cancellation, filtering out pre-existing violations.

- **Demo scenarios use live data**: The what-if panel's demo scenarios select sessions from the actual term data rather than using canned mock data. This ensures the demo reflects the current state of the course.

### Calendar View

- **Meeting pattern is data-driven**: The calendar view derives day columns from (1) the term's `meetingPattern.days` field if present, (2) unique `dayOfWeek` values from class_day CalendarSlots, or (3) a fallback of Tue/Thu/Fri. This handles MWF, TTh, daily, or any other pattern.

- **Module color coding by sequence**: Each module gets a distinct color based on its sequence number (cycling through 8 colors). This provides visual grouping on the calendar without requiring instructor configuration.
