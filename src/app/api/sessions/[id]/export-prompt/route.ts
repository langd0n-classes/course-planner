import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notFound } from "@/lib/api-helpers";
import {
  buildSessionPromptText,
  exportFilename,
} from "@/lib/exporters";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      module: {
        include: {
          term: {
            select: {
              courseCode: true,
              code: true,
              name: true,
            },
          },
          sessions: {
            orderBy: { sequence: "asc" },
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
      coverages: {
        include: {
          skill: true,
        },
      },
      assessments: {
        orderBy: { code: "asc" },
        select: {
          title: true,
          assessmentType: true,
        },
      },
    },
  });

  if (!session) return notFound("Session not found");

  const orderedTitles = session.module.sessions.map((item) => item.title);
  const sessionIndex = session.module.sessions.findIndex((item) => item.id === session.id);

  const text = buildSessionPromptText({
    course: {
      courseCode: session.module.term.courseCode,
      termName: session.module.term.name,
    },
    session: {
      code: session.code,
      title: session.title,
      sessionType: session.sessionType,
      date: session.date ? session.date.toISOString() : null,
      description: session.description,
    },
    module: {
      code: session.module.code,
      title: session.module.title,
    },
    skills: session.coverages.map((coverage) => ({
      code: coverage.skill.code,
      description: coverage.skill.description,
      level: coverage.level,
    })),
    priorSessionTitles: sessionIndex > 0 ? orderedTitles.slice(0, sessionIndex) : [],
    upcomingSessionTitles:
      sessionIndex >= 0 ? orderedTitles.slice(sessionIndex + 1) : [],
    assessments: session.assessments,
  });

  return new NextResponse(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(
        `${session.module.term.courseCode}-${session.module.term.code}-${session.code}-${session.title}-prompt`,
        "txt",
      )}"`,
    },
  });
}
