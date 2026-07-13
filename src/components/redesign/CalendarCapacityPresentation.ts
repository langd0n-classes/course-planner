import type { CalendarSlotCandidateDto, CalendarSlotDto } from "@/lib/redesign-contract";

export function formatInstructionalCapacityLabel(
  capacity: CalendarSlotCandidateDto["instructionalCapacity"] | CalendarSlotDto["instructionalCapacity"],
) {
  switch (capacity) {
    case "normal":
      return "Normal capacity";
    case "reduced_engagement":
      return "Reduced capacity";
    case "recovery":
      return "Recovery capacity";
    case "assessment_period":
      return "Assessment-period capacity";
  }
}

export function capacityBadgeClass(
  capacity: CalendarSlotCandidateDto["instructionalCapacity"] | CalendarSlotDto["instructionalCapacity"],
) {
  switch (capacity) {
    case "normal":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "reduced_engagement":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "recovery":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "assessment_period":
      return "border-rose-200 bg-rose-50 text-rose-800";
  }
}

export function formatCapacitySourceLabel(source: CalendarSlotCandidateDto["capacitySource"] | CalendarSlotDto["capacitySource"]) {
  switch (source) {
    case "baseline":
      return "Baseline";
    case "heuristic":
      return "Heuristic";
    case "instructor_override":
      return "Instructor override";
  }
}

export function isCapacityAdvisory(
  slot:
    | Pick<
        CalendarSlotCandidateDto,
        "instructionalCapacity" | "capacitySource" | "capacityReason"
      >
    | Pick<CalendarSlotDto, "instructionalCapacity" | "capacitySource" | "capacityReason">,
) {
  return slot.instructionalCapacity !== "normal" || slot.capacitySource !== "baseline";
}
