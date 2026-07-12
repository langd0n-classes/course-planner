import { notImplemented } from "../../../redesign-stub";
import type {
  CreateCoverageRequest,
  CreateSessionCoverageResponse,
  ListSessionCoveragesResponse,
} from "@/lib/redesign-contract";

export type { CreateCoverageRequest, CreateSessionCoverageResponse, ListSessionCoveragesResponse };

export async function GET() {
  return notImplemented("/api/sessions/[id]/coverages");
}

export async function POST() {
  return notImplemented("/api/sessions/[id]/coverages");
}
