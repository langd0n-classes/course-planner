import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createSkillSchema } from "@/lib/schemas";
import { ok, created, handleZodError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const termId = searchParams.get("termId");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (termId) {
    // Get global skills + term-specific skills
    where.OR = [{ isGlobal: true }, { termId }];
  }
  if (category) where.category = category;

  const skills = await prisma.skill.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { code: "asc" },
    include: {
      coverages: true,
      _count: { select: { coverages: true, assessmentSkills: true } },
    },
  });
  return ok(skills);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createSkillSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const skill = await prisma.skill.create({ data: parsed.data });
  return created(skill);
}
