import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthenticatedInstructor, loadDemoCourse } = vi.hoisted(() => ({
  getAuthenticatedInstructor: vi.fn(),
  loadDemoCourse: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: {} }));
vi.mock("@/lib/redesign-auth", () => ({ getAuthenticatedInstructor }));
vi.mock("@/services/redesign/demo-course-service", () => ({ loadDemoCourse }));

import { POST } from "./route";

describe("POST /api/instructors/me/demo-course", () => {
  beforeEach(() => {
    getAuthenticatedInstructor.mockReset();
    loadDemoCourse.mockReset();
  });

  it("rejects anonymous requests before loading anything", async () => {
    getAuthenticatedInstructor.mockResolvedValue(null);
    expect((await POST()).status).toBe(401);
    expect(loadDemoCourse).not.toHaveBeenCalled();
  });

  it("uses only the signed-in instructor and reports repeat loads", async () => {
    getAuthenticatedInstructor.mockResolvedValue({ id: "owner" });
    loadDemoCourse.mockResolvedValueOnce({ courseId: "course-1", created: true });
    loadDemoCourse.mockResolvedValueOnce({ courseId: "course-1", created: false });

    const first = await POST();
    const second = await POST();
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(loadDemoCourse).toHaveBeenCalledTimes(2);
    expect(loadDemoCourse.mock.calls.every((call: unknown[]) => call[1] === "owner")).toBe(true);
  });
});
