import { notImplemented } from "../../redesign-stub";
import type { GetCoverageResponse, UpdateCoverageRequest, UpdateCoverageResponse } from "@/lib/redesign-contract";

export type { GetCoverageResponse, UpdateCoverageRequest, UpdateCoverageResponse };

export async function GET() {
  return notImplemented("/api/coverages/[id]");
}

export async function PATCH() {
  return notImplemented("/api/coverages/[id]");
}

export async function DELETE() {
  return notImplemented("/api/coverages/[id]");
}
