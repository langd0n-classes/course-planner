import { notImplemented } from "../../../redesign-stub";
import type {
  CreateSessionRequest,
  CreateTermSessionResponse,
  ListTermSessionsResponse,
} from "@/lib/redesign-contract";

export type { CreateSessionRequest, CreateTermSessionResponse, ListTermSessionsResponse };

export async function GET() {
  return notImplemented("/api/terms/[id]/sessions");
}

export async function POST() {
  return notImplemented("/api/terms/[id]/sessions");
}
