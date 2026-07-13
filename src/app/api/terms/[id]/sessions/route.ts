import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { createSessionSchema } from "@/lib/redesign-schemas";
import { toSessionDto } from "@/lib/redesign-serializers";
import { createSession, DomainInvariantError, listSessionsForTerm } from "@/services/redesign";
import type {
  CreateSessionRequest,
  CreateTermSessionResponse,
  ListTermSessionsResponse,
} from "@/lib/redesign-contract";

export type { CreateSessionRequest, CreateTermSessionResponse, ListTermSessionsResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    const sessions = await listSessionsForTerm(prisma, instructor.id, id);
    return ok({ sessions: sessions.map(toSessionDto) } satisfies ListTermSessionsResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const body = await request.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const session = await createSession(prisma, {
      instructorId: instructor.id,
      termId: id,
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      scheduleOverrideLabel: parsed.data.scheduleOverrideLabel ?? null,
    });
    return created({ session: toSessionDto(session) } satisfies CreateTermSessionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term not found" || error.message === "Term Learning Module not found"
        ? notFound(error.message)
        : badRequest(error.message);
    }
    throw error;
  }
}
