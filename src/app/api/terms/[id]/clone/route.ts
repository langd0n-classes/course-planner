import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { created, notFound, badRequest } from "@/lib/api-helpers";
import { z } from "zod";

const cloneTermSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  instructorId: z.string().uuid().optional(), // Default to same instructor
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const parsed = cloneTermSchema.safeParse(body);
  if (!parsed.success)
    return badRequest(
      "Validation failed",
      parsed.error.flatten().fieldErrors,
    );

  // Fetch the source term with all nested data
  const source = await prisma.term.findUnique({
    where: { id },
    include: {
      modules: {
        include: {
          sessions: {
            include: {
              coverages: true,
            },
          },
        },
      },
      assessments: {
        include: {
          skills: true,
        },
      },
    },
  });

  if (!source) return notFound("Source term not found");

  // Clone in a transaction
  const cloned = await prisma.$transaction(async (tx) => {
    // 1. Create the new term
    const newTerm = await tx.term.create({
      data: {
        instructorId: parsed.data.instructorId ?? source.instructorId,
        code: parsed.data.code,
        name: parsed.data.name,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        courseCode: source.courseCode,
        meetingPattern: source.meetingPattern ?? undefined,
        holidays: source.holidays ?? undefined,
        clonedFromId: id,
      },
    });

    // 2. Clone modules and sessions, tracking ID mappings
    const sessionIdMap = new Map<string, string>();

    for (const mod of source.modules) {
      const newMod = await tx.module.create({
        data: {
          termId: newTerm.id,
          sequence: mod.sequence,
          code: mod.code,
          title: mod.title,
          description: mod.description,
          learningObjectives: mod.learningObjectives,
        },
      });

      for (const session of mod.sessions) {
        const newSession = await tx.session.create({
          data: {
            moduleId: newMod.id,
            sequence: session.sequence,
            sessionType: session.sessionType,
            code: session.code,
            title: session.title,
            date: null, // Dates need to be set for the new term
            description: session.description,
            format: session.format,
            priorArt: [session.id, ...session.priorArt], // Link back to source
            notes: session.notes,
          },
        });
        sessionIdMap.set(session.id, newSession.id);

        // Clone coverages
        for (const cov of session.coverages) {
          await tx.coverage.create({
            data: {
              sessionId: newSession.id,
              skillId: cov.skillId, // Skills are shared (global) or need cloning
              level: cov.level,
              notes: cov.notes,
            },
          });
        }
      }
    }

    // 3. Clone assessments
    for (const assessment of source.assessments) {
      const newSessionId = assessment.sessionId
        ? sessionIdMap.get(assessment.sessionId)
        : null;

      await tx.assessment.create({
        data: {
          termId: newTerm.id,
          code: assessment.code,
          title: assessment.title,
          assessmentType: assessment.assessmentType,
          description: assessment.description,
          sessionId: newSessionId ?? null,
          dueDate: null, // Dates need to be set for the new term
          rubric: assessment.rubric ?? undefined,
          progressionStage: assessment.progressionStage,
          skills: {
            create: assessment.skills.map((s) => ({
              skillId: s.skillId,
            })),
          },
        },
      });
    }

    return newTerm;
  });

  // Return the full cloned term
  const result = await prisma.term.findUnique({
    where: { id: cloned.id },
    include: {
      modules: {
        include: { sessions: true },
      },
      assessments: {
        include: { skills: true },
      },
    },
  });

  return created(result);
}
