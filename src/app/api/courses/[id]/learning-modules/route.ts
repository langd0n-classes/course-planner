import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, notFound, ok, unauthorized, forbidden } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toLearningModuleDto, toLearningModuleVersionDto } from "@/lib/redesign-serializers";
import { createLearningModuleSchema } from "@/lib/redesign-schemas";
import {
  createLearningModule,
  DomainInvariantError,
  listLearningModulesForCourse,
  getOwnedCourse,
} from "@/services/redesign";
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const learningModules = await listLearningModulesForCourse(prisma, instructor.id, id);
    return ok({
      learningModules: learningModules.map(toLearningModuleDto),
    } satisfies ListLearningModulesResponse);
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
  const parsed = createLearningModuleSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }
  if (parsed.data.createdByInstructorId !== instructor.id) {
    return forbidden("Cannot create a Learning Module for another Instructor");
  }

  try {
    await getOwnedCourse(prisma, instructor.id, id);
    const createdLearningModule = await createLearningModule(prisma, {
      courseId: id,
      stableCode: parsed.data.stableCode,
      createdByInstructorId: instructor.id,
      draft: {
        title: parsed.data.version.title,
        description: parsed.data.version.description,
        studentDescription: parsed.data.version.studentDescription,
        learningObjectives: parsed.data.version.learningObjectives,
        notes: parsed.data.version.notes,
        defaultSequence: parsed.data.version.defaultSequence,
        changeSummary: parsed.data.version.changeSummary,
        topics: parsed.data.version.topics,
        activities: parsed.data.version.activities,
      },
    });

    return created({
      learningModule: toLearningModuleDto(createdLearningModule.learningModule),
      currentVersion: toLearningModuleVersionDto(createdLearningModule.currentVersion),
    } satisfies CreateLearningModuleResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Course not found" ? notFound(error.message) : badRequest(error.message);
    }
    if (error instanceof Error) return badRequest(error.message);
    throw error;
  }
}
