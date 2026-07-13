import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, conflict, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toLearningModuleVersionDto } from "@/lib/redesign-serializers";
import { upsertLearningModuleVersionSchema } from "@/lib/redesign-schemas";
import {
  ConcurrencyConflictError,
  DomainInvariantError,
  listLearningModuleVersionsForInstructor,
  getLearningModuleForInstructor,
  reviseLearningModule,
} from "@/services/redesign";
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const versions = await listLearningModuleVersionsForInstructor(prisma, instructor.id, id);
    return ok({
      versions: versions.map(toLearningModuleVersionDto),
    } satisfies ListLearningModuleVersionsResponse);
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
  const parsed = upsertLearningModuleVersionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const learningModule = await getLearningModuleForInstructor(prisma, instructor.id, id);
    const expectedCurrentVersionId =
      parsed.data.expectedCurrentVersionId ?? learningModule.learningModule.currentVersionId;
    if (!expectedCurrentVersionId) {
      return badRequest("Learning Module current version is missing");
    }

    const version = await reviseLearningModule(prisma, {
      learningModuleId: id,
      expectedCurrentVersionId,
      createdByInstructorId: instructor.id,
      publish: parsed.data.publish,
      draft: {
        title: parsed.data.title,
        description: parsed.data.description,
        studentDescription: parsed.data.studentDescription,
        learningObjectives: parsed.data.learningObjectives,
        notes: parsed.data.notes,
        defaultSequence: parsed.data.defaultSequence,
        changeSummary: parsed.data.changeSummary,
        topics: parsed.data.topics,
      },
    });

    return created({ version: toLearningModuleVersionDto(version) } satisfies CreateLearningModuleVersionResponse);
  } catch (error) {
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    if (error instanceof DomainInvariantError) {
      return error.message === "Learning Module not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
