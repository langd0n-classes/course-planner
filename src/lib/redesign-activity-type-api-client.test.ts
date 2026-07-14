import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  redesignApi,
  setMockBackend,
} from "./redesign-api-client";
import type {
  ActivityTypeDto,
  CreateActivityTypeRequest,
  CreateActivityTypeResponse,
  GetActivityTypeResponse,
  ListActivityTypeVersionsResponse,
  ListActivityTypesResponse,
  ListCourseActivityTypeVersionsResponse,
  ReplaceCourseActivityTypeVersionsRequest,
  ReplaceCourseActivityTypeVersionsResponse,
  UpdateActivityTypeRequest,
  UpdateActivityTypeResponse,
} from "./redesign-contract";

describe("redesignApi Activity Type methods", () => {
  beforeEach(() => {
    setMockBackend(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setMockBackend(null);
  });

  describe("listActivityTypes", () => {
    it("calls GET /api/instructors/me/activity-types and unwraps response", async () => {
      const mockResponse: ListActivityTypesResponse = {
        activityTypes: [
          {
            id: "at-1",
            instructorId: "instr-1",
            behaviorFamily: "meeting",
            currentVersionId: "atv-1",
            archivedAt: null,
          },
          {
            id: "at-2",
            instructorId: "instr-1",
            behaviorFamily: "coursework",
            currentVersionId: "atv-2",
            archivedAt: null,
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listActivityTypes();

      expect(mockFetch).toHaveBeenCalledWith("/api/instructors/me/activity-types", {
        credentials: "include",
      });
      expect(result).toEqual(mockResponse.activityTypes);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no activity types exist", async () => {
      const mockResponse: ListActivityTypesResponse = { activityTypes: [] };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listActivityTypes();

      expect(result).toEqual([]);
    });

    it("throws ApiError on 401 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({ error: "Unauthorized" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.listActivityTypes()).rejects.toThrow("Unauthorized");
    });
  });

  describe("createActivityType", () => {
    it("calls POST /api/instructors/me/activity-types with request body", async () => {
      const request: CreateActivityTypeRequest = {
        behaviorFamily: "meeting",
        createdByInstructorId: "instr-1",
        version: {
          label: "Lecture",
          description: "In-class lecture meeting",
          publish: true,
        },
      };

      const mockResponse: CreateActivityTypeResponse = {
        activityType: {
          id: "at-1",
          instructorId: "instr-1",
          behaviorFamily: "meeting",
          currentVersionId: "atv-1",
          archivedAt: null,
        },
        currentVersion: {
          id: "atv-1",
          activityTypeId: "at-1",
          revision: 1,
          label: "Lecture",
          description: "In-class lecture meeting",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.createActivityType(request);

      expect(mockFetch).toHaveBeenCalledWith("/api/instructors/me/activity-types", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError on 400 response with validation error", async () => {
      const request: CreateActivityTypeRequest = {
        behaviorFamily: "meeting",
        createdByInstructorId: "instr-1",
        version: {
          label: "",
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "Label is required" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.createActivityType(request)).rejects.toThrow("Label is required");
    });
  });

  describe("getActivityType", () => {
    it("calls GET /api/activity-types/{id} and returns response", async () => {
      const mockResponse: GetActivityTypeResponse = {
        activityType: {
          id: "at-1",
          instructorId: "instr-1",
          behaviorFamily: "coursework",
          currentVersionId: "atv-1",
          archivedAt: null,
        },
        currentVersion: {
          id: "atv-1",
          activityTypeId: "at-1",
          revision: 1,
          label: "Assignment",
          description: "Written assignment",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.getActivityType("at-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/activity-types/at-1", {
        credentials: "include",
      });
      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError on 404 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "Activity Type not found" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.getActivityType("nonexistent")).rejects.toThrow(
        "Activity Type not found",
      );
    });
  });

  describe("updateActivityType", () => {
    it("calls PATCH /api/activity-types/{id} with request body", async () => {
      const request: UpdateActivityTypeRequest = {
        archivedAt: "2026-07-14T00:00:00Z",
      };

      const mockResponse: UpdateActivityTypeResponse = {
        activityType: {
          id: "at-1",
          instructorId: "instr-1",
          behaviorFamily: "meeting",
          currentVersionId: "atv-1",
          archivedAt: "2026-07-14T00:00:00Z",
        },
        currentVersion: {
          id: "atv-1",
          activityTypeId: "at-1",
          revision: 1,
          label: "Lecture",
          description: "In-class lecture",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.updateActivityType("at-1", request);

      expect(mockFetch).toHaveBeenCalledWith("/api/activity-types/at-1", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError on 403 response when unauthorized", async () => {
      const request: UpdateActivityTypeRequest = { archivedAt: null };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({ error: "Not authorized to update this activity type" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.updateActivityType("at-1", request)).rejects.toThrow(
        "Not authorized to update this activity type",
      );
    });
  });

  describe("listActivityTypeVersions", () => {
    it("calls GET /api/activity-types/{id}/versions and unwraps response", async () => {
      const mockResponse: ListActivityTypeVersionsResponse = {
        versions: [
          {
            id: "atv-1",
            activityTypeId: "at-1",
            revision: 1,
            label: "Lecture",
            description: "In-class lecture",
            changeSummary: null,
            publishedAt: "2026-07-14T00:00:00Z",
          },
          {
            id: "atv-2",
            activityTypeId: "at-1",
            revision: 2,
            label: "Classroom Session",
            description: "In-class lecture meeting",
            changeSummary: "Updated label for clarity",
            publishedAt: "2026-07-14T01:00:00Z",
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listActivityTypeVersions("at-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/activity-types/at-1/versions", {
        credentials: "include",
      });
      expect(result).toEqual(mockResponse.versions);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no versions exist", async () => {
      const mockResponse: ListActivityTypeVersionsResponse = { versions: [] };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listActivityTypeVersions("at-1");

      expect(result).toEqual([]);
    });

    it("throws ApiError on 404 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "Activity Type not found" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.listActivityTypeVersions("nonexistent")).rejects.toThrow(
        "Activity Type not found",
      );
    });
  });

  describe("createActivityTypeVersion", () => {
    it("calls POST /api/activity-types/{id}/versions with request body", async () => {
      const request = {
        label: "Lab Session",
        description: "Hands-on lab work",
        publish: true,
      };

      const mockResponse = {
        version: {
          id: "atv-2",
          activityTypeId: "at-1",
          revision: 2,
          label: "Lab Session",
          description: "Hands-on lab work",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.createActivityTypeVersion("at-1", request);

      expect(mockFetch).toHaveBeenCalledWith("/api/activity-types/at-1/versions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse.version);
    });

    it("throws ApiError on 409 response with conflict error", async () => {
      const request = { label: "Lab Session" };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: "Conflict",
        json: async () => ({ error: "Concurrent version update detected" }),
      });
      global.fetch = mockFetch;

      await expect(
        redesignApi.createActivityTypeVersion("at-1", request),
      ).rejects.toThrow("Concurrent version update detected");
    });
  });

  describe("listCourseActivityTypeVersions", () => {
    it("calls GET /api/courses/{id}/activity-types and unwraps response", async () => {
      const mockResponse: ListCourseActivityTypeVersionsResponse = {
        activityTypeVersions: [
          {
            courseId: "c-1",
            activityTypeVersionId: "atv-1",
            enabledAt: "2026-07-14T00:00:00Z",
          },
          {
            courseId: "c-1",
            activityTypeVersionId: "atv-2",
            enabledAt: "2026-07-14T01:00:00Z",
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listCourseActivityTypeVersions("c-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/courses/c-1/activity-types", {
        credentials: "include",
      });
      expect(result).toEqual(mockResponse.activityTypeVersions);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no activity type versions are enabled", async () => {
      const mockResponse: ListCourseActivityTypeVersionsResponse = { activityTypeVersions: [] };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listCourseActivityTypeVersions("c-1");

      expect(result).toEqual([]);
    });

    it("throws ApiError on 404 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "Course not found" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.listCourseActivityTypeVersions("nonexistent")).rejects.toThrow(
        "Course not found",
      );
    });
  });

  describe("replaceCourseActivityTypeVersions", () => {
    it("calls PUT /api/courses/{id}/activity-types with request body", async () => {
      const request: ReplaceCourseActivityTypeVersionsRequest = {
        activityTypeVersionIds: ["atv-1", "atv-2"],
      };

      const mockResponse: ReplaceCourseActivityTypeVersionsResponse = {
        activityTypeVersions: [
          {
            courseId: "c-1",
            activityTypeVersionId: "atv-1",
            enabledAt: "2026-07-14T00:00:00Z",
          },
          {
            courseId: "c-1",
            activityTypeVersionId: "atv-2",
            enabledAt: "2026-07-14T00:00:00Z",
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.replaceCourseActivityTypeVersions("c-1", request);

      expect(mockFetch).toHaveBeenCalledWith("/api/courses/c-1/activity-types", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse.activityTypeVersions);
    });

    it("supports replacing all activity type versions with empty array", async () => {
      const request: ReplaceCourseActivityTypeVersionsRequest = {
        activityTypeVersionIds: [],
      };

      const mockResponse: ReplaceCourseActivityTypeVersionsResponse = {
        activityTypeVersions: [],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.replaceCourseActivityTypeVersions("c-1", request);

      expect(result).toEqual([]);
    });

    it("throws ApiError on 422 response with validation error", async () => {
      const request: ReplaceCourseActivityTypeVersionsRequest = {
        activityTypeVersionIds: ["nonexistent-atv"],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: async () => ({ error: "Activity Type Version not found" }),
      });
      global.fetch = mockFetch;

      await expect(
        redesignApi.replaceCourseActivityTypeVersions("c-1", request),
      ).rejects.toThrow("Activity Type Version not found");
    });
  });

  describe("mock injection", () => {
    it("uses mock implementation when set", async () => {
      const mockActivityType: ActivityTypeDto = {
        id: "mock-at-1",
        instructorId: "mock-instr",
        behaviorFamily: "assessment",
        currentVersionId: "mock-atv-1",
        archivedAt: null,
      };

      const mockImpl = {
        listActivityTypes: async () => [mockActivityType],
      };

      setMockBackend(mockImpl);

      const result = await redesignApi.listActivityTypes();

      expect(result).toEqual([mockActivityType]);
    });

    it("clears mock when setMockBackend is called with null", async () => {
      const mockImpl = {
        listActivityTypes: async () => [
          {
            id: "mock",
            instructorId: "mock",
            behaviorFamily: "meeting" as const,
            currentVersionId: "mock",
            archivedAt: null,
          },
        ],
      };

      setMockBackend(mockImpl);
      setMockBackend(null);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ activityTypes: [] }),
      });
      global.fetch = mockFetch;

      await redesignApi.listActivityTypes();

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
