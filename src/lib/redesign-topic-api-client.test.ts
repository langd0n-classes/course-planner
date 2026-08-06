import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { redesignApi, setMockBackend } from "./redesign-api-client";
import { createTopicSchema, updateTopicSchema } from "./redesign-schemas";

describe("redesignApi Topic methods", () => {
  beforeEach(() => {
    setMockBackend(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setMockBackend(null);
  });

  describe("updateTopic", () => {
    it("calls PATCH /api/topics/{id} with only the provided identity fields", async () => {
      const mockResponse = {
        topic: {
          id: "topic-1",
          courseId: "course-1",
          learningModuleId: null,
          stableCode: "topic-selecting-rows",
          currentVersionId: "tv-1",
          archivedAt: null,
        },
        currentVersion: null,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.updateTopic("topic-1", {
        stableCode: "topic-selecting-rows",
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/topics/topic-1", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stableCode: "topic-selecting-rows" }),
      });
      expect(result).toEqual(mockResponse);
    });

    it("cannot send learningModuleId — Topic placement is not an identity edit (ADR-0002)", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ topic: {}, currentVersion: null }),
      });
      global.fetch = mockFetch;

      await redesignApi.updateTopic("topic-1", {
        stableCode: "sql1",
        // @ts-expect-error learningModuleId must not be accepted by updateTopic
        learningModuleId: "lm-1",
      });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(Object.keys(sentBody)).not.toContain("learningModuleId");
    });
  });

  describe("createTopic", () => {
    it("creates unassigned topics — the request body never contains learningModuleId (ADR-0002)", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            instructor: {
              id: "instr-1",
              name: "Instructor",
              email: "instructor@example.com",
              archivedAt: null,
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            topic: {
              id: "topic-1",
              courseId: "course-1",
              learningModuleId: null,
              stableCode: "sql1",
              currentVersionId: "tv-1",
              archivedAt: null,
            },
            currentVersion: null,
          }),
        });
      global.fetch = mockFetch;

      await redesignApi.createTopic("course-1", "sql1", { title: "Selecting" });

      const sentBody = JSON.parse(mockFetch.mock.calls[1][1].body as string);
      expect(Object.keys(sentBody).sort()).toEqual([
        "createdByInstructorId",
        "stableCode",
        "version",
      ]);
      expect(Object.keys(sentBody)).not.toContain("learningModuleId");
    });
  });
});

describe("Topic request schemas ignore learningModuleId (ADR-0002)", () => {
  it("updateTopicSchema strips a supplied learningModuleId", () => {
    const parsed = updateTopicSchema.parse({
      stableCode: "sql1",
      learningModuleId: "5f0e8c9a-0000-4000-8000-000000000000",
    });
    expect(parsed).toEqual({ stableCode: "sql1" });
  });

  it("createTopicSchema strips a supplied learningModuleId", () => {
    const parsed = createTopicSchema.parse({
      stableCode: "sql1",
      learningModuleId: "5f0e8c9a-0000-4000-8000-000000000000",
      createdByInstructorId: "5f0e8c9a-0000-4000-8000-000000000001",
      version: { title: "Selecting" },
    });
    expect(Object.keys(parsed)).not.toContain("learningModuleId");
  });
});
