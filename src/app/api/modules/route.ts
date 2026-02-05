import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createModuleSchema } from "@/lib/schemas";
import { ok, created, handleZodError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const termId = searchParams.get("termId");

  const modules = await prisma.module.findMany({
    where: termId ? { termId } : undefined,
    include: {
      sessions: { orderBy: { sequence: "asc" } },
      _count: { select: { sessions: true } },
    },
    orderBy: { sequence: "asc" },
  });
  return ok(modules);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createModuleSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const mod = await prisma.module.create({ data: parsed.data });
  return created(mod);
}
