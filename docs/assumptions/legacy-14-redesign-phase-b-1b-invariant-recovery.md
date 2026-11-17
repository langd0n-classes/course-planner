# Redesign Phase B.1B — invariant recovery

- **Legacy single-pattern Term forms normalize to one lecture role**: The
  recovery seam expects explicit meeting-role patterns, but existing callers
  and seed data may still think in one `days[]` list. The materialization
  service normalizes that legacy shape into a single `lecture` role rather
  than rejecting it internally.

- **Session override evidence is one required label, not a richer workflow**:
  For this packet, a dated Session that does not use a materialized class-day
  slot must provide `scheduleOverrideLabel`. No separate override-reason model
  or approval record is introduced here.

- **Clone role mapping falls back to `sessionType` when source role evidence is
  ambiguous**: Existing redesign data does not yet persist a first-class
  meeting-role key per Session. Clone therefore resolves role mapping from the
  source Term meeting pattern first and falls back to `sessionType` when that
  is the only stable evidence available.

- **Lossless packages refuse export when uploaded/generated payload bytes cannot
  be resolved**: The truthful behavior for the `course-planner-lossless`
  profile is to fail the export with unresolved-payload details rather than
  emit a metadata-only package under a lossless name.
