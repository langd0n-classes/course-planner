import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toActivityVersionDto } from "@/lib/redesign-serializers";
import { DomainInvariantError, publishActivityVersion } from "@/services/redesign";
import type { PublishActivityVersionResponse } from "@/lib/redesign-contract";

export type { PublishActivityVersionResponse };

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const version = await publishActivityVersion(prisma, instructor.id, id);
    return ok({ version: toActivityVersionDto(version) } satisfies PublishActivityVersionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
