import { notImplemented } from "../../../redesign-stub";
import type {
  CreateLearningModuleVersionResponse,
  ListLearningModuleVersionsResponse,
  UpsertLearningModuleVersionRequest,
} from "@/lib/redesign-contract";

export type {
  CreateLearningModuleVersionResponse,
  ListLearningModuleVersionsResponse,
  UpsertLearningModuleVersionRequest,
};

export async function GET() {
  return notImplemented("/api/learning-modules/[id]/versions");
}

export async function POST() {
  return notImplemented("/api/learning-modules/[id]/versions");
}
