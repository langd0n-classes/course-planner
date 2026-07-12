import { notImplemented } from "../../../redesign-stub";
import type { TermImpactResponse } from "@/lib/redesign-contract";

export type { TermImpactResponse };

export async function GET() {
  return notImplemented("/api/terms/[id]/impact");
}
