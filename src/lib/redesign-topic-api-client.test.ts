import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { redesignApi, setMockBackend } from "./redesign-api-client";

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
});
