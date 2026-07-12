import { notImplemented } from "../../../redesign-stub";
import type {
  AdoptTermLearningModuleRequest,
  AdoptTermLearningModuleResponse,
  ListTermLearningModulesResponse,
} from "@/lib/redesign-contract";

export type {
  AdoptTermLearningModuleRequest,
  AdoptTermLearningModuleResponse,
  ListTermLearningModulesResponse,
};

export async function GET() {
  return notImplemented("/api/terms/[id]/learning-modules");
}

export async function POST() {
  return notImplemented("/api/terms/[id]/learning-modules");
}
