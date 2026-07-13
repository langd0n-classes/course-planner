import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, conflict, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTopicVersionDto } from "@/lib/redesign-serializers";
import { upsertTopicVersionSchema } from "@/lib/redesign-schemas";
import {
  ConcurrencyConflictError,
  DomainInvariantError,
  getTopicForInstructor,
  listTopicVersionsForInstructor,
  reviseTopic,
} from "@/services/redesign";
import type {
  CreateTopicVersionResponse,
  ListTopicVersionsResponse,
  UpsertTopicVersionRequest,
} from "@/lib/redesign-contract";

export type { CreateTopicVersionResponse, ListTopicVersionsResponse, UpsertTopicVersionRequest };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const versions = await listTopicVersionsForInstructor(prisma, instructor.id, id);
    return ok({ versions: versions.map(toTopicVersionDto) } satisfies ListTopicVersionsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = upsertTopicVersionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const topic = await getTopicForInstructor(prisma, instructor.id, id);
    const expectedCurrentVersionId = parsed.data.expectedCurrentVersionId ?? topic.topic.currentVersionId;
    if (!expectedCurrentVersionId) {
      return badRequest("Topic current version is missing");
    }

    const version = await reviseTopic(prisma, {
      topicId: id,
      expectedCurrentVersionId,
      createdByInstructorId: instructor.id,
      publish: parsed.data.publish,
      draft: {
        title: parsed.data.title,
        category: parsed.data.category,
        description: parsed.data.description,
        changeSummary: parsed.data.changeSummary,
      },
    });

    return created({ version: toTopicVersionDto(version) } satisfies CreateTopicVersionResponse);
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    if (error instanceof DomainInvariantError) {
      return error.message === "Topic not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
