import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { badRequest, created, notFound, ok, unauthorized } from "@/lib/api-helpers";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import {
  DomainInvariantError,
  ExemplarImportService,
  genericDemoExemplarSnapshot,
  getOwnedCourse,
} from "@/services/redesign";

const exemplarImportRequestSchema = z.object({
  mode: z.enum(["stage", "preview", "apply"]),
  snapshot: z.unknown().optional(),
});

const importer = new ExemplarImportService();

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const instructor = await getAuthenticatedInstructor(prisma);
  if (!instructor) return unauthorized();

  try {
    await getOwnedCourse(prisma, instructor.id, id);
  } catch (error) {
    if (error instanceof DomainInvariantError) return notFound(error.message);
    throw error;
  }

  const body = await request.json();
  const parsed = exemplarImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
  }

  const snapshot = parsed.data.snapshot ?? genericDemoExemplarSnapshot;

  try {
    if (parsed.data.mode === "stage") {
      const staged = importer.stage(snapshot);
      return ok({
        kind: "staged",
        snapshotId: staged.snapshot.snapshotId,
        snapshotFingerprint: staged.snapshotFingerprint,
        exclusions: staged.exclusions,
      });
    }

    if (parsed.data.mode === "preview") {
      const staged = importer.stage(snapshot);
      return ok({ kind: "preview", preview: importer.preview(staged) });
    }

    const result = await importer.apply(prisma, {
      instructorId: instructor.id,
      courseId: id,
      snapshot,
    });
    return created({ kind: "applied", result });
  } catch (error) {
    if (error instanceof DomainInvariantError) {
      return error.message === "Course not found" ? notFound(error.message) : badRequest(error.message);
    }
    throw error;
  }
}
