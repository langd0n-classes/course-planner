import prisma from "@/lib/prisma";
import { ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import type { GetCurrentInstructorResponse } from "@/lib/redesign-contract";

export type { GetCurrentInstructorResponse };

export async function GET() {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();
  return ok({ instructor } satisfies GetCurrentInstructorResponse);
}
