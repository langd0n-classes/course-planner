import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("artifact detail route", () => {
  beforeEach(() => {
    prismaMock.artifact.findUnique.mockReset();
    prismaMock.$transaction.mockReset();
  });

  it("archives an artifact through PATCH", async () => {
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
            uri: "s3://bucket/week-1/slides.pdf",
            filename: "slides.pdf",
            mimeType: "application/pdf",
            generatorKey: null,
            generatedAt: null,
            metadata: null,
            archivedAt: null,
          })),
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "artifact-1",
            parentType: "session",
            learningModuleVersionId: null,
            topicVersionId: null,
            sessionId: "session-1",
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
      }),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/artifacts/artifact-1", {
        method: "PATCH",
        body: JSON.stringify({
          archivedAt: "2026-07-12T18:00:00.000Z",
        }),
      }),
      { params: Promise.resolve({ id: "artifact-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      artifact: {
        id: "artifact-1",
        parentType: "session",
        learningModuleVersionId: null,
        topicVersionId: null,
        sessionId: "session-1",
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
          findUnique: vi.fn(async () => ({ id: "artifact-1" })),
          delete: vi.fn(async () => ({ id: "artifact-1" })),
        },
      }),
    );

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new Request("http://localhost/api/artifacts/artifact-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "artifact-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
  });

  it("returns 404 for missing artifacts", async () => {
    prismaMock.artifact.findUnique.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/artifacts/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Artifact not found" });
  });
});
