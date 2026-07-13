import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { toInstitutionDto } from "@/lib/redesign-serializers";
import { createInstitutionSchema } from "@/lib/redesign-schemas";
import { createInstitution, listInstitutionsForInstructor } from "@/services/redesign";
import type {
  CreateInstitutionRequest,
  CreateInstitutionResponse,
  ListInstitutionsResponse,
} from "@/lib/redesign-contract";

export type { CreateInstitutionRequest, CreateInstitutionResponse, ListInstitutionsResponse };

export async function GET() {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const institutions = await listInstitutionsForInstructor(prisma, instructor.id);
  return ok({ institutions: institutions.map(toInstitutionDto) } satisfies ListInstitutionsResponse);
}

export async function POST(request: NextRequest) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = createInstitutionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const institution = await createInstitution(prisma, {
      instructorId: instructor.id,
      name: parsed.data.name,
      shortName: parsed.data.shortName,
      canonicalUri: parsed.data.canonicalUri,
    });

    return created({ institution: toInstitutionDto(institution) } satisfies CreateInstitutionResponse);
  } catch (error) {
    if (error instanceof Error) return badRequest(error.message);
    throw error;
  }
}
