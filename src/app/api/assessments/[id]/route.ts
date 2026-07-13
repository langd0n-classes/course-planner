import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { updateAssessmentSchema } from "@/lib/redesign-schemas";
import { toAssessmentDto } from "@/lib/redesign-serializers";
import { archiveAssessment, DomainInvariantError, getAssessment, updateAssessment } from "@/services/redesign";
import type {
  GetAssessmentResponse,
  UpdateAssessmentRequest,
  UpdateAssessmentResponse,
} from "@/lib/redesign-contract";

export type { GetAssessmentResponse, UpdateAssessmentRequest, UpdateAssessmentResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const assessment = await getAssessment(prisma, instructor.id, id);
    return ok({ assessment: toAssessmentDto(assessment) } satisfies GetAssessmentResponse);
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
  const parsed = updateAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const assessment = await updateAssessment(prisma, instructor.id, id, {
      code: parsed.data.code,
      title: parsed.data.title,
      assessmentType: parsed.data.assessmentType,
      description: parsed.data.description,
      studentInstructions: parsed.data.studentInstructions,
      sessionId: parsed.data.sessionId,
      dueDate:
        parsed.data.dueDate === undefined
          ? undefined
          : parsed.data.dueDate === null
            ? null
            : new Date(parsed.data.dueDate),
      rubric: parsed.data.rubric,
      progressionStage: parsed.data.progressionStage,
      topicVersionIds: parsed.data.topicVersionIds,
    });
    return ok({ assessment: toAssessmentDto(assessment) } satisfies UpdateAssessmentResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Assessment not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const assessment = await archiveAssessment(prisma, instructor.id, id);
    return ok({ assessment: toAssessmentDto(assessment) } satisfies UpdateAssessmentResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Assessment not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
