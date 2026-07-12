import { notImplemented } from "../../../redesign-stub";
import type {
  ListCourseInstitutionsResponse,
  ReplaceCourseInstitutionsRequest,
  ReplaceCourseInstitutionsResponse,
} from "@/lib/redesign-contract";

export type {
  ListCourseInstitutionsResponse,
  ReplaceCourseInstitutionsRequest,
  ReplaceCourseInstitutionsResponse,
};

export async function GET() {
  return notImplemented("/api/courses/[id]/institutions");
}

export async function PUT() {
  return notImplemented("/api/courses/[id]/institutions");
}
