import { Prisma } from "@prisma/client";
import { DomainInvariantError, InstitutionNameConflictError } from "@/services/redesign/errors";
import { unexpectedRouteError } from "@/lib/route-errors";
import { readJsonBody } from "@/lib/request-json";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, conflict, created, ok, unauthorized } from "@/lib/api-helpers";
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

  try {
    const institutions = await listInstitutionsForInstructor(prisma, instructor.id);
    return ok({ institutions: institutions.map(toInstitutionDto) } satisfies ListInstitutionsResponse);
  } catch (error) { return unexpectedRouteError(error); }
}

export async function POST(request: NextRequest) {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const json = await readJsonBody(request);
  if (json.response) return json.response;
  const body = json.data;
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

    const response = {
      institution: toInstitutionDto(institution),
      created: institution.created,
    } satisfies CreateInstitutionResponse & { created: boolean };
    return institution.created ? created(response) : ok(response);
  } catch (error) {
    if (error instanceof InstitutionNameConflictError) return conflict(error.message);
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    if (error instanceof Prisma.PrismaClientKnownRequestError) return badRequest(error.message);
    return unexpectedRouteError(error);
  }
}
