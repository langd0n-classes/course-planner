import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { createCoverageSchema } from "@/lib/redesign-schemas";
import { toCoverageDto } from "@/lib/redesign-serializers";
import { createCoverage, DomainInvariantError, listSessionCoverages } from "@/services/redesign";
import type {
  CreateCoverageRequest,
  CreateSessionCoverageResponse,
  ListSessionCoveragesResponse,
} from "@/lib/redesign-contract";

export type { CreateCoverageRequest, CreateSessionCoverageResponse, ListSessionCoveragesResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const coverages = await listSessionCoverages(prisma, instructor.id, id);
    return ok({ coverages: coverages.map(toCoverageDto) } satisfies ListSessionCoveragesResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Session not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = createCoverageSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const coverage = await createCoverage(prisma, {
      instructorId: instructor.id,
      sessionId: id,
      ...parsed.data,
    });
    return created({ coverage: toCoverageDto(coverage) } satisfies CreateSessionCoverageResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Session not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
