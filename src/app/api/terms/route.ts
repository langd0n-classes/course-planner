import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, created, badRequest } from "@/lib/api-helpers";
import { toTermDto } from "@/lib/redesign-serializers";
import { createTermSchema } from "@/lib/redesign-schemas";
import { DomainInvariantError } from "@/services/redesign";
import { createTerm } from "@/services/redesign/term-service";
import type { CreateTermRequest, CreateTermResponse, ListTermsResponse } from "@/lib/redesign-contract";

export type { CreateTermRequest, CreateTermResponse, ListTermsResponse };

export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get("courseId");
  const terms = await prisma.term.findMany({
    where: courseId ? { courseId } : undefined,
    orderBy: { startDate: "asc" },
  });
  return ok({ terms: terms.map(toTermDto) } satisfies ListTermsResponse);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createTermSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const term = await createTerm(prisma, {
      courseId: parsed.data.courseId,
      institutionId: parsed.data.institutionId,
      academicCalendarId: parsed.data.academicCalendarId,
      code: parsed.data.code,
      name: parsed.data.name,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      meetingPattern: parsed.data.meetingPattern ?? null,
    });
    return created({ term: toTermDto(term) } satisfies CreateTermResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}
