import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createSessionSchema } from "@/lib/schemas";
import { ok, created, handleZodError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const moduleId = searchParams.get("moduleId");
  const termId = searchParams.get("termId");

  const where: Record<string, unknown> = {};
  if (moduleId) where.moduleId = moduleId;
  if (termId) where.module = { termId };

  const sessions = await prisma.session.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      module: true,
      coverages: { include: { skill: true } },
      _count: { select: { coverages: true } },
    },
    orderBy: [{ module: { sequence: "asc" } }, { sequence: "asc" }],
  });
  return ok(sessions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const session = await prisma.session.create({
    data: {
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
    },
  });
  return created(session);
}
