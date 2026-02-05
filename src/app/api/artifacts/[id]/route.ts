import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { updateArtifactSchema } from "@/lib/schemas";
import { ok, notFound, handleZodError } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const artifact = await prisma.artifact.findUnique({ where: { id } });
  if (!artifact) return notFound("Artifact not found");
  return ok(artifact);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateArtifactSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const artifact = await prisma.artifact.update({
    where: { id },
    data: parsed.data,
  });
  return ok(artifact);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.artifact.delete({ where: { id } });
  return ok({ deleted: true });
}
