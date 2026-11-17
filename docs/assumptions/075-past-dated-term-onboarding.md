# Past-dated Term onboarding (#75)

- **Open question — should elapsed meetings arrive planned or delivered?**
  Current adoption pins an initial planned revision, leaves the delivered
  pointer and lifecycle state null, and creates meeting detail with null dates,
  calendar slot, and status. A past Term start or end does not infer delivery.
  Scheduling is a separate operation. Adoption has no date input and reads
  neither the clock nor Term dates; the onboarding policy remains undecided.
- **Open question — what does changed-from-plan mean without an earlier plan?**
  Initial adoption establishes the baseline and produces no changed-from-plan
  signal. The daily driver also reports no change for a delivered-only record
  with no planned revision to compare. Whether onboarding should explain the
  absence of an earlier plan remains undecided.
- **Open question — how should missing past coverage affect health?**
  Current impact health reports tracked Topics with no recorded coverage as
  uncovered, including when all associated meetings are past. There is no
  date-based exemption or distinction between unrecorded history and a known
  coverage gap. How much historical reconstruction to request, and how to
  present that uncertainty, remain undecided. Reconstruction is outside #75.
- **Open question — do delivered Activity Topic actions count toward workspace health?**
  Delivered Topic actions on Term Activity revisions do not count toward the
  workspace coverage health. The Term workspace uses `computeTermImpact`,
  which reads Session Coverage records. Recording delivery through Activity
  revisions can therefore leave every tracked Topic uncovered in that health.
  Which source should drive workspace health remains undecided.
- **Open question — how do adopted meetings get dates for a past-dated Term?**
  Creation materializes calendar slots, but adoption creates 40 undated
  planned meeting revisions in both characterization scenarios. The daily
  driver reports `nextMeeting: null` for that output. The scheduled fixture's
  Meeting 20 of 40 result is correct only after each meeting is scheduled.
  Current scheduling requires editing individual Activity revisions; the
  onboarding scheduling workflow remains undecided.
- **Open question — should completedClassDays include today's meeting?**
  Current calendar progress counts today as completed. At noon before meeting
  20, it reports 20 of 40 completed while the scheduled daily driver still
  identifies meeting 20 as next. The meaning of completedClassDays and its
  agreement with the next-meeting display remain undecided.
