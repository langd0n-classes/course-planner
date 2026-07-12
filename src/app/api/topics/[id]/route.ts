import { notImplemented } from "../../redesign-stub";
import type { GetTopicResponse } from "@/lib/redesign-contract";

export type { GetTopicResponse };

export async function GET() {
  return notImplemented("/api/topics/[id]");
}

export async function PATCH() {
  return notImplemented("/api/topics/[id]");
}

export async function DELETE() {
  return notImplemented("/api/topics/[id]");
}
