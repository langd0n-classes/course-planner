import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
import { DomainInvariantError } from "@/services/redesign";

const mocks = vi.hoisted(() => ({
  prisma: {},
  getOwnedCourse: vi.fn(),
  apply: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: mocks.prisma,
}));

vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: vi.fn(),
}));

vi.mock("@/services/redesign", async () => {
  const actual = await vi.importActual<typeof import("@/services/redesign")>("@/services/redesign");
  return {
    ...actual,
    getOwnedCourse: mocks.getOwnedCourse,
    ExemplarImportService: class {
      stage(snapshot: unknown) {
        return {
          snapshot: { snapshotId: "generic-intro-data-science-v1" },
          snapshotFingerprint: "abc123",
          exclusions: [],
          raw: snapshot,
        };
      }

      preview() {
        return { snapshotId: "generic-intro-data-science-v1", ambiguities: [], provenance: [] };
      }

      apply = mocks.apply;
    },
  };
});

const authMock = vi.mocked(getAuthenticatedInstructor);

function request(body: unknown) {
  return new NextRequest("http://localhost/api/courses/course-1/exemplar-import", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("exemplar import route", () => {
  beforeEach(() => {
    authMock.mockReset();
    mocks.getOwnedCourse.mockReset();
    mocks.apply.mockReset();
  });

  it("returns 401 for unauthenticated requests", async () => {
    authMock.mockResolvedValue(null);
    const { POST } = await import("./route");
    const response = await POST(request({ mode: "preview" }), { params: Promise.resolve({ id: "course-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 404 when the course is absent or owned by another instructor", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "redacted", name: "Instructor A" });
    mocks.getOwnedCourse.mockRejectedValue(new DomainInvariantError("Course not found"));

    const { POST } = await import("./route");
    const response = await POST(request({ mode: "preview" }), { params: Promise.resolve({ id: "course-x" }) });
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Course not found" });
  });

  it("validates mode and applies for the authenticated instructor", async () => {
    authMock.mockResolvedValue({ id: "instructor-1", email: "redacted", name: "Instructor A" });
    mocks.getOwnedCourse.mockResolvedValue({ id: "course-1", instructorId: "instructor-1" });
    mocks.apply.mockResolvedValue({ courseId: "course-1", ambiguities: [], exclusions: [] });

    const { POST } = await import("./route");
    const invalid = await POST(request({ mode: "export" }), { params: Promise.resolve({ id: "course-1" }) });
    expect(invalid.status).toBe(400);

    const applied = await POST(request({ mode: "apply" }), { params: Promise.resolve({ id: "course-1" }) });
    expect(applied.status).toBe(201);
    expect(mocks.apply).toHaveBeenCalledWith(mocks.prisma, {
      instructorId: "instructor-1",
      courseId: "course-1",
      snapshot: expect.anything(),
    });
  });
});
