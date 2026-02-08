import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createTermSchema } from "@/lib/schemas";
import { ok, created, handleZodError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const instructorId = searchParams.get("instructorId");

  const terms = await prisma.term.findMany({
    where: instructorId ? { instructorId } : undefined,
    include: {
      instructor: true,
      _count: { select: { modules: true, assessments: true } },
    },
    orderBy: { startDate: "desc" },
  });
  return ok(terms);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createTermSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const term = await prisma.term.create({
    data: {
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    },
  });
  return created(term);
}
