import { notImplemented } from "../../redesign-stub";
import type { GetLearningModuleResponse } from "@/lib/redesign-contract";

export type { GetLearningModuleResponse };

export async function GET() {
  return notImplemented("/api/learning-modules/[id]");
}

export async function PATCH() {
  return notImplemented("/api/learning-modules/[id]");
}

export async function DELETE() {
  return notImplemented("/api/learning-modules/[id]");
}
