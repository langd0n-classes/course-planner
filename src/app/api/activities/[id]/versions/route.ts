import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, conflict, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityVersionDto } from "@/lib/redesign-serializers";
import { upsertActivityVersionSchema } from "@/lib/redesign-schemas";
import {
  ConcurrencyConflictError,
  DomainInvariantError,
  getActivityForInstructor,
  listActivityVersionsForInstructor,
  reviseActivity,
} from "@/services/redesign";
import type {
  CreateActivityVersionResponse,
  ListActivityVersionsResponse,
  UpsertActivityVersionRequest,
} from "@/lib/redesign-contract";

export type { CreateActivityVersionResponse, ListActivityVersionsResponse, UpsertActivityVersionRequest };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const versions = await listActivityVersionsForInstructor(prisma, instructor.id, id);
    return ok({
      versions: versions.map(toActivityVersionDto),
    } satisfies ListActivityVersionsResponse);
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
  const parsed = upsertActivityVersionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const activity = await getActivityForInstructor(prisma, instructor.id, id);
    const expectedCurrentVersionId = parsed.data.expectedCurrentVersionId ?? activity.activity.currentVersionId;
    if (!expectedCurrentVersionId) {
      return badRequest("Activity current version is missing");
    }

    const version = await reviseActivity(prisma, {
      activityId: id,
      instructorId: instructor.id,
      expectedCurrentVersionId,
      createdByInstructorId: instructor.id,
      publish: parsed.data.publish,
      draft: {
        title: parsed.data.title,
        summary: parsed.data.summary,
        activityTypeVersionId: parsed.data.activityTypeVersionId,
        changeSummary: parsed.data.changeSummary,
        detail: parsed.data.detail,
        milestoneTemplates: parsed.data.milestoneTemplates,
      },
    });

    return created({ version: toActivityVersionDto(version) } satisfies CreateActivityVersionResponse);
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    if (error instanceof DomainInvariantError) {
      return error.message === "Activity not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
