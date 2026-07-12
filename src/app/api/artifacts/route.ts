import { notImplemented } from "../redesign-stub";
import type {
  CreateArtifactRequest,
  CreateArtifactResponse,
  ListArtifactsResponse,
} from "@/lib/redesign-contract";

export type { CreateArtifactRequest, CreateArtifactResponse, ListArtifactsResponse };

export async function GET() {
  return notImplemented("/api/artifacts");
}

export async function POST() {
  return notImplemented("/api/artifacts");
}
