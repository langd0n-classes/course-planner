import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { createArtifactSchema } from "@/lib/schemas";
import { ok, created, handleZodError } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parentType = searchParams.get("parentType");
  const sessionId = searchParams.get("sessionId");
  const assessmentId = searchParams.get("assessmentId");

  const where: Record<string, unknown> = {};
  if (parentType) where.parentType = parentType;
  if (sessionId) where.sessionId = sessionId;
  if (assessmentId) where.assessmentId = assessmentId;

  const artifacts = await prisma.artifact.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { createdAt: "desc" },
  });
  return ok(artifacts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createArtifactSchema.safeParse(body);
  if (!parsed.success) return handleZodError(parsed.error);

  const artifact = await prisma.artifact.create({ data: parsed.data });
  return created(artifact);
}
