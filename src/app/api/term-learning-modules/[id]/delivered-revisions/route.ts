import { notImplemented } from "../../../redesign-stub";
import type {
  CreateDeliveredRevisionRequest,
  CreateDeliveredRevisionResponse,
} from "@/lib/redesign-contract";

export type { CreateDeliveredRevisionRequest, CreateDeliveredRevisionResponse };

export async function POST() {
  return notImplemented("/api/term-learning-modules/[id]/delivered-revisions");
}
