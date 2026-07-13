import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTopicDto, toTopicVersionDto } from "@/lib/redesign-serializers";
import { updateTopicSchema } from "@/lib/redesign-schemas";
import {
  DomainInvariantError,
  archiveTopic,
  getTopicForInstructor,
  updateTopic,
} from "@/services/redesign";
import type { GetTopicResponse, UpdateTopicRequest, UpdateTopicResponse } from "@/lib/redesign-contract";

export type { GetTopicResponse, UpdateTopicRequest, UpdateTopicResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const detail = await getTopicForInstructor(prisma, instructor.id, id);
    return ok({
      topic: toTopicDto(detail.topic),
      currentVersion: detail.currentVersion ? toTopicVersionDto(detail.currentVersion) : null,
    } satisfies GetTopicResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = updateTopicSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    await updateTopic(prisma, instructor.id, id, {
      stableCode: parsed.data.stableCode,
      learningModuleId: parsed.data.learningModuleId,
      archivedAt:
        parsed.data.archivedAt === undefined
          ? undefined
          : parsed.data.archivedAt === null
            ? null
            : new Date(parsed.data.archivedAt),
    });
    const topic = await getTopicForInstructor(prisma, instructor.id, id);
    return ok({
      topic: toTopicDto(topic.topic),
      currentVersion: topic.currentVersion ? toTopicVersionDto(topic.currentVersion) : null,
    } satisfies UpdateTopicResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Topic not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    await archiveTopic(prisma, instructor.id, id);
    const topic = await getTopicForInstructor(prisma, instructor.id, id);
    return ok({
      topic: toTopicDto(topic.topic),
      currentVersion: topic.currentVersion ? toTopicVersionDto(topic.currentVersion) : null,
    } satisfies UpdateTopicResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Topic not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
