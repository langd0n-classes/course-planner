import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateAssessmentSchema } from "@/lib/schemas";
import { ok, notFound, handleZodError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: {
      skills: { include: { skill: true } },
      session: true,
      artifacts: true,
    },
  });
  if (!assessment) return notFound("Assessment not found");
  return ok(assessment);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateAssessmentSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const { skillIds, ...data } = parsed.data;
  const updateData: Record<string, unknown> = { ...data };
  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }

  // If skillIds provided, replace them
  if (skillIds) {
    await prisma.assessmentSkill.deleteMany({ where: { assessmentId: id } });
    await prisma.assessmentSkill.createMany({
      data: skillIds.map((skillId) => ({ assessmentId: id, skillId })),
    });
  }

  const assessment = await prisma.assessment.update({
    where: { id },
    data: updateData,
    include: { skills: { include: { skill: true } } },
  });
  return ok(assessment);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.assessment.delete({ where: { id } });
  return ok({ deleted: true });
}
