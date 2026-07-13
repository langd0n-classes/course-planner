import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { updateCoverageSchema } from "@/lib/redesign-schemas";
import { toCoverageDto } from "@/lib/redesign-serializers";
import { deleteCoverage, DomainInvariantError, getCoverage, updateCoverage } from "@/services/redesign";
import type { GetCoverageResponse, UpdateCoverageRequest, UpdateCoverageResponse } from "@/lib/redesign-contract";

export type { GetCoverageResponse, UpdateCoverageRequest, UpdateCoverageResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const coverage = await getCoverage(prisma, instructor.id, id);
    return ok({ coverage: toCoverageDto(coverage) } satisfies GetCoverageResponse);
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
  const parsed = updateCoverageSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const coverage = await updateCoverage(prisma, instructor.id, id, parsed.data);
    return ok({ coverage: toCoverageDto(coverage) } satisfies UpdateCoverageResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Coverage not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const coverage = await deleteCoverage(prisma, instructor.id, id);
    return ok({ coverage: toCoverageDto(coverage) } satisfies UpdateCoverageResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Coverage not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
