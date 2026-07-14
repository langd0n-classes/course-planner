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
  return { id: "10000000-0000-4000-8000-000000000001", email: "alice@example.edu", name: "Alice" };
}

describe("Activity Type detail route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("returns 404 for another instructor's Activity Type", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ activityType: { findUnique: vi.fn(async () => null) } }),
    );

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-types/at-1"), {
      params: Promise.resolve({ id: "at-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns an owned Activity Type even when archived", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityType: {
          findUnique: vi.fn(async () => ({
            id: "at-1",
            instructorId: "10000000-0000-4000-8000-000000000001",
            behaviorFamily: "assessment",
            currentVersionId: "20000000-0000-4000-8000-000000000001",
            archivedAt: new Date("2026-07-01T00:00:00.000Z"),
            currentVersion: {
              id: "20000000-0000-4000-8000-000000000001",
              activityTypeId: "at-1",
              revision: 1,
              label: "Exam",
              description: null,
              changeSummary: null,
              publishedAt: null,
            },
          })),
        },
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-types/at-1"), {
      params: Promise.resolve({ id: "at-1" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.activityType.archivedAt).toBe("2026-07-01T00:00:00.000Z");
  });

  it("rejects an empty PATCH body", async () => {
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/activity-types/at-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "at-1" }) },
    );

    expect(response.status).toBe(400);
  });

  it("archives an owned Activity Type via PATCH", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityType: {
          findUnique: vi.fn(async () => ({
            id: "at-1",
            instructorId: "10000000-0000-4000-8000-000000000001",
            behaviorFamily: "meeting",
            currentVersionId: "20000000-0000-4000-8000-000000000001",
            archivedAt: null,
            currentVersion: {
              id: "20000000-0000-4000-8000-000000000001",
              activityTypeId: "at-1",
              revision: 1,
              label: "Discussion",
              description: null,
              changeSummary: null,
              publishedAt: null,
            },
          })),
          update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
        },
      }),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new NextRequest("http://localhost/api/activity-types/at-1", {
        method: "PATCH",
        body: JSON.stringify({ archivedAt: "2026-07-14T00:00:00.000Z" }),
      }),
      { params: Promise.resolve({ id: "at-1" }) },
    );

    expect(response.status).toBe(200);
  });
});
