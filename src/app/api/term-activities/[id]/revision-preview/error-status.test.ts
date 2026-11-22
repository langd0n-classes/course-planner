import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DomainInvariantError, NotFoundError, ConcurrencyConflictError } from "@/services/redesign/errors";
const { service } = vi.hoisted(() => ({ service: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: vi.fn(async () => ({ id: "i" })) }));
vi.mock("@/services/redesign", async (original) => ({ ...await original<typeof import("@/services/redesign")>(), previewTermActivityRevision: service }));
it.each([[new NotFoundError("Opaque lookup failure"), 404], [new DomainInvariantError("Validation not found"), 400], [new ConcurrencyConflictError("Lost race"), 409]])("classifies %s by class", async (error, status) => {
  service.mockRejectedValue(error);
  const { POST } = await import("./route");
  const response = await POST(new NextRequest("http://localhost/api/term-activities/a/revision-preview", { method: "POST", body: JSON.stringify({ title: "Edit", detail: { behaviorFamily: "meeting" } }) }), { params: Promise.resolve({ id: "a" }) });
  expect(response.status).toBe(status);
});
it.each(["The milestone template must belong to the base Activity version", "A milestone cannot link to its own Term Activity", "The linked Term Activity must be in the same Term", "A fixed or standalone milestone needs a date"])("returns 400 for %s", async (message) => {
  service.mockRejectedValue(new DomainInvariantError(message));
  const { POST } = await import("./route");
  const response = await POST(new NextRequest("http://localhost/api/term-activities/a/revision-preview", { method: "POST", body: JSON.stringify({ title: "Edit", detail: { behaviorFamily: "meeting" } }) }), { params: Promise.resolve({ id: "a" }) });
  expect(response.status).toBe(400);
});
