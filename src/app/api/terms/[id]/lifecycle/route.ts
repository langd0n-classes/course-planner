import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, badRequest, notFound, conflict } from "@/lib/api-helpers";
import { toTermDto } from "@/lib/redesign-serializers";
import { termLifecycleTransitionSchema } from "@/lib/redesign-schemas";
import { ConcurrencyConflictError, DomainInvariantError } from "@/services/redesign";
import { transitionTermLifecycle } from "@/services/redesign/lifecycle-service";
import type {
  TermLifecycleTransitionRequest,
  TermLifecycleTransitionResponse,
} from "@/lib/redesign-contract";

export type { TermLifecycleTransitionRequest, TermLifecycleTransitionResponse };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = termLifecycleTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    const term = await transitionTermLifecycle(prisma, {
      termId: id,
      transition: parsed.data.transition,
      expectedStatus: parsed.data.expectedStatus,
    });
    return ok({ term: toTermDto(term) } satisfies TermLifecycleTransitionResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Term not found" ? notFound(error.message) : badRequest(error.message);
    }
    if (error instanceof ConcurrencyConflictError) {
      return conflict(error.message);
    }
    throw error;
  }
}
