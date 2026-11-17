import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";

const prismaMock = {
  artifact: {
    findUnique: vi.fn(),
  },
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

describe("artifact detail route", () => {
  beforeEach(() => {
    prismaMock.artifact.findUnique.mockReset();
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue({
      id: "instructor-1",
      email: "alice@example.edu",
      name: "Alice",
    });
  });

  it("archives an artifact through PATCH", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        artifact: {
          findUnique: vi.fn(async () => ({
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
            generatorKey: null,
            generatedAt: null,
            metadata: null,
            archivedAt: null,
            session: {
              term: { course: { instructorId: "instructor-1" } },
            },
            assessment: null,
            learningModuleVersion: null,
            topicVersion: null,
          })),
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
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
            generatorKey: null,
            generatedAt: null,
            metadata: null,
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

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/artifacts/11111111-1111-4111-8111-111111111111", {
        method: "PATCH",
        body: JSON.stringify({
          archivedAt: "2026-07-12T18:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(200);
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
        generatorKey: null,
        generatedAt: null,
        metadata: null,
        archivedAt: "2026-07-12T18:00:00.000Z",
      },
    });
  });

  it("deletes an artifact through DELETE", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        artifact: {
          findUnique: vi.fn(async () => ({
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
            generatorKey: null,
            generatedAt: null,
            metadata: null,
            archivedAt: null,
            session: {
              term: { course: { instructorId: "instructor-1" } },
            },
            assessment: null,
            learningModuleVersion: null,
            topicVersion: null,
          })),
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
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
            generatorKey: null,
            generatedAt: null,
            metadata: null,
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

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new Request("http://localhost/api/artifacts/11111111-1111-4111-8111-111111111111", { method: "DELETE" }),
      { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: "archived",
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
        generatorKey: null,
        generatedAt: null,
        metadata: null,
        archivedAt: expect.any(String),
      },
    });
  });

  it("returns a guarded hard-removal preview through DELETE mode=hard-preview", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        artifact: {
          findUnique: vi.fn(async () => ({
            id: "11111111-1111-4111-8111-111111111111",
            title: "Week 1 slides",
            session: null,
            assessment: null,
            learningModuleVersion: {
              publishedAt: new Date("2026-01-01T00:00:00.000Z"),
              learningModule: { course: { instructorId: "instructor-1" } },
            },
            topicVersion: null,
          })),
        },
      }),
    );

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new Request("http://localhost/api/artifacts/11111111-1111-4111-8111-111111111111?mode=hard-preview", { method: "DELETE" }),
      { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      kind: "hard_removal_preview",
      artifactId: "11111111-1111-4111-8111-111111111111",
      canRemove: false,
      blockers: [
        {
          code: "published_learning_module_version",
          count: 1,
          message: "Hard removal may not mutate published Learning Module history.",
        },
      ],
    });
  });

  it("returns 404 for missing artifacts", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        artifact: {
          findUnique: vi.fn(async () => null),
        },
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/artifacts/missing"),
      { params: Promise.resolve({ id: "22222222-2222-4222-8222-222222222222" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Artifact not found" });
  });
});
