import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok } from "@/lib/api-helpers";
import { updateTermLearningModuleSchema } from "@/lib/redesign-schemas";
import { toTermLearningModuleDto } from "@/lib/redesign-serializers";
import {
  DomainInvariantError,
  removeTermLearningModule,
  updateTermLearningModule,
} from "@/services/redesign";
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
  const termLearningModule = await prisma.termLearningModule.findUnique({ where: { id } });
  if (!termLearningModule) return notFound("Term Learning Module not found");
  return ok({
    termLearningModule: toTermLearningModuleDto(termLearningModule),
  } satisfies GetTermLearningModuleResponse);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateTermLearningModuleSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const termLearningModule = await updateTermLearningModule(prisma, id, parsed.data);
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
  try {
    const termLearningModule = await removeTermLearningModule(prisma, id);
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
