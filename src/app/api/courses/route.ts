import { notImplemented } from "../redesign-stub";
import type { CreateCourseRequest, CreateCourseResponse, ListCoursesResponse } from "@/lib/redesign-contract";

export type { CreateCourseRequest, CreateCourseResponse, ListCoursesResponse };

export async function GET() {
  return notImplemented("/api/courses");
}

export async function POST() {
  return notImplemented("/api/courses");
}
