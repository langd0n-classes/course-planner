import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateSessionSchema } from "@/lib/schemas";
import { ok, notFound, handleZodError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      module: true,
      coverages: { include: { skill: true } },
      assessments: true,
      artifacts: true,
    },
  });
  if (!session) return notFound("Session not found");
  return ok(session);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateSessionSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.date !== undefined) {
    data.date = parsed.data.date ? new Date(parsed.data.date) : null;
  }

  // Auto-set canceledAt when status changes to canceled
  if (parsed.data.status === "canceled") {
    data.canceledAt = new Date();
  } else if (parsed.data.status === "scheduled") {
    // Clear cancellation fields when re-scheduling
    data.canceledAt = null;
    data.canceledReason = null;
  }

  const session = await prisma.session.update({
    where: { id },
    data,
    include: {
      module: true,
      coverages: { include: { skill: true } },
    },
  });
  return ok(session);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.session.delete({ where: { id } });
  return ok({ deleted: true });
}
