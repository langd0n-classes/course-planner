import { notImplemented } from "../../../redesign-stub";
import type {
  CreateAssessmentRequest,
  CreateTermAssessmentResponse,
  ListTermAssessmentsResponse,
} from "@/lib/redesign-contract";

export type { CreateAssessmentRequest, CreateTermAssessmentResponse, ListTermAssessmentsResponse };

export async function GET() {
  return notImplemented("/api/terms/[id]/assessments");
}

export async function POST() {
  return notImplemented("/api/terms/[id]/assessments");
}
