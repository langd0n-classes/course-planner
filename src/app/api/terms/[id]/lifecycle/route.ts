import { notImplemented } from "../../../redesign-stub";
import type {
  TermLifecycleTransitionRequest,
  TermLifecycleTransitionResponse,
} from "@/lib/redesign-contract";

export type { TermLifecycleTransitionRequest, TermLifecycleTransitionResponse };

export async function POST() {
  return notImplemented("/api/terms/[id]/lifecycle");
}
