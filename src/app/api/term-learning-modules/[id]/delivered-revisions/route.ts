import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, conflict, ok } from "@/lib/api-helpers";
import { createDeliveredRevisionSchema } from "@/lib/redesign-schemas";
import { toLearningModuleVersionDto, toTermLearningModuleDto } from "@/lib/redesign-serializers";
import {
  ConcurrencyConflictError,
  createDeliveredRevision,
  DomainInvariantError,
} from "@/services/redesign";
import type {
  CreateDeliveredRevisionRequest,
  CreateDeliveredRevisionResponse,
} from "@/lib/redesign-contract";

export type { CreateDeliveredRevisionRequest, CreateDeliveredRevisionResponse };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = createDeliveredRevisionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await createDeliveredRevision(prisma, {
      termLearningModuleId: id,
      expectedDeliveredLearningModuleVersionId: parsed.data.expectedDeliveredLearningModuleVersionId,
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
    return ok({
      termLearningModule: toTermLearningModuleDto(result.termLearningModule),
      deliveredVersion: toLearningModuleVersionDto(result.deliveredVersion),
    } satisfies CreateDeliveredRevisionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    if (error instanceof ConcurrencyConflictError) return conflict(error.message);
    throw error;
  }
}
