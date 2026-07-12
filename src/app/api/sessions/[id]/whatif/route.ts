import { notImplemented } from "../../../redesign-stub";
import type { SessionWhatIfResponse } from "@/lib/redesign-contract";

export type { SessionWhatIfResponse };

export async function GET() {
  return notImplemented("/api/sessions/[id]/whatif");
}
