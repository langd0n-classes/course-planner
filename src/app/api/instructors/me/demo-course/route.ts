import prisma from "@/lib/prisma";
import { created, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { loadDemoCourse } from "@/services/redesign/demo-course-service";
import type { LoadDemoCourseResponse } from "@/lib/redesign-contract";

export async function POST() {
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  const result = await loadDemoCourse(prisma, instructor.id);
  return result.created
    ? created(result satisfies LoadDemoCourseResponse)
    : ok(result satisfies LoadDemoCourseResponse);
}
