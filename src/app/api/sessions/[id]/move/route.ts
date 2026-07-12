import { notImplemented } from "../../../redesign-stub";
import type { MoveSessionRequest, MoveSessionResponse } from "@/lib/redesign-contract";

export type { MoveSessionRequest, MoveSessionResponse };

export async function POST() {
  return notImplemented("/api/sessions/[id]/move");
}
