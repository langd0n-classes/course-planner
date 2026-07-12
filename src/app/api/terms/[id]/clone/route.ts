import { notImplemented } from "../../../redesign-stub";
import type {
  CloneTermApplyResponse,
  CloneTermPreviewResponse,
  CloneTermRequest,
  CloneTermResponse,
} from "@/lib/redesign-contract";

export type {
  CloneTermApplyResponse,
  CloneTermPreviewResponse,
  CloneTermRequest,
  CloneTermResponse,
};

export async function POST() {
  return notImplemented("/api/terms/[id]/clone");
}
