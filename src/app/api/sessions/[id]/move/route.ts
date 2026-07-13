import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, ok } from "@/lib/api-helpers";
import { moveSessionSchema } from "@/lib/redesign-schemas";
import { toSessionDto } from "@/lib/redesign-serializers";
import { DomainInvariantError, moveSession } from "@/services/redesign";
import type { MoveSessionRequest, MoveSessionResponse } from "@/lib/redesign-contract";

export type { MoveSessionRequest, MoveSessionResponse };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = moveSessionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const session = await moveSession(prisma, id, {
      termLearningModuleId: parsed.data.termLearningModuleId,
      sequence: parsed.data.sequence,
      date:
        parsed.data.date === undefined
          ? undefined
          : parsed.data.date === null
            ? null
            : new Date(parsed.data.date),
      scheduleOverrideLabel: parsed.data.scheduleOverrideLabel,
    });
    return ok({ session: toSessionDto(session) } satisfies MoveSessionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}
