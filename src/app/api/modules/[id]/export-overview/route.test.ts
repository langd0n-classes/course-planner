import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    module: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "./route";

const mockFindUnique = prisma.module.findUnique as unknown as Mock;

const MODULE_ID = "885046d0-c1b3-4abd-a45a-7409062da4b6";

describe("GET /api/modules/[id]/export-overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when module not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(new NextRequest("http://localhost/api/modules/x/export-overview"), {
      params: Promise.resolve({ id: MODULE_ID }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("not found") });
  });

  it("returns a docx attachment for the module overview", async () => {
    mockFindUnique.mockResolvedValue({
      id: MODULE_ID,
      code: "LM-01",
      title: "Foundations",
      description: "Getting started",
      learningObjectives: ["Understand variables"],
      term: {
        courseCode: "TEST-100",
      },
      sessions: [
        {
          id: "21b4d1a8-d846-40c1-ac8f-991c6d9a61bf",
          code: "lec-01",
          title: "Intro",
          sessionType: "lecture",
          date: new Date("2026-01-20"),
          description: "First session.",
          status: "scheduled",
          coverages: [
            {
              id: "c1",
              level: "introduced",
              skill: { code: "A01", description: "Write expressions" },
            },
          ],
          assessments: [
            {
              code: "GAIE-01",
              title: "First assignment",
              assessmentType: "gaie",
              dueDate: new Date("2026-02-01"),
            },
          ],
        },
      ],
    } as never);

    const res = await GET(new NextRequest("http://localhost/api/modules/x/export-overview"), {
      params: Promise.resolve({ id: MODULE_ID }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="test-100-lm-01-foundations-overview.docx"',
    );

    const body = Buffer.from(await res.arrayBuffer());
    expect(body.subarray(0, 2).toString()).toBe("PK");
  });
});
