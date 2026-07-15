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

const topicVersionId = "20000000-0000-4000-8000-000000000001";

describe("Activity Topic actions route", () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue(instructor());
  });

  it("returns 401 when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await import("./route");
    const response = await GET(new NextRequest("http://localhost/api/activity-versions/av-1/topic-actions"), {
      params: Promise.resolve({ id: "av-1" }),
    });
    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid replace payload", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/activity-versions/av-1/topic-actions", {
        method: "PUT",
        body: JSON.stringify({ actions: [{ topicVersionId: "not-a-uuid", action: "introduced" }] }),
      }),
      { params: Promise.resolve({ id: "av-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for a duplicate topicVersionId/action pair in one payload", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/activity-versions/av-1/topic-actions", {
        method: "PUT",
        body: JSON.stringify({
          actions: [
            { topicVersionId, action: "introduced" },
            { topicVersionId, action: "introduced" },
          ],
        }),
      }),
      { params: Promise.resolve({ id: "av-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("replaces topic actions and returns siblings", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityVersion: {
          findUnique: vi.fn(async () => ({
            id: "av-1",
            activity: { id: "activity-1", courseId: "course-1", course: { instructorId: instructor().id } },
          })),
        },
        topicVersion: {
          findUnique: vi.fn(async () => ({ topic: { courseId: "course-1" } })),
        },
        activityVersionTopicAction: {
          deleteMany: vi.fn(async () => ({ count: 0 })),
          createMany: vi.fn(async () => ({ count: 1 })),
          findMany: vi.fn(async (args: { where?: { activityVersionId?: string } }) => {
            if (args.where?.activityVersionId) {
              return [
                {
                  id: "row-1",
                  activityVersionId: "av-1",
                  topicVersionId,
                  action: "introduced",
                  notes: null,
                  provenance: null,
                },
              ];
            }
            return [];
          }),
        },
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/activity-versions/av-1/topic-actions", {
        method: "PUT",
        body: JSON.stringify({ actions: [{ topicVersionId, action: "introduced" }] }),
      }),
      { params: Promise.resolve({ id: "av-1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.topicActions).toEqual([
      {
        id: "row-1",
        activityVersionId: "av-1",
        topicVersionId,
        action: "introduced",
        notes: null,
        provenance: null,
        siblings: [],
      },
    ]);
  });

  it("returns 404 for a cross-Course Topic version reference", async () => {
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        activityVersion: {
          findUnique: vi.fn(async () => ({
            id: "av-1",
            activity: { id: "activity-1", courseId: "course-1", course: { instructorId: instructor().id } },
          })),
        },
        topicVersion: {
          findUnique: vi.fn(async () => null),
        },
      }),
    );

    const { PUT } = await import("./route");
    const response = await PUT(
      new NextRequest("http://localhost/api/activity-versions/av-1/topic-actions", {
        method: "PUT",
        body: JSON.stringify({ actions: [{ topicVersionId, action: "introduced" }] }),
      }),
      { params: Promise.resolve({ id: "av-1" }) },
    );
    expect(response.status).toBe(404);
  });
});
