import { notImplemented } from "../../redesign-stub";
import type { GetTermResponse, UpdateTermRequest, UpdateTermResponse } from "@/lib/redesign-contract";

export type { GetTermResponse, UpdateTermRequest, UpdateTermResponse };

export async function GET() {
  return notImplemented("/api/terms/[id]");
}

export async function PATCH() {
  return notImplemented("/api/terms/[id]");
}

export async function DELETE() {
  return notImplemented("/api/terms/[id]");
}
