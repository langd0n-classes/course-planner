import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateSkillSchema } from "@/lib/schemas";
import { ok, notFound, handleZodError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const skill = await prisma.skill.findUnique({
    where: { id },
    include: {
      coverages: { include: { session: true } },
      assessmentSkills: { include: { assessment: true } },
    },
  });
  if (!skill) return notFound("Skill not found");
  return ok(skill);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSkillSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const skill = await prisma.skill.update({ where: { id }, data: parsed.data });
  return ok(skill);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.skill.delete({ where: { id } });
  return ok({ deleted: true });
}
