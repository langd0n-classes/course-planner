import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTermActivityDto } from "@/lib/redesign-serializers";
import { DomainInvariantError, listTermActivitiesForTerm } from "@/services/redesign";
import type { ListTermActivitiesResponse } from "@/lib/redesign-contract";

export type { ListTermActivitiesResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const termActivities = await listTermActivitiesForTerm(prisma, instructor.id, id);
    return ok({
      termActivities: termActivities.map(toTermActivityDto),
    } satisfies ListTermActivitiesResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
