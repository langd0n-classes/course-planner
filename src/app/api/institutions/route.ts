import { notImplemented } from "../redesign-stub";
import type {
  CreateInstitutionRequest,
  CreateInstitutionResponse,
  ListInstitutionsResponse,
} from "@/lib/redesign-contract";

export type { CreateInstitutionRequest, CreateInstitutionResponse, ListInstitutionsResponse };

export async function GET() {
  return notImplemented("/api/institutions");
}

export async function POST() {
  return notImplemented("/api/institutions");
}
