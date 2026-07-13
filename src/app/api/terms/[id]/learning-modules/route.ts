import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { adoptTermLearningModuleSchema } from "@/lib/redesign-schemas";
import { toTermLearningModuleDto } from "@/lib/redesign-serializers";
import { adoptLearningModuleForTerm, DomainInvariantError, listTermLearningModulesForTerm } from "@/services/redesign";
import type {
  AdoptTermLearningModuleRequest,
  AdoptTermLearningModuleResponse,
  ListTermLearningModulesResponse,
} from "@/lib/redesign-contract";

export type {
  AdoptTermLearningModuleRequest,
  AdoptTermLearningModuleResponse,
  ListTermLearningModulesResponse,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const learningModules = await listTermLearningModulesForTerm(prisma, instructor.id, id);
    return ok({
      learningModules: learningModules.map(toTermLearningModuleDto),
    } satisfies ListTermLearningModulesResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = adoptTermLearningModuleSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const termLearningModule = await adoptLearningModuleForTerm(prisma, {
      instructorId: instructor.id,
      termId: id,
      ...parsed.data,
    });
    return created({
      termLearningModule: toTermLearningModuleDto(termLearningModule),
    } satisfies AdoptTermLearningModuleResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
