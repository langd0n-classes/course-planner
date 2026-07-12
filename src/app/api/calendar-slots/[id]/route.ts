import { notImplemented } from "../../redesign-stub";
import type {
  UpdateCalendarSlotCapacityRequest,
  UpdateCalendarSlotCapacityResponse,
} from "@/lib/redesign-contract";

export type { UpdateCalendarSlotCapacityRequest, UpdateCalendarSlotCapacityResponse };

export async function PATCH() {
  return notImplemented("/api/calendar-slots/[id]");
}
