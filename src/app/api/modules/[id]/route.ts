import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateModuleSchema } from "@/lib/schemas";
import { ok, notFound, handleZodError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mod = await prisma.module.findUnique({
    where: { id },
    include: {
      sessions: {
        orderBy: { sequence: "asc" },
        include: { coverages: { include: { skill: true } } },
      },
    },
  });
  if (!mod) return notFound("Module not found");
  return ok(mod);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateModuleSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const mod = await prisma.module.update({ where: { id }, data: parsed.data });
  return ok(mod);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.module.delete({ where: { id } });
  return ok({ deleted: true });
}
