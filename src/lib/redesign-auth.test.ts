import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authMock }));

import { getAuthenticatedInstructor } from "./redesign-auth";

describe("getAuthenticatedInstructor", () => {
  beforeEach(() => authMock.mockReset());

  it("creates or reuses the email-scoped instructor atomically", async () => {
    authMock.mockResolvedValue({ user: { email: " Alice@Example.edu ", name: " Alice " } });
    const upsert = vi.fn(async () => ({ id: "instructor-1", email: "alice@example.edu", name: "Alice" }));
    const db = { instructor: { upsert, findUnique: vi.fn() } };

    expect(await getAuthenticatedInstructor(db)).toEqual({
      id: "instructor-1", email: "alice@example.edu", name: "Alice",
    });
    expect(await getAuthenticatedInstructor(db)).toEqual({
      id: "instructor-1", email: "alice@example.edu", name: "Alice",
    });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith({
      where: { email: "alice@example.edu" },
      create: { email: "alice@example.edu", name: "Alice" },
      update: {},
      select: { id: true, email: true, name: true },
    });
  });

  it("does not create an instructor without an authenticated email", async () => {
    authMock.mockResolvedValue({ user: { name: "Anonymous" } });
    const upsert = vi.fn();
    expect(await getAuthenticatedInstructor({ instructor: { upsert, findUnique: vi.fn() } })).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("finds the winning row after a concurrent insert conflicts", async () => {
    authMock.mockResolvedValue({ user: { email: "alice@example.edu" } });
    const row = { id: "instructor-1", email: "alice@example.edu", name: "Alice" };
    const upsert = vi.fn().mockRejectedValue({ code: "P2002" });
    const findUnique = vi.fn().mockResolvedValue(row);

    expect(await getAuthenticatedInstructor({ instructor: { upsert, findUnique } })).toEqual(row);
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "alice@example.edu" },
      select: { id: true, email: true, name: true },
    });
  });

  it("normalizes email for direct instructor lookup", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "instructor-1", email: "alice@example.edu", name: "Alice" });
    const { getOrCreateInstructor } = await import("./redesign-auth");
    await getOrCreateInstructor({ instructor: { upsert, findUnique: vi.fn() } }, " ALICE@EXAMPLE.EDU ", "Alice");
    expect(upsert.mock.calls[0][0].where.email).toBe("alice@example.edu");
  });

  it("reuses a seeded instructor whose email has different case", async () => {
    const row = { id: "seeded", email: "Alice@Example.edu", name: "Alice" };
    const findFirst = vi.fn().mockResolvedValue(row);
    const upsert = vi.fn();
    const { getOrCreateInstructor } = await import("./redesign-auth");
    expect(await getOrCreateInstructor({ instructor: { findFirst, upsert, findUnique: vi.fn() } }, "alice@example.edu", "Alice")).toEqual(row);
    expect(findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "alice@example.edu", mode: "insensitive" } },
      select: { id: true, email: true, name: true },
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});
