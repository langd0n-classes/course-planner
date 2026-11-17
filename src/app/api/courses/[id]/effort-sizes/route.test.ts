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
