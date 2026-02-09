import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { ok, badRequest, notFound, serverError } from "@/lib/api-helpers";
import { z } from "zod";
import { validateRedistribution } from "@/domain/whatif";
import { loadTermData } from "@/lib/term-data";

const cancelSchema = z.object({
  reason: z.string().optional(),
  redistributions: z
    .array(
      z.object({
        skillId: z.string().uuid(),
        level: z.enum(["introduced", "practiced", "assessed"]),
        targetSessionId: z.string().uuid(),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Invalid request", parsed.error.flatten().fieldErrors);
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: { module: { select: { termId: true } } },
    });
    if (!session) return notFound("Session not found");
    if (session.status === "canceled") {
      return badRequest("Session is already canceled");
    }

    const { reason, redistributions } = parsed.data;
    const termId = session.module.termId;

    // Validate redistribution targets
    if (redistributions.length > 0) {
      const targetIds = [...new Set(redistributions.map((r) => r.targetSessionId))];
      const targets = await prisma.session.findMany({
        where: { id: { in: targetIds } },
        include: { module: { select: { termId: true } } },
      });

      const targetMap = new Map(targets.map((t) => [t.id, t]));

      const errors: string[] = [];
      for (const tid of targetIds) {
        const target = targetMap.get(tid);
        if (!target) {
          errors.push(`Target session not found: ${tid}`);
          continue;
        }
        if (tid === id) {
          errors.push(`Cannot redistribute to the session being canceled: ${tid}`);
          continue;
        }
        if (target.status === "canceled") {
          errors.push(`Target session is canceled: ${tid}`);
          continue;
        }
        if (target.module.termId !== termId) {
          errors.push(`Target session ${tid} is in a different term`);
        }
      }

      if (errors.length > 0) {
        return badRequest("Invalid redistribution targets", errors);
      }
    }

    // Validate coverage ordering after redistribution
    if (redistributions.length > 0) {
      const termData = await loadTermData(termId);
      const violations = validateRedistribution(
        termData,
        id,
        redistributions.map((r) => ({
          skillId: r.skillId,
          level: r.level,
          fromSessionId: id,
          toSessionId: r.targetSessionId,
        })),
      );

      if (violations.length > 0) {
        return badRequest("Redistribution would break coverage ordering", violations);
      }
    }

    await prisma.$transaction(async (tx) => {
      // Mark session as canceled
      await tx.session.update({
        where: { id },
        data: {
          status: "canceled",
          canceledAt: new Date(),
          canceledReason: reason ?? null,
        },
      });

      // Create redistribution coverage entries
      for (const redist of redistributions) {
        await tx.coverage.create({
          data: {
            sessionId: redist.targetSessionId,
            skillId: redist.skillId,
            level: redist.level,
            redistributedFrom: id,
            redistributedAt: new Date(),
          },
        });
      }
    });

    // Return updated session
    const updated = await prisma.session.findUnique({
      where: { id },
      include: {
        module: true,
        coverages: { include: { skill: true } },
      },
    });

    return ok(updated);
  } catch (error) {
    console.error("Cancel session error:", error);
    return serverError("Failed to cancel session");
  }
}
