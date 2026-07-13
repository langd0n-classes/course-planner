import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, ok } from "@/lib/api-helpers";
import { updateSessionSchema } from "@/lib/redesign-schemas";
import { toSessionDto } from "@/lib/redesign-serializers";
import { archiveSession, DomainInvariantError, getSession, updateSession } from "@/services/redesign";
import type { GetSessionResponse, UpdateSessionRequest, UpdateSessionResponse } from "@/lib/redesign-contract";

export type { GetSessionResponse, UpdateSessionRequest, UpdateSessionResponse };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await getSession(prisma, id);
    return ok({ session: toSessionDto(session) } satisfies GetSessionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const session = await updateSession(prisma, id, {
      termLearningModuleId: parsed.data.termLearningModuleId,
      sequence: parsed.data.sequence,
      sessionType: parsed.data.sessionType,
      code: parsed.data.code,
      title: parsed.data.title,
      date:
        parsed.data.date === undefined
          ? undefined
          : parsed.data.date === null
            ? null
            : new Date(parsed.data.date),
      scheduleOverrideLabel: parsed.data.scheduleOverrideLabel,
      description: parsed.data.description,
      format: parsed.data.format,
      notes: parsed.data.notes,
      instructionalMode: parsed.data.instructionalMode,
      archivedAt:
        parsed.data.archivedAt === undefined
          ? undefined
          : parsed.data.archivedAt === null
            ? null
            : new Date(parsed.data.archivedAt),
    });
    return ok({ session: toSessionDto(session) } satisfies UpdateSessionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Session not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await archiveSession(prisma, id);
    return ok({ session: toSessionDto(session) } satisfies UpdateSessionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Session not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
