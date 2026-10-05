import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { conflict, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toLearningModuleVersionDto } from "@/lib/redesign-serializers";
import {
  ConcurrencyConflictError,
  DomainInvariantError,
  publishLearningModuleVersion,
} from "@/services/redesign";
import type { PublishLearningModuleVersionResponse } from "@/lib/redesign-contract";

export type { PublishLearningModuleVersionResponse };

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const version = await publishLearningModuleVersion(prisma, instructor.id, id);
    return ok({ version: toLearningModuleVersionDto(version) } satisfies PublishLearningModuleVersionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    throw error;
  }
}
