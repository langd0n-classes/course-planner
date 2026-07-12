import { notImplemented } from "../../redesign-stub";
import type {
  GetAssessmentResponse,
  UpdateAssessmentRequest,
  UpdateAssessmentResponse,
} from "@/lib/redesign-contract";

export type { GetAssessmentResponse, UpdateAssessmentRequest, UpdateAssessmentResponse };

export async function GET() {
  return notImplemented("/api/assessments/[id]");
}

export async function PATCH() {
  return notImplemented("/api/assessments/[id]");
}

export async function DELETE() {
  return notImplemented("/api/assessments/[id]");
}
