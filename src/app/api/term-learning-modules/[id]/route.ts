import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { updateTermLearningModuleSchema } from "@/lib/redesign-schemas";
import { toTermLearningModuleDto } from "@/lib/redesign-serializers";
import {
  DomainInvariantError,
  getOwnedTermLearningModuleForInstructor,
  removeTermLearningModule,
  updateTermLearningModule,
} from "@/services/redesign";
import type { RedesignTx } from "@/services/redesign/types";
import type {
  GetTermLearningModuleResponse,
  UpdateTermLearningModuleRequest,
  UpdateTermLearningModuleResponse,
} from "@/lib/redesign-contract";

export type {
  GetTermLearningModuleResponse,
  UpdateTermLearningModuleRequest,
  UpdateTermLearningModuleResponse,
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  let termLearningModule;
  try {
    termLearningModule = await prisma.$transaction((tx: RedesignTx) =>
      getOwnedTermLearningModuleForInstructor(tx, instructor.id, id),
    );
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
  return ok({
    termLearningModule: toTermLearningModuleDto(termLearningModule),
  } satisfies GetTermLearningModuleResponse);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = updateTermLearningModuleSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const termLearningModule = await updateTermLearningModule(prisma, instructor.id, id, parsed.data);
    return ok({
      termLearningModule: toTermLearningModuleDto(termLearningModule),
    } satisfies UpdateTermLearningModuleResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term Learning Module not found"
        ? notFound(error.message)
        : badRequest(error.message);
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const termLearningModule = await removeTermLearningModule(prisma, instructor.id, id);
    return ok({
      termLearningModule: toTermLearningModuleDto(termLearningModule),
    } satisfies UpdateTermLearningModuleResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term Learning Module not found"
        ? notFound(error.message)
        : badRequest(error.message);
    }
    throw error;
  }
}
