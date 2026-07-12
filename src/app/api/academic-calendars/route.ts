import { notImplemented } from "../redesign-stub";
import type {
  CreateAcademicCalendarRequest,
  CreateAcademicCalendarResponse,
  ListAcademicCalendarsResponse,
} from "@/lib/redesign-contract";

export type {
  CreateAcademicCalendarRequest,
  CreateAcademicCalendarResponse,
  ListAcademicCalendarsResponse,
};

export async function GET() {
  return notImplemented("/api/academic-calendars");
}

export async function POST() {
  return notImplemented("/api/academic-calendars");
}
