import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notFound } from "@/lib/api-helpers";
import {
  buildModuleOverviewDocx,
  exportFilename,
  type ModuleOverviewInput,
} from "@/lib/exporters";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const module = await prisma.module.findUnique({
    where: { id },
    include: {
      term: {
        select: {
          courseCode: true,
        },
      },
      sessions: {
        orderBy: { sequence: "asc" },
        include: {
          coverages: {
            include: {
              skill: true,
            },
          },
          assessments: {
            orderBy: { code: "asc" },
          },
        },
      },
    },
  });

  if (!module) return notFound("Module not found");

  const assessmentMap = new Map<string, ModuleOverviewInput["assessments"][number]>();
  for (const session of module.sessions) {
    for (const assessment of session.assessments) {
      assessmentMap.set(assessment.id, {
        code: assessment.code,
        title: assessment.title,
        assessmentType: assessment.assessmentType,
        dueDate: assessment.dueDate ? assessment.dueDate.toISOString() : null,
      });
    }
  }

  const docx = await buildModuleOverviewDocx({
    module: {
      code: module.code,
      title: module.title,
      description: module.description,
      learningObjectives: module.learningObjectives,
    },
    sessions: module.sessions.map((session) => ({
      code: session.code,
      title: session.title,
      sessionType: session.sessionType,
      date: session.date ? session.date.toISOString() : null,
      description: session.description,
      status: session.status,
      skillCoverages: session.coverages.map((coverage) => ({
        skillCode: coverage.skill.code,
        skillDescription: coverage.skill.description,
        level: coverage.level,
      })),
    })),
    assessments: [...assessmentMap.values()].sort((a, b) => a.code.localeCompare(b.code)),
  });

  return new NextResponse(docx, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${exportFilename(
        `${module.term.courseCode}-${module.code}-${module.title}-overview`,
        "docx",
      )}"`,
    },
  });
}
