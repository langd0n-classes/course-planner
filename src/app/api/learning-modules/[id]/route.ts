import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toLearningModuleDto, toLearningModuleVersionDto } from "@/lib/redesign-serializers";
import { updateLearningModuleSchema } from "@/lib/redesign-schemas";
import {
  DomainInvariantError,
  archiveLearningModule,
  getLearningModuleForInstructor,
  updateLearningModule,
} from "@/services/redesign";
import type {
  GetLearningModuleResponse,
  UpdateLearningModuleRequest,
  UpdateLearningModuleResponse,
} from "@/lib/redesign-contract";

export type { GetLearningModuleResponse, UpdateLearningModuleRequest, UpdateLearningModuleResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const detail = await getLearningModuleForInstructor(prisma, instructor.id, id);
    return ok({
      learningModule: toLearningModuleDto(detail.learningModule),
      currentVersion: detail.currentVersion ? toLearningModuleVersionDto(detail.currentVersion) : null,
    } satisfies GetLearningModuleResponse);
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
  const parsed = updateLearningModuleSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    await updateLearningModule(prisma, instructor.id, id, {
      stableCode: parsed.data.stableCode,
      archivedAt:
        parsed.data.archivedAt === undefined
          ? undefined
          : parsed.data.archivedAt === null
            ? null
            : new Date(parsed.data.archivedAt),
    });
    const learningModule = await getLearningModuleForInstructor(prisma, instructor.id, id);
    return ok({
      learningModule: toLearningModuleDto(learningModule.learningModule),
      currentVersion: learningModule.currentVersion
        ? toLearningModuleVersionDto(learningModule.currentVersion)
        : null,
    } satisfies UpdateLearningModuleResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Learning Module not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    await archiveLearningModule(prisma, instructor.id, id);
    const learningModule = await getLearningModuleForInstructor(prisma, instructor.id, id);
    return ok({
      learningModule: toLearningModuleDto(learningModule.learningModule),
      currentVersion: learningModule.currentVersion
        ? toLearningModuleVersionDto(learningModule.currentVersion)
        : null,
    } satisfies UpdateLearningModuleResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Learning Module not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
