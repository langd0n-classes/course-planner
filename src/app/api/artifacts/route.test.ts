import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("artifacts collection route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue({
      id: "instructor-1",
      email: "alice@example.edu",
      name: "Alice",
    });
  });

  it("creates an artifact with durable URI validation", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        artifact: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "11111111-1111-4111-8111-111111111111",
            archivedAt: null,
            ...data,
          })),
        },
        session: {
          findUnique: vi.fn(async () => ({
            id: "22222222-2222-4222-8222-222222222222",
            term: { status: "active", course: { instructorId: "instructor-1" } },
            termLearningModule: null,
          })),
        },
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/artifacts", {
        method: "POST",
        body: JSON.stringify({
          parentType: "session",
          sessionId: "22222222-2222-4222-8222-222222222222",
          artifactType: "slides",
          sourceType: "generated_file",
          title: "Week 1 slides",
          uri: "s3://bucket/week-1/slides.pdf",
          filename: "slides.pdf",
          mimeType: "application/pdf",
          generatorKey: "slides-v1",
          generatedAt: "2026-07-12T18:00:00.000Z",
          metadata: { promptVersion: 2 },
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      artifact: {
        id: "11111111-1111-4111-8111-111111111111",
        parentType: "session",
        learningModuleVersionId: null,
        topicVersionId: null,
        sessionId: "22222222-2222-4222-8222-222222222222",
        assessmentId: null,
        artifactType: "slides",
        sourceType: "generated_file",
        title: "Week 1 slides",
        uri: "s3://bucket/week-1/slides.pdf",
        filename: "slides.pdf",
        mimeType: "application/pdf",
        generatorKey: "slides-v1",
        generatedAt: "2026-07-12T18:00:00.000Z",
        metadata: { promptVersion: 2 },
        archivedAt: null,
      },
    });
  });

  it("lists artifacts with archived filtering off by default", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        artifact: {
          findMany: vi.fn(async () => [
            {
              id: "11111111-1111-4111-8111-111111111111",
              parentType: "assessment",
              learningModuleVersionId: null,
              topicVersionId: null,
              sessionId: null,
              assessmentId: "33333333-3333-4333-8333-333333333333",
              artifactType: "handout",
              sourceType: "external_uri",
              title: "Spec",
              uri: "https://example.edu/spec",
              filename: null,
              mimeType: "text/html",
              archivedAt: null,
            },
          ]),
        },
        assessment: {
          findUnique: vi.fn(async () => ({
            id: "33333333-3333-4333-8333-333333333333",
            term: { status: "active", course: { instructorId: "instructor-1" } },
            topics: [],
          })),
        },
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/artifacts?assessmentId=33333333-3333-4333-8333-333333333333"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      artifacts: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          parentType: "assessment",
          learningModuleVersionId: null,
          topicVersionId: null,
          sessionId: null,
          assessmentId: "33333333-3333-4333-8333-333333333333",
          artifactType: "handout",
          sourceType: "external_uri",
          title: "Spec",
          uri: "https://example.edu/spec",
          filename: null,
          mimeType: "text/html",
          generatorKey: null,
          generatedAt: null,
          metadata: null,
          archivedAt: null,
        },
      ],
    });
  });
});
