import { notImplemented } from "../../redesign-stub";
import type {
  GetCourseResponse,
  UpdateCourseRequest,
  UpdateCourseResponse,
} from "@/lib/redesign-contract";

export type { GetCourseResponse, UpdateCourseRequest, UpdateCourseResponse };

export async function GET() {
  return notImplemented("/api/courses/[id]");
}

export async function PATCH() {
  return notImplemented("/api/courses/[id]");
}
