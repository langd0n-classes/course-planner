import { notImplemented } from "../../redesign-stub";
import type { GetSessionResponse, UpdateSessionRequest, UpdateSessionResponse } from "@/lib/redesign-contract";

export type { GetSessionResponse, UpdateSessionRequest, UpdateSessionResponse };

export async function GET() {
  return notImplemented("/api/sessions/[id]");
}

export async function PATCH() {
  return notImplemented("/api/sessions/[id]");
}

export async function DELETE() {
  return notImplemented("/api/sessions/[id]");
}
