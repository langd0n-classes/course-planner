import { notImplemented } from "../../redesign-stub";
import type {
  GetTermLearningModuleResponse,
  UpdateTermLearningModuleRequest,
  UpdateTermLearningModuleResponse,
} from "@/lib/redesign-contract";

export type {
  GetTermLearningModuleResponse,
  UpdateTermLearningModuleRequest,
  UpdateTermLearningModuleResponse,
};

export async function GET() {
  return notImplemented("/api/term-learning-modules/[id]");
}

export async function PATCH() {
  return notImplemented("/api/term-learning-modules/[id]");
}

export async function DELETE() {
  return notImplemented("/api/term-learning-modules/[id]");
}
