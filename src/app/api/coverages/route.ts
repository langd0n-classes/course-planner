import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createCoverageSchema } from "@/lib/schemas";
import { ok, created, handleZodError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const skillId = searchParams.get("skillId");
  const termId = searchParams.get("termId");

  const where: Record<string, unknown> = {};
  if (sessionId) where.sessionId = sessionId;
  if (skillId) where.skillId = skillId;
  if (termId) where.session = { module: { termId } };

  const coverages = await prisma.coverage.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      session: { include: { module: true } },
      skill: true,
    },
    orderBy: { session: { sequence: "asc" } },
  });
  return ok(coverages);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCoverageSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const coverage = await prisma.coverage.create({
    data: parsed.data,
    include: { session: true, skill: true },
  });
  return created(coverage);
}
