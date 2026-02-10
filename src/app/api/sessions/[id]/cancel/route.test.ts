import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  default: {
    session: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    coverage: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock loadTermData
vi.mock("@/lib/term-data", () => ({
  loadTermData: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { loadTermData } from "@/lib/term-data";
import { POST } from "./route";

const mockedPrisma = vi.mocked(prisma);
const mockedLoadTermData = vi.mocked(loadTermData);

// Valid v4 UUIDs for testing
const SESSION_1 = "21b4d1a8-d846-40c1-ac8f-991c6d9a61bf";
const SESSION_2 = "a859ebc1-73f6-4b56-b4b5-20d53393c2e3";
const SESSION_3 = "00121a5b-93e3-411b-8846-fec5622e267b";
const SKILL_1 = "e9d46a30-a7aa-4bcb-bd40-19e708fede01";
const MOD_1 = "885046d0-c1b3-4abd-a45a-7409062da4b6";
const TERM_1 = "5052d3d5-08e5-41bd-a00c-420d3749a4e8";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/sessions/x/cancel", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const makeParams = (id: string) => Promise.resolve({ id });

describe("POST /api/sessions/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when session not found", async () => {
    mockedPrisma.session.findUnique.mockResolvedValue(null);

    const req = makeRequest({ reason: "Snow day" });
    const res = await POST(req, { params: makeParams("nonexistent") });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  it("returns 400 when session is already canceled", async () => {
    mockedPrisma.session.findUnique.mockResolvedValue({
      id: SESSION_1,
      status: "canceled",
      module: { termId: TERM_1 },
    } as never);

    const req = makeRequest({ reason: "Snow day" });
    const res = await POST(req, { params: makeParams(SESSION_1) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("already canceled");
  });

  it("cancels session with no redistributions (200)", async () => {
    mockedPrisma.session.findUnique
      .mockResolvedValueOnce({
        id: SESSION_1,
        status: "scheduled",
        module: { termId: TERM_1 },
      } as never)
      .mockResolvedValueOnce({
        id: SESSION_1,
        status: "canceled",
        canceledAt: new Date(),
        module: { id: MOD_1, code: "LM-01" },
        coverages: [],
      } as never);

    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      return fn({
        session: { update: vi.fn() },
        coverage: { create: vi.fn() },
      });
    });

    const req = makeRequest({});
    const res = await POST(req, { params: makeParams(SESSION_1) });

    expect(res.status).toBe(200);
  });

  it("cancels session with valid redistributions (200)", async () => {
    mockedPrisma.session.findUnique
      .mockResolvedValueOnce({
        id: SESSION_1,
        status: "scheduled",
        module: { termId: TERM_1 },
      } as never)
      .mockResolvedValueOnce({
        id: SESSION_1,
        status: "canceled",
        module: { id: MOD_1, code: "LM-01" },
        coverages: [],
      } as never);

    (mockedPrisma.session as unknown as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValue([
      { id: SESSION_2, status: "scheduled", module: { termId: TERM_1 } },
    ]);

    mockedLoadTermData.mockResolvedValue({
      sessions: [
        {
          id: SESSION_1, code: "lec-01", title: "Lecture 1",
          date: new Date("2026-01-20"), moduleId: MOD_1,
          moduleSequence: 0, sessionSequence: 0, status: "scheduled" as const,
        },
        {
          id: SESSION_2, code: "lec-02", title: "Lecture 2",
          date: new Date("2026-01-22"), moduleId: MOD_1,
          moduleSequence: 0, sessionSequence: 1, status: "scheduled" as const,
        },
      ],
      coverages: [
        {
          sessionId: SESSION_1, skillId: SKILL_1, level: "introduced" as const,
          sessionDate: new Date("2026-01-20"), sessionSequence: 0, moduleSequence: 0,
        },
      ],
      skills: [
        { id: SKILL_1, code: "A01", description: "Skill A01", category: "fundamentals" },
      ],
    });

    mockedPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      return fn({
        session: { update: vi.fn() },
        coverage: { create: vi.fn() },
      });
    });

    const req = makeRequest({
      reason: "Snow day",
      redistributions: [
        { skillId: SKILL_1, level: "introduced", targetSessionId: SESSION_2 },
      ],
    });
    const res = await POST(req, { params: makeParams(SESSION_1) });

    expect(res.status).toBe(200);
  });

  it("returns dryRun validation result without canceling", async () => {
    mockedPrisma.session.findUnique.mockResolvedValueOnce({
      id: SESSION_1,
      status: "scheduled",
      module: { termId: TERM_1 },
    } as never);

    (mockedPrisma.session as unknown as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValue([
      { id: SESSION_2, status: "scheduled", module: { termId: TERM_1 } },
    ]);

    mockedLoadTermData.mockResolvedValue({
      sessions: [
        {
          id: SESSION_1, code: "lec-01", title: "Lecture 1",
          date: new Date("2026-01-20"), moduleId: MOD_1,
          moduleSequence: 0, sessionSequence: 0, status: "scheduled" as const,
        },
        {
          id: SESSION_2, code: "lec-02", title: "Lecture 2",
          date: new Date("2026-01-22"), moduleId: MOD_1,
          moduleSequence: 0, sessionSequence: 1, status: "scheduled" as const,
        },
      ],
      coverages: [
        {
          sessionId: SESSION_1, skillId: SKILL_1, level: "introduced" as const,
          sessionDate: new Date("2026-01-20"), sessionSequence: 0, moduleSequence: 0,
        },
      ],
      skills: [
        { id: SKILL_1, code: "A01", description: "Skill A01", category: "fundamentals" },
      ],
    });

    const req = makeRequest({
      reason: "Snow day",
      dryRun: true,
      redistributions: [
        { skillId: SKILL_1, level: "introduced", targetSessionId: SESSION_2 },
      ],
    });
    const res = await POST(req, { params: makeParams(SESSION_1) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("valid");
    expect(body.valid).toBe(true);
    expect(body.violations).toEqual([]);

    // Ensure no transaction was called (no actual cancellation)
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when redistributions break ordering", async () => {
    mockedPrisma.session.findUnique.mockResolvedValueOnce({
      id: SESSION_1,
      status: "scheduled",
      module: { termId: TERM_1 },
    } as never);

    (mockedPrisma.session as unknown as { findMany: ReturnType<typeof vi.fn> }).findMany.mockResolvedValue([
      { id: SESSION_2, status: "scheduled", module: { termId: TERM_1 } },
    ]);

    // session-2 (seq 0) comes BEFORE session-3 (seq 2) which has "introduced"
    // Moving "practiced" to session-2 would break I->P ordering
    mockedLoadTermData.mockResolvedValue({
      sessions: [
        {
          id: SESSION_2, code: "lec-01", title: "Lecture 1",
          date: new Date("2026-01-18"), moduleId: MOD_1,
          moduleSequence: 0, sessionSequence: 0, status: "scheduled" as const,
        },
        {
          id: SESSION_1, code: "lec-02", title: "Lecture 2",
          date: new Date("2026-01-20"), moduleId: MOD_1,
          moduleSequence: 0, sessionSequence: 1, status: "scheduled" as const,
        },
        {
          id: SESSION_3, code: "lec-03", title: "Lecture 3",
          date: new Date("2026-01-22"), moduleId: MOD_1,
          moduleSequence: 0, sessionSequence: 2, status: "scheduled" as const,
        },
      ],
      coverages: [
        {
          sessionId: SESSION_1, skillId: SKILL_1, level: "practiced" as const,
          sessionDate: new Date("2026-01-20"), sessionSequence: 1, moduleSequence: 0,
        },
        {
          sessionId: SESSION_3, skillId: SKILL_1, level: "introduced" as const,
          sessionDate: new Date("2026-01-22"), sessionSequence: 2, moduleSequence: 0,
        },
      ],
      skills: [
        { id: SKILL_1, code: "A01", description: "Skill A01", category: "fundamentals" },
      ],
    });

    const req = makeRequest({
      reason: "Snow day",
      redistributions: [
        { skillId: SKILL_1, level: "practiced", targetSessionId: SESSION_2 },
      ],
    });
    const res = await POST(req, { params: makeParams(SESSION_1) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("ordering");
  });
});
