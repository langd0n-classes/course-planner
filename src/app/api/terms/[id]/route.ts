import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateTermSchema } from "@/lib/schemas";
import { ok, notFound, handleZodError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const term = await prisma.term.findUnique({
    where: { id },
    include: {
      instructor: true,
      modules: {
        orderBy: { sequence: "asc" },
        include: {
          sessions: { orderBy: { sequence: "asc" } },
        },
      },
      assessments: {
        orderBy: { code: "asc" },
        include: { skills: { include: { skill: true } } },
      },
    },
  });
  if (!term) return notFound("Term not found");
  return ok(term);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateTermSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.startDate) data.startDate = new Date(parsed.data.startDate);
  if (parsed.data.endDate) data.endDate = new Date(parsed.data.endDate);

  const term = await prisma.term.update({ where: { id }, data });
  return ok(term);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.term.delete({ where: { id } });
  return ok({ deleted: true });
}
