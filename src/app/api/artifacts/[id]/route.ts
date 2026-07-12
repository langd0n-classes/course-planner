import { notImplemented } from "../../redesign-stub";
import type { GetArtifactResponse, UpdateArtifactRequest, UpdateArtifactResponse } from "@/lib/redesign-contract";

export type { GetArtifactResponse, UpdateArtifactRequest, UpdateArtifactResponse };

export async function GET() {
  return notImplemented("/api/artifacts/[id]");
}

export async function PATCH() {
  return notImplemented("/api/artifacts/[id]");
}

export async function DELETE() {
  return notImplemented("/api/artifacts/[id]");
}
