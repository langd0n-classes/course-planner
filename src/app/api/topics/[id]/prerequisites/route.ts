import { notImplemented } from "../../../redesign-stub";
import type {
  ListTopicPrerequisitesResponse,
  ReplaceTopicPrerequisitesRequest,
  ReplaceTopicPrerequisitesResponse,
} from "@/lib/redesign-contract";

export type {
  ListTopicPrerequisitesResponse,
  ReplaceTopicPrerequisitesRequest,
  ReplaceTopicPrerequisitesResponse,
};

export async function GET() {
  return notImplemented("/api/topics/[id]/prerequisites");
}

export async function PUT() {
  return notImplemented("/api/topics/[id]/prerequisites");
}
