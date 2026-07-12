import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, ok } from "@/lib/api-helpers";
import { cloneTermSchema } from "@/lib/redesign-schemas";
import { toTermDto } from "@/lib/redesign-serializers";
import { applyTermClone, DomainInvariantError, previewTermClone } from "@/services/redesign";
import type {
  CloneTermApplyResponse,
  CloneTermPreviewResponse,
  CloneTermRequest,
  CloneTermResponse,
} from "@/lib/redesign-contract";

export type {
  CloneTermApplyResponse,
  CloneTermPreviewResponse,
  CloneTermRequest,
  CloneTermResponse,
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = cloneTermSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  try {
    if (parsed.data.mode === "preview") {
      const preview = await previewTermClone(prisma, {
        sourceTermId: id,
        ...parsed.data,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      });
      return ok(preview satisfies CloneTermPreviewResponse);
    }

    const applied = await applyTermClone(prisma, {
      sourceTermId: id,
      ...parsed.data,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
    });
    return ok({
      kind: "applied",
      term: toTermDto(applied.term),
    } satisfies CloneTermApplyResponse);
  } catch (error) {
    if (error instanceof DomainInvariantError) return badRequest(error.message);
    throw error;
  }
}
