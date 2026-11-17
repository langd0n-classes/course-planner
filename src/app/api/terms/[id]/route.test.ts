import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { tx } = vi.hoisted(() => ({
  tx: {
    term: { findUnique: vi.fn() },
    termMeetingPattern: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({
  default: { $transaction: async (fn: (arg: typeof tx) => unknown) => fn(tx) },
}));
vi.mock("@/lib/redesign-auth", () => ({
  getAuthenticatedInstructor: async () => ({ id: "i" }),
}));
it("returns the owned Term's meeting patterns so its workspace can use their time zone", async () => {
  tx.term.findUnique.mockResolvedValue({
    id: "term",
    courseId: "course",
    course: { instructorId: "i" },
    startDate: new Date("2026-01-01Z"),
    endDate: new Date("2026-05-01Z"),
    closedAt: null,
    archivedAt: null,
  });
  tx.termMeetingPattern.findMany.mockResolvedValue([
    {
      id: "pattern",
      termId: "term",
      timeZone: "America/New_York",
      startsOn: new Date("2026-01-01Z"),
      endsOn: new Date("2026-05-01Z"),
    },
  ]);
  const { GET } = await import("./route");
  const response = await GET(
    new NextRequest("http://localhost/api/terms/term"),
    { params: Promise.resolve({ id: "term" }) },
  );
  expect((await response.json()).term.meetingPatterns[0]).toMatchObject({
    timeZone: "America/New_York",
    startsOn: "2026-01-01",
  });
  expect(tx.termMeetingPattern.findMany).toHaveBeenCalledWith({
    where: { termId: "term" },
    orderBy: [{ startsOn: "asc" }, { id: "asc" }],
  });
});
