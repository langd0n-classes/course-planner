import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ default: { $transaction: mocks.transaction } }));
const id = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id }) };
const jsonRoutes = [
  ["POST", "./academic-calendars/[id]/versions/route"],
  ["POST", "./academic-calendars/route"],
  ["PATCH", "./activities/[id]/route"],
  ["PUT", "./activities/[id]/topic-scope/route"],
  ["POST", "./activities/[id]/versions/route"],
  ["PATCH", "./activity-types/[id]/route"],
  ["POST", "./activity-types/[id]/versions/route"],
  ["PUT", "./activity-versions/[id]/lm-scope/route"],
  ["PUT", "./activity-versions/[id]/topic-actions/route"],
  ["PATCH", "./artifacts/[id]/route"],
  ["POST", "./artifacts/route"],
  ["PATCH", "./assessments/[id]/route"],
  ["PATCH", "./calendar-slots/[id]/route"],
  ["POST", "./courses/[id]/activities/route"],
  ["PUT", "./courses/[id]/activity-types/route"],
  ["POST", "./courses/[id]/exemplar-import/route"],
  ["PUT", "./courses/[id]/institutions/route"],
  ["POST", "./courses/[id]/learning-modules/route"],
  ["PATCH", "./courses/[id]/route"],
  ["POST", "./courses/[id]/topics/route"],
  ["POST", "./courses/route"],
  ["PATCH", "./coverages/[id]/route"],
  ["POST", "./institutions/route"],
  ["POST", "./instructors/me/activity-types/route"],
  ["PATCH", "./learning-modules/[id]/route"],
  ["POST", "./learning-modules/[id]/versions/route"],
  ["POST", "./sessions/[id]/cancel/route"],
  ["POST", "./sessions/[id]/coverages/route"],
  ["POST", "./sessions/[id]/move/route"],
  ["PATCH", "./sessions/[id]/route"],
  ["POST", "./term-learning-modules/[id]/delivered-revisions/route"],
  ["PUT", "./topics/[id]/prerequisites/route"],
  ["PATCH", "./topics/[id]/route"],
  ["POST", "./topics/[id]/versions/route"],
] as const;

beforeEach(() => {
  mocks.auth.mockResolvedValue({ id, name: "Instructor", email: "owner@example.test" });
  mocks.transaction.mockResolvedValue({ id });
});

describe("JSON request boundaries", () => {
  for (const [method, path] of jsonRoutes) {
    it(`${method} ${path} rejects invalid JSON`, async () => {
      const route = await import(/* @vite-ignore */ path);
      const response = await route[method](new NextRequest("http://localhost/api/test", { method, body: "{" }), context);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "The request body is not valid JSON." });
    });
  }
});

describe("Instructor access", () => {
  it("returns only the authenticated Instructor in a list", async () => {
    const { GET } = await import("./instructors/route");
    expect(await (await GET()).json()).toEqual([await mocks.auth()]);
  });
  it("returns 401 without an Instructor", async () => {
    mocks.auth.mockResolvedValue(null);
    const { GET } = await import("./instructors/route");
    expect((await GET()).status).toBe(401);
  });
  it("retires Instructor creation", async () => {
    const route = await import("./instructors/route");
    expect((await route.POST()).status).toBe(410);
  });
});

for (const [path, method] of [["artifacts/[id]", "GET"], ["artifacts/[id]", "PATCH"], ["artifacts/[id]", "DELETE"], ["courses/[id]/topics", "GET"], ["courses/[id]/topics", "POST"], ["courses/[id]/learning-modules", "GET"], ["courses/[id]/learning-modules", "POST"]]) {
  it(`${method} ${path} rejects malformed path IDs`, async () => {
    const route = await import(/* @vite-ignore */ `./${path}/route`);
    const response = await route[method](new NextRequest("http://localhost/api/test", { method }), { params: Promise.resolve({ id: "invalid" }) });
    expect(response.status).toBe(400);
  });
}

for (const path of ["artifacts", "artifacts/[id]", "courses/[id]/topics", "courses/[id]/learning-modules", "institutions"]) {
  it(`${path} logs unexpected errors and returns fixed text`, async () => {
    const error = new Error("private database diagnostic");
    mocks.transaction.mockRejectedValue(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const route = await import(/* @vite-ignore */ `./${path}/route`);
      const response = await route.GET(new NextRequest("http://localhost/api/test"), context);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Internal server error" });
      expect(log).toHaveBeenCalledWith(expect.any(String), error);
    } finally { log.mockRestore(); }
  });
}

it.each([true, false])("reports institution created=%s while preserving the institution envelope", async (wasCreated) => {
  const institution = { id, name: "College", shortName: null, canonicalUri: null, archivedAt: null,
    createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01") };
  mocks.transaction.mockResolvedValue({ ...institution, created: wasCreated });
  const { POST } = await import("./institutions/route");
  const response = await POST(new NextRequest("http://localhost/api/institutions", { method: "POST", body: JSON.stringify({ name: "College" }) }));
  expect(response.status).toBe(wasCreated ? 201 : 200);
  expect(await response.json()).toMatchObject({ institution: { id, name: "College" }, created: wasCreated });
});

it("returns 409 for an archived institution name", async () => {
  const { InstitutionNameConflictError } = await import("@/services/redesign/errors");
  mocks.transaction.mockRejectedValue(new InstitutionNameConflictError());
  const { POST } = await import("./institutions/route");
  const response = await POST(new NextRequest("http://localhost/api/institutions", { method: "POST", body: JSON.stringify({ name: "College" }) }));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "An institution with this name is archived." });
});

for (const field of ["sessionId", "assessmentId", "topicVersionId", "learningModuleVersionId"]) {
  it(`rejects an invalid artifact ${field} in query and body`, async () => {
    const { GET, POST } = await import("./artifacts/route");
    const get = await GET(new NextRequest(`http://localhost/api/artifacts?${field}=invalid`));
    expect(get.status).toBe(400);
    const post = await POST(new NextRequest("http://localhost/api/artifacts", { method: "POST", body: JSON.stringify({
      parentType: "session", sessionId: id, [field]: "invalid", artifactType: "link", sourceType: "external_uri", title: "Link", uri: "https://example.test",
    }) }));
    expect(post.status).toBe(400);
  });
}
for (const path of ["courses/[id]/topics", "courses/[id]/learning-modules", "institutions"]) {
  it(`${path} preserves domain errors and hides unexpected POST errors`, async () => {
    const route = await import(/* @vite-ignore */ `./${path}/route`);
    const body = path === "institutions" ? { name: "College" } : { stableCode: "T", createdByInstructorId: id, version: { title: "Topic" } };
    const request = () => new NextRequest("http://localhost/api/test", { method: "POST", body: JSON.stringify(body) });
    const { DomainInvariantError } = await import("@/services/redesign/errors");
    mocks.transaction.mockRejectedValue(new DomainInvariantError("Known domain message"));
    const known = await route.POST(request(), context);
    expect(known.status).toBe(400);
    expect(await known.json()).toEqual({ error: "Known domain message" });
    const error = new Error("private diagnostic");
    mocks.transaction.mockRejectedValue(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await route.POST(request(), context);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Internal server error" });
      expect(log).toHaveBeenCalledWith(expect.any(String), error);
    } finally { log.mockRestore(); }
  });
}

for (const resource of ["topics", "learning-modules"]) {
  it(`returns 400 and the original message for a duplicate ${resource} stableCode`, async () => {
    const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed on stableCode", {
      code: "P2002", clientVersion: "6.19.2", meta: { target: ["courseId", "stableCode"] },
    });
    mocks.transaction.mockResolvedValueOnce({ id }).mockRejectedValueOnce(error);
    const route = await import(/* @vite-ignore */ `./courses/[id]/${resource}/route`);
    const response = await route.POST(new NextRequest("http://localhost/api/test", {
      method: "POST", body: JSON.stringify({ stableCode: "DUPLICATE", createdByInstructorId: id, version: { title: "Duplicate" } }),
    }), context);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: error.message });
  });
}

it("preserves the institution unique-constraint status and message", async () => {
  const error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed on name", {
    code: "P2002", clientVersion: "6.19.2", meta: { target: ["name"] },
  });
  mocks.transaction.mockRejectedValueOnce(error);
  const { POST } = await import("./institutions/route");
  const response = await POST(new NextRequest("http://localhost/api/institutions", {
    method: "POST", body: JSON.stringify({ name: "College" }),
  }));
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: error.message });
});
