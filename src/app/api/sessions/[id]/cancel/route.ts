import { notImplemented } from "../../../redesign-stub";
import type { CancelSessionRequest, CancelSessionResponse } from "@/lib/redesign-contract";

export type { CancelSessionRequest, CancelSessionResponse };

export async function POST() {
  return notImplemented("/api/sessions/[id]/cancel");
}
