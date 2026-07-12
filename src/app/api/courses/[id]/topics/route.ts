import { notImplemented } from "../../../redesign-stub";
import type { CreateTopicRequest, CreateTopicResponse, ListTopicsResponse } from "@/lib/redesign-contract";

export type { CreateTopicRequest, CreateTopicResponse, ListTopicsResponse };

export async function GET() {
  return notImplemented("/api/courses/[id]/topics");
}

export async function POST() {
  return notImplemented("/api/courses/[id]/topics");
}
