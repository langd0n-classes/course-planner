import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, ok } from "@/lib/api-helpers";
import { createAssessmentSchema } from "@/lib/redesign-schemas";
import { toAssessmentDto } from "@/lib/redesign-serializers";
import { createAssessment, DomainInvariantError, listAssessmentsForTerm } from "@/services/redesign";
import type {
  CreateAssessmentRequest,
  CreateTermAssessmentResponse,
  ListTermAssessmentsResponse,
} from "@/lib/redesign-contract";

export type { CreateAssessmentRequest, CreateTermAssessmentResponse, ListTermAssessmentsResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const assessments = await listAssessmentsForTerm(prisma, id);
    return ok({ assessments: assessments.map(toAssessmentDto) } satisfies ListTermAssessmentsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = createAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const assessment = await createAssessment(prisma, {
      termId: id,
      ...parsed.data,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    });
    return created({ assessment: toAssessmentDto(assessment) } satisfies CreateTermAssessmentResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}
