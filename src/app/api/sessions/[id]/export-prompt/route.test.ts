import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  default: {
    session: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "./route";

const mockFindUnique = prisma.session.findUnique as unknown as Mock;

const SESSION_ID = "21b4d1a8-d846-40c1-ac8f-991c6d9a61bf";

describe("GET /api/sessions/[id]/export-prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when session not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await GET(new NextRequest("http://localhost/api/sessions/x/export-prompt"), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining("not found") });
  });

  it("returns a text attachment with session prompt context", async () => {
    mockFindUnique.mockResolvedValue({
      id: SESSION_ID,
      code: "lec-05",
      title: "Programming Basics",
      sessionType: "lecture",
      date: new Date("2026-01-28"),
      description: "Variables, expressions, and calling functions.",
      module: {
        id: "885046d0-c1b3-4abd-a45a-7409062da4b6",
        code: "LM-01",
        title: "Foundations",
        term: {
          code: "S26",
          name: "Spring 2026",
          courseCode: "TEST-100",
        },
        sessions: [
          { id: "prior-1", title: "Welcome", sequence: 0 },
          { id: SESSION_ID, title: "Programming Basics", sequence: 1 },
          { id: "next-1", title: "Data types", sequence: 2 },
        ],
      },
      coverages: [
        {
          level: "introduced",
          skill: { code: "A01", description: "Write expressions" },
        },
      ],
      assessments: [
        {
          title: "First assignment",
          assessmentType: "gaie",
        },
      ],
    } as never);

    const res = await GET(new NextRequest("http://localhost/api/sessions/x/export-prompt"), {
      params: Promise.resolve({ id: SESSION_ID }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain(
      'attachment; filename="test-100-s26-lec-05-programming-basics-prompt.txt"',
    );

    const body = await res.text();
    expect(body).toContain("Programming Basics");
    expect(body).toContain("Welcome");
    expect(body).toContain("Data types");
    expect(body).toContain("First assignment");
  });
});
