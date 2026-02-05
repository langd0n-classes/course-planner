import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateCoverageSchema } from "@/lib/schemas";
import { ok, notFound, handleZodError } from "@/lib/api-helpers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateCoverageSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const coverage = await prisma.coverage.update({
    where: { id },
    data: parsed.data,
  });
  return ok(coverage);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.coverage.delete({ where: { id } });
  return ok({ deleted: true });
}
