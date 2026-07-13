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

function instructor() {
  return {
    id: "instructor-1",
    email: "alice@example.edu",
    name: "Alice",
  };
}

describe("redesign ownership route guards", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
  });

  it("returns 401 for unauthenticated lifecycle transitions", async () => {
    authMock.mockResolvedValue(null);

    const { POST } = await import("./terms/[id]/lifecycle/route");
    const response = await POST(
      new NextRequest("http://localhost/api/terms/term-1/lifecycle", {
        method: "POST",
        body: JSON.stringify({ transition: "activate", expectedStatus: "planned" }),
      }),
      { params: Promise.resolve({ id: "term-1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 for cross-instructor delivered revisions", async () => {
    authMock.mockResolvedValue(instructor());
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        termLearningModule: {
          findUnique: vi.fn(async () => ({
            id: "tlm-1",
            term: { status: "active", course: { instructorId: "instructor-2" } },
          })),
        },
      }),
    );

    const { POST } = await import("./term-learning-modules/[id]/delivered-revisions/route");
    const response = await POST(
      new NextRequest("http://localhost/api/term-learning-modules/tlm-1/delivered-revisions", {
        method: "POST",
        body: JSON.stringify({
          expectedDeliveredLearningModuleVersionId: null,
          title: "Delivered revision",
        }),
      }),
      { params: Promise.resolve({ id: "tlm-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Term Learning Module not found" });
  });

  it("returns 404 for cross-instructor Sessions", async () => {
    authMock.mockResolvedValue(instructor());
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        session: {
          findUnique: vi.fn(async () => ({
            id: "session-1",
            term: { course: { instructorId: "instructor-2" } },
            termLearningModule: null,
          })),
        },
      }),
    );

    const { GET } = await import("./sessions/[id]/route");
    const response = await GET(
      new NextRequest("http://localhost/api/sessions/session-1"),
      { params: Promise.resolve({ id: "session-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Session not found" });
  });

  it("returns 404 for cross-instructor Assessments", async () => {
    authMock.mockResolvedValue(instructor());
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        assessment: {
          findUnique: vi.fn(async () => ({
            id: "assessment-1",
            term: { course: { instructorId: "instructor-2" } },
            topics: [],
          })),
        },
      }),
    );

    const { GET } = await import("./assessments/[id]/route");
    const response = await GET(
      new NextRequest("http://localhost/api/assessments/assessment-1"),
      { params: Promise.resolve({ id: "assessment-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Assessment not found" });
  });

  it("returns 404 for cross-instructor artifact collection parents", async () => {
    authMock.mockResolvedValue(instructor());
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        session: {
          findUnique: vi.fn(async () => ({
            id: "session-1",
            term: { course: { instructorId: "instructor-2" } },
            termLearningModule: null,
          })),
        },
      }),
    );

    const { GET } = await import("./artifacts/route");
    const response = await GET(
      new Request("http://localhost/api/artifacts?sessionId=session-1"),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Session not found" });
  });

  it("returns 404 for cross-instructor artifact detail access", async () => {
    authMock.mockResolvedValue(instructor());
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        artifact: {
          findUnique: vi.fn(async () => ({
            id: "artifact-1",
            parentType: "session",
            learningModuleVersionId: null,
            topicVersionId: null,
            sessionId: "session-1",
            assessmentId: null,
            artifactType: "slides",
            sourceType: "generated_file",
            title: "Week 1 slides",
            uri: "s3://bucket/slides.pdf",
            filename: null,
            mimeType: null,
            archivedAt: null,
            session: {
              term: { course: { instructorId: "instructor-2" } },
            },
            assessment: null,
            learningModuleVersion: null,
            topicVersion: null,
          })),
        },
      }),
    );

    const { GET } = await import("./artifacts/[id]/route");
    const response = await GET(
      new Request("http://localhost/api/artifacts/artifact-1"),
      { params: Promise.resolve({ id: "artifact-1" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Artifact not found" });
  });
});
