import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toTermActivityDto, toTermActivityRevisionDto } from "@/lib/redesign-serializers";
import {
  DomainInvariantError,
  listTermActivitiesForTerm,
  listTermActivitiesForTermWithRevisions,
} from "@/services/redesign";
import type { ListTermActivitiesResponse } from "@/lib/redesign-contract";

export type { ListTermActivitiesResponse };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const includeRevisions = request.nextUrl.searchParams.get("include") === "revisions";
    if (includeRevisions) {
      const result = await listTermActivitiesForTermWithRevisions(prisma, instructor.id, id);
      return ok({
        termActivities: result.termActivities.map(toTermActivityDto),
        revisionsByTermActivityId: Object.fromEntries(
          Object.entries(result.revisionsByTermActivityId).map(([activityId, revisions]) => [
            activityId,
            {
              planned: revisions.planned ? toTermActivityRevisionDto(revisions.planned) : null,
              delivered: revisions.delivered ? toTermActivityRevisionDto(revisions.delivered) : null,
            },
          ]),
        ),
      } satisfies ListTermActivitiesResponse);
    }

    const termActivities = await listTermActivitiesForTerm(prisma, instructor.id, id);
    return ok({
      termActivities: termActivities.map(toTermActivityDto),
    } satisfies ListTermActivitiesResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
