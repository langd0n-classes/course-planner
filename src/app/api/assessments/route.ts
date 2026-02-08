import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createAssessmentSchema } from "@/lib/schemas";
import { ok, created, handleZodError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const termId = searchParams.get("termId");

  const assessments = await prisma.assessment.findMany({
    where: termId ? { termId } : undefined,
    include: {
      skills: { include: { skill: true } },
      session: true,
    },
    orderBy: { code: "asc" },
  });
  return ok(assessments);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createAssessmentSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const { skillIds, ...data } = parsed.data;

  const assessment = await prisma.assessment.create({
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      skills: {
        create: skillIds.map((skillId) => ({ skillId })),
      },
    },
    include: { skills: { include: { skill: true } } },
  });
  return created(assessment);
}
