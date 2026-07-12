import { notImplemented } from "../../../redesign-stub";
import type {
  CreateTopicVersionResponse,
  ListTopicVersionsResponse,
  UpsertTopicVersionRequest,
} from "@/lib/redesign-contract";

export type { CreateTopicVersionResponse, ListTopicVersionsResponse, UpsertTopicVersionRequest };

export async function GET() {
  return notImplemented("/api/topics/[id]/versions");
}

export async function POST() {
  return notImplemented("/api/topics/[id]/versions");
}
