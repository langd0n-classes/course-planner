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

describe("Activity Type versions route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("lists versions ordered by revision", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityType: { findUnique: vi.fn(async () => ({ id: "at-1", instructorId: "10000000-0000-4000-8000-000000000001", currentVersion: null })) },
        activityTypeVersion: {
          findMany: vi.fn(async () => [
            {
              id: "20000000-0000-4000-8000-000000000001",
              activityTypeId: "at-1",
              revision: 1,
              label: "Discussion",
              description: null,
              changeSummary: null,
              publishedAt: null,
            },
          ]),
        },
      }),
    );

    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-types/at-1/versions"), {
      params: Promise.resolve({ id: "at-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      versions: [
        {
          id: "20000000-0000-4000-8000-000000000001",
          activityTypeId: "at-1",
          revision: 1,
          label: "Discussion",
          description: null,
          changeSummary: null,
          publishedAt: null,
        },
      ],
    });
  });

  it("returns 409 when expectedCurrentVersionId loses a race", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityType: {
          findUnique: vi.fn(async () => ({
            id: "at-1",
            instructorId: "10000000-0000-4000-8000-000000000001",
            currentVersionId: "20000000-0000-4000-8000-000000000002",
            currentVersion: { id: "20000000-0000-4000-8000-000000000002", activityTypeId: "at-1", revision: 2, publishedAt: null },
          })),
        },
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/activity-types/at-1/versions", {
        method: "POST",
        body: JSON.stringify({ expectedCurrentVersionId: "20000000-0000-4000-8000-000000000001", label: "Studio" }),
      }),
      { params: Promise.resolve({ id: "at-1" }) },
    );

    expect(response.status).toBe(409);
  });

  it("creates a new version and returns 201", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityType: {
          findUnique: vi.fn(async () => ({
            id: "at-1",
            instructorId: "10000000-0000-4000-8000-000000000001",
            currentVersionId: "20000000-0000-4000-8000-000000000001",
            currentVersion: { id: "20000000-0000-4000-8000-000000000001", activityTypeId: "at-1", revision: 1, publishedAt: null },
          })),
          updateMany: vi.fn(async () => ({ count: 1 })),
        },
        activityTypeVersion: {
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "20000000-0000-4000-8000-000000000002", ...data })),
        },
      }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/activity-types/at-1/versions", {
        method: "POST",
        body: JSON.stringify({ expectedCurrentVersionId: "20000000-0000-4000-8000-000000000001", label: "Studio", publish: true }),
      }),
      { params: Promise.resolve({ id: "at-1" }) },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.version.revision).toBe(2);
    expect(body.version.label).toBe("Studio");
    expect(body.version.publishedAt).not.toBeNull();
  });
});
