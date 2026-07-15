import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTermActivityDto } from "@/lib/redesign-serializers";
import { DomainInvariantError, getTermActivityForInstructor } from "@/services/redesign";
import type { GetTermActivityResponse } from "@/lib/redesign-contract";

export type { GetTermActivityResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const termActivity = await getTermActivityForInstructor(prisma, instructor.id, id);
    return ok({
      termActivity: toTermActivityDto(termActivity),
    } satisfies GetTermActivityResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
