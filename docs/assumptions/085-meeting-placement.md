# Meeting placement on the Term calendar (#85)

- Placement starts at the Term's first eligible class day, including past dates.
  Learning Module sequence determines order before the meeting ordinal. Existing
  planned dates and canceled meetings are preserved.
- Each meeting type has its own slot sequence. Different types may share a class
  day. A type-specific cancellation does not hide that day from the empty-slot
  report; a cancellation for all types does.
- Apply stores the fallback start time, optional end time, and time zone as a
  `TermMeetingPattern` row for each placed type that had none. The pattern uses
  all distinct class-day weekdays and spans the Term's start and end dates.
  Existing patterns remain unchanged. Meeting instants are stored in new planned
  revisions; coursework milestones retain their dates.
- A stored pattern is a snapshot of the Term at the time of the apply. It is
  written only when the request gives a meeting time, and only for the types
  placed in that apply. A later change to the Term's dates or class days does
  not change it, so a class day added later on another weekday or outside the
  stored dates gets no meeting of that type until the pattern is changed.
- `applyTermCalendar` deletes all the Term's pattern rows and writes the rows
  in its input, so a later Term calendar apply removes a stored time that its
  input does not include.
- If patterns overlap for one type on one date, placement uses the first pattern
  ordered by startsOn, then pattern id. Pattern dates are inclusive. Local end
  times refer to the same date as the start time.
- A local time in a daylight-saving gap is rejected. The time conversion resolves
  the offset for each calendar date. A dated meeting without a slot reserves its
  local date using the applicable pattern's zone (or the request fallback zone).
  Without either source of time zone, only its explicit slot can be reserved.
- The panel requires a new preview after editing a fallback time or receiving an
  apply conflict. Apply returns `placedCount` and
  `storedMeetingPatternCount`; the workspace reloads after apply.
- The fallback meeting time exists because a Term created in the workspace
  stores meeting days and no time. `TermMeetingPattern` rows hold times, and
  meeting placement apply also writes them for placed types that have none.
- Coursework milestones are not dated by this step. Adoption creates no Term
  milestones, so there is nothing to date (#87). The "records complete from"
  date for a part-way Term is also separate.
- A meeting with no Term Learning Module has no position in the sequence. It is
  listed as not placed, and the single-Activity edit dates it.
- A local time that occurs twice, when the clock goes back, resolves to the
  earlier instant in every time zone. An end time must be after the start time.
- The end of a placed meeting is the pattern's or the request's end time; else
  the start plus the Activity version's default duration; else none.
- One local time that does not exist on one class day stops the whole preview
  with that error. The instructor changes the time and previews again.
