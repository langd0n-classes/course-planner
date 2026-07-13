import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const prismaMock = {
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}));

vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: vi.fn(),
}));

const authMock = vi.mocked(getAuthenticatedInstructor);

describe("courses collection route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
  });

  it("lists the authenticated instructor's courses with DTO-only fields", async () => {
    authMock.mockResolvedValue({
      id: "instructor-1",
      email: "alice@example.edu",
      name: "Alice",
    });
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        course: {
          findMany: vi.fn(async () => [
            {
              id: "course-1",
              instructorId: "instructor-1",
              shortId: "001",
              title: "Course Planning",
              titleIsPlaceholder: false,
              number: "CP 101",
              numberIsPlaceholder: false,
              description: "Workspace course",
              archivedAt: null,
              createdAt: new Date("2026-07-12T18:00:00.000Z"),
              updatedAt: new Date("2026-07-12T18:00:00.000Z"),
            },
          ]),
        },
      }),
    );

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      courses: [
        {
          id: "course-1",
          instructorId: "instructor-1",
          shortId: "001",
          title: "Course Planning",
          titleIsPlaceholder: false,
          number: "CP 101",
          numberIsPlaceholder: false,
          description: "Workspace course",
          archivedAt: null,
        },
      ],
    });
  });

  it("rejects creating a course on behalf of a different instructor", async () => {
    authMock.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      email: "alice@example.edu",
      name: "Alice",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/courses", {
        method: "POST",
        body: JSON.stringify({
          instructorId: "00000000-0000-4000-8000-000000000002",
          title: "Course Planning",
          number: "CP 101",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Cannot create a Course for another Instructor",
    });
  });
});
