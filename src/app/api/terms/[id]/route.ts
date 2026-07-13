import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, badRequest, notFound } from "@/lib/api-helpers";
import { toTermDto } from "@/lib/redesign-serializers";
import { updateTermSchema } from "@/lib/redesign-schemas";
import { DomainInvariantError } from "@/services/redesign";
import { archiveTerm, updateTerm } from "@/services/redesign/term-service";
import type { GetTermResponse, UpdateTermRequest, UpdateTermResponse } from "@/lib/redesign-contract";

export type { GetTermResponse, UpdateTermRequest, UpdateTermResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const term = await prisma.term.findUnique({ where: { id } });
  if (!term) return notFound("Term not found");
  return ok({ term: toTermDto(term) } satisfies GetTermResponse);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateTermSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const term = await updateTerm(prisma, id, {
      academicCalendarId: parsed.data.academicCalendarId,
      code: parsed.data.code,
      name: parsed.data.name,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
      meetingPattern: parsed.data.meetingPattern,
    });
    return ok({ term: toTermDto(term) } satisfies UpdateTermResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const term = await archiveTerm(prisma, id);
    return ok({ term: toTermDto(term) } satisfies UpdateTermResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}
