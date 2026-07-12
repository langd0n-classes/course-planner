import { notImplemented } from "../../../redesign-stub";
import type {
  CreateLearningModuleRequest,
  CreateLearningModuleResponse,
  ListLearningModulesResponse,
} from "@/lib/redesign-contract";

export type {
  CreateLearningModuleRequest,
  CreateLearningModuleResponse,
  ListLearningModulesResponse,
};

export async function GET() {
  return notImplemented("/api/courses/[id]/learning-modules");
}

export async function POST() {
  return notImplemented("/api/courses/[id]/learning-modules");
}
