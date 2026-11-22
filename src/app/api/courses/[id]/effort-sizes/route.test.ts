import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAuthenticatedInstructor } from "@/lib/redesign-auth";
const prismaMock = { $transaction: vi.fn() };
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn() }));
const auth = vi.mocked(getAuthenticatedInstructor);
const rowId = "20000000-0000-4000-8000-000000000001";
const row = {
  id: rowId,
  courseId: "c",
  scale: "student",
  label: "Small",
  sequence: 0,
  minMinutes: 30,
  maxMinutes: 45,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const ctx = { params: Promise.resolve({ id: "c", entryId: rowId }) };
const request = (method: string, body?: object) =>
  new NextRequest("http://localhost/api/courses/c/effort-sizes", {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
describe.each(["sizes", "part-kinds"] as const)(
  "Course effort %s routes",
  (kind) => {
    async function routes() {
      return kind === "sizes"
        ? await import("./route")
        : await import("../effort-part-kinds/route");
    }
    async function itemRoutes() {
      return kind === "sizes"
        ? await import("./[entryId]/route")
        : await import("../effort-part-kinds/[entryId]/route");
    }
    beforeEach(() => {
      auth.mockResolvedValue({
        id: "i",
        email: "test@example.test",
        name: "Test",
      });
      prismaMock.$transaction.mockImplementation(async (fn) =>
        fn({
          course: { findUnique: async () => ({ id: "c" }) },
          courseEffortSize: {
            findMany: async () => [row],
            findFirst: async () => row,
            create: async ({ data }: { data: object }) => ({ ...row, ...data }),
            update: async ({ data }: { data: object }) => ({ ...row, ...data }),
            delete: async () => row,
          },
          courseEffortPartKind: {
            findMany: async () => [row],
            findFirst: async () => row,
            create: async ({ data }: { data: object }) => ({ ...row, ...data }),
            update: async ({ data }: { data: object }) => ({ ...row, ...data }),
            delete: async () => row,
          },
        }),
      );
    });
    it("returns the shared malformed JSON response for all mutations", async () => {
      const collection = await routes();
      const item = await itemRoutes();
      for (const [method, handler] of [["POST", collection.POST], ["PUT", collection.PUT], ["PATCH", item.PATCH]] as const) {
        const response = await handler(new NextRequest("http://localhost/api/test", { method, body: "{" }), ctx);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "The request body is not valid JSON." });
      }
    });
    it("requires authentication", async () => {
      auth.mockResolvedValue(null);
      expect((await (await routes()).GET(request("GET"), ctx)).status).toBe(
        401,
      );
    });
    it("returns 404 for an unowned Course", async () => {
      prismaMock.$transaction.mockImplementation(async (fn) =>
        fn({ course: { findUnique: async () => null } }),
      );
      expect((await (await routes()).GET(request("GET"), ctx)).status).toBe(
        404,
      );
    });
    it("lists, creates, edits, reorders and deletes entries", async () => {
      const collection = await routes();
      const item = await itemRoutes();
      const input =
        kind === "sizes"
          ? { label: " Small ", minMinutes: 30, maxMinutes: 45 }
          : { label: " Read " };
      expect((await collection.GET(request("GET"), ctx)).status).toBe(200);
      const created = await collection.POST(request("POST", input), ctx);
      expect(created.status).toBe(201);
      expect((await created.json()).entry.label).toBe(input.label.trim());
      expect((await item.PATCH(request("PATCH", input), ctx)).status).toBe(200);
      expect(
        (await collection.PUT(request("PUT", { ids: [rowId] }), ctx)).status,
      ).toBe(200);
      expect((await item.DELETE(request("DELETE"), ctx)).status).toBe(200);
    });
    it("rejects blank labels, invalid ranges and duplicate reorder IDs", async () => {
      const route = await routes();
      expect(
        (await route.POST(request("POST", { label: " " }), ctx)).status,
      ).toBe(400);
      if (kind === "sizes")
        expect(
          (
            await route.POST(
              request("POST", { label: "Bad", minMinutes: 10, maxMinutes: 1 }),
              ctx,
            )
          ).status,
        ).toBe(400);
      expect(
        (await route.PUT(request("PUT", { ids: [rowId, rowId] }), ctx)).status,
      ).toBe(400);
    });
  },
);

it.each(["POST", "PATCH", "PUT"] as const)(
  "returns 400 for invalid JSON on %s",
  async (method) => {
      auth.mockResolvedValue({
        id: "i",
        email: "test@example.test",
        name: "Test",
      });
    const { courseEffortHandlers } =
      await import("@/app/api/course-effort-handlers");
    const response = await courseEffortHandlers("sizes")[method](
      new NextRequest("http://localhost", { method, body: "{" }),
      ctx,
    );
    expect(response.status).toBe(400);
  },
);
it.each([
  ["P2025", 404],
  ["P2002", 409],
] as const)("maps database %s by class to %s", async (code, status) => {
      auth.mockResolvedValue({
        id: "i",
        email: "test@example.test",
        name: "Test",
      });
  prismaMock.$transaction.mockRejectedValue({ code });
  const { PATCH } = await import("./[entryId]/route");
  expect(
    (
      await PATCH(
        request("PATCH", { label: "Small", minMinutes: 30, maxMinutes: 45 }),
        ctx,
      )
    ).status,
  ).toBe(status);
});

it.each(["PATCH", "DELETE"] as const)(
  "returns 404 on %s for a missing or foreign entry",
  async (method) => {
      auth.mockResolvedValue({
        id: "i",
        email: "test@example.test",
        name: "Test",
      });
    prismaMock.$transaction.mockImplementation(async (fn) =>
      fn({
        course: { findUnique: async () => ({ id: "c" }) },
        courseEffortSize: { findFirst: async () => null },
      }),
    );
    const item = await import("./[entryId]/route");
    expect(
      (
        await item[method](
          request(
            method,
            method === "PATCH"
              ? { label: "Small", minMinutes: 30, maxMinutes: 45 }
              : undefined,
          ),
          ctx,
        )
      ).status,
    ).toBe(404);
  },
);
it("keeps part-kind validation at 400 regardless of not-found wording", async () => {
      auth.mockResolvedValue({
        id: "i",
        email: "test@example.test",
        name: "Test",
      });
  const { DomainInvariantError } = await import("@/services/redesign/errors");
  prismaMock.$transaction.mockRejectedValue(
    new DomainInvariantError("Part kind not found in this Course"),
  );
  const { POST } = await import("./route");
  expect(
    (
      await POST(
        request("POST", { label: "Small", minMinutes: 30, maxMinutes: 45 }),
        ctx,
      )
    ).status,
  ).toBe(400);
});
