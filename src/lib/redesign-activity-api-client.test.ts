import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  redesignApi,
  setMockBackend,
} from "./redesign-api-client";
import type {
  ActivityDto,
  CreateActivityRequest,
  CreateActivityResponse,
  CreateActivityVersionResponse,
  GetActivityResponse,
  GetActivityVersionResponse,
  ListActivitiesResponse,
  ListActivityVersionsResponse,
  PublishActivityVersionResponse,
  UpdateActivityRequest,
  UpdateActivityResponse,
  UpsertActivityVersionRequest,
} from "./redesign-contract";

describe("redesignApi Course Activity methods", () => {
  beforeEach(() => {
    setMockBackend(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setMockBackend(null);
  });

  describe("listCourseActivities", () => {
    it("calls GET /api/courses/{id}/activities and unwraps response", async () => {
      const mockResponse: ListActivitiesResponse = {
        activities: [
          {
            id: "a-1",
            courseId: "c-1",
            stableCode: "meeting-01",
            currentVersionId: "av-1",
            archivedAt: null,
          },
          {
            id: "a-2",
            courseId: "c-1",
            stableCode: "project-01",
            currentVersionId: "av-2",
            archivedAt: null,
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listCourseActivities("c-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/courses/c-1/activities", {
        credentials: "include",
      });
      expect(result).toEqual(mockResponse.activities);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no activities exist", async () => {
      const mockResponse: ListActivitiesResponse = { activities: [] };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listCourseActivities("c-1");

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

      await expect(redesignApi.listCourseActivities("nonexistent")).rejects.toThrow(
        "Course not found",
      );
    });
  });

  describe("createCourseActivity", () => {
    it("calls POST /api/courses/{id}/activities with request body and instructor ID", async () => {
      const request: Omit<CreateActivityRequest, "createdByInstructorId"> = {
        stableCode: "meeting-01",
        version: {
          title: "Lecture 01: Introduction",
          summary: "Overview of course",
          activityTypeVersionId: "atv-1",
          detail: {
            behaviorFamily: "meeting",
            defaultDurationMinutes: 50,
            modality: "in-person",
            preparationNotes: null,
            authoringNotes: null,
          },
        },
      };

      const mockCurrentInstructor = {
        instructor: {
          id: "instr-1",
          name: "Dr. Smith",
          email: "smith@example.com",
        },
      };

      const mockResponse: CreateActivityResponse = {
        activity: {
          id: "a-1",
          courseId: "c-1",
          stableCode: "meeting-01",
          currentVersionId: "av-1",
          archivedAt: null,
        },
        currentVersion: {
          id: "av-1",
          activityId: "a-1",
          revision: 1,
          title: "Lecture 01: Introduction",
          summary: "Overview of course",
          activityTypeVersionId: "atv-1",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
          detail: {
            behaviorFamily: "meeting",
            defaultDurationMinutes: 50,
            modality: "in-person",
            preparationNotes: null,
            authoringNotes: null,
          },
          milestoneTemplates: [],
        },
      };

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCurrentInstructor,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        });
      global.fetch = mockFetch;

      const result = await redesignApi.createCourseActivity("c-1", request);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(2, "/api/courses/c-1/activities", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...request,
          createdByInstructorId: "instr-1",
        }),
      });
      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError on 400 response with validation error", async () => {
      const request: Omit<CreateActivityRequest, "createdByInstructorId"> = {
        stableCode: "",
        version: {
          title: "Invalid Activity",
          activityTypeVersionId: "atv-1",
          detail: {
            behaviorFamily: "meeting",
            defaultDurationMinutes: null,
            modality: null,
            preparationNotes: null,
            authoringNotes: null,
          },
        },
      };

      const mockCurrentInstructor = {
        instructor: {
          id: "instr-1",
          name: "Dr. Smith",
          email: "smith@example.com",
        },
      };

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCurrentInstructor,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          json: async () => ({ error: "Stable code is required" }),
        });
      global.fetch = mockFetch;

      await expect(redesignApi.createCourseActivity("c-1", request)).rejects.toThrow(
        "Stable code is required",
      );
    });
  });

  describe("getActivity", () => {
    it("calls GET /api/activities/{id} and returns activity", async () => {
      const mockResponse: GetActivityResponse = {
        activity: {
          id: "a-1",
          courseId: "c-1",
          stableCode: "meeting-01",
          currentVersionId: "av-1",
          archivedAt: null,
        },
        currentVersion: {
          id: "av-1",
          activityId: "a-1",
          revision: 1,
          title: "Lecture 01",
          summary: "Introduction",
          activityTypeVersionId: "atv-1",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
          detail: {
            behaviorFamily: "meeting",
            defaultDurationMinutes: 50,
            modality: "in-person",
            preparationNotes: null,
            authoringNotes: null,
          },
          milestoneTemplates: [],
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.getActivity("a-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/activities/a-1", {
        credentials: "include",
      });
      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError on 404 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "Activity not found" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.getActivity("nonexistent")).rejects.toThrow(
        "Activity not found",
      );
    });
  });

  describe("updateActivity", () => {
    it("calls PATCH /api/activities/{id} with request body", async () => {
      const request: UpdateActivityRequest = {
        stableCode: "meeting-01-updated",
      };

      const mockResponse: UpdateActivityResponse = {
        activity: {
          id: "a-1",
          courseId: "c-1",
          stableCode: "meeting-01-updated",
          currentVersionId: "av-1",
          archivedAt: null,
        },
        currentVersion: {
          id: "av-1",
          activityId: "a-1",
          revision: 1,
          title: "Lecture 01",
          summary: "Introduction",
          activityTypeVersionId: "atv-1",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
          detail: {
            behaviorFamily: "meeting",
            defaultDurationMinutes: 50,
            modality: "in-person",
            preparationNotes: null,
            authoringNotes: null,
          },
          milestoneTemplates: [],
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.updateActivity("a-1", request);

      expect(mockFetch).toHaveBeenCalledWith("/api/activities/a-1", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError on 403 response when unauthorized", async () => {
      const request: UpdateActivityRequest = { stableCode: "updated" };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        json: async () => ({ error: "Not authorized to update this activity" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.updateActivity("a-1", request)).rejects.toThrow(
        "Not authorized to update this activity",
      );
    });
  });

  describe("listActivityVersions", () => {
    it("calls GET /api/activities/{id}/versions and unwraps response", async () => {
      const mockResponse: ListActivityVersionsResponse = {
        versions: [
          {
            id: "av-1",
            activityId: "a-1",
            revision: 1,
            title: "Lecture 01: Introduction",
            summary: "Overview of course",
            activityTypeVersionId: "atv-1",
            changeSummary: null,
            publishedAt: "2026-07-14T00:00:00Z",
            detail: {
              behaviorFamily: "meeting",
              defaultDurationMinutes: 50,
              modality: "in-person",
              preparationNotes: null,
              authoringNotes: null,
            },
            milestoneTemplates: [],
          },
          {
            id: "av-2",
            activityId: "a-1",
            revision: 2,
            title: "Lecture 01: Introduction (Updated)",
            summary: "Overview of course - expanded",
            activityTypeVersionId: "atv-1",
            changeSummary: "Added preparation notes",
            publishedAt: "2026-07-14T01:00:00Z",
            detail: {
              behaviorFamily: "meeting",
              defaultDurationMinutes: 60,
              modality: "in-person",
              preparationNotes: "Read Chapter 1",
              authoringNotes: null,
            },
            milestoneTemplates: [],
          },
        ],
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listActivityVersions("a-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/activities/a-1/versions", {
        credentials: "include",
      });
      expect(result).toEqual(mockResponse.versions);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when no versions exist", async () => {
      const mockResponse: ListActivityVersionsResponse = { versions: [] };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.listActivityVersions("a-1");

      expect(result).toEqual([]);
    });

    it("throws ApiError on 404 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "Activity not found" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.listActivityVersions("nonexistent")).rejects.toThrow(
        "Activity not found",
      );
    });
  });

  describe("createActivityVersion", () => {
    it("calls POST /api/activities/{id}/versions with request body", async () => {
      const request: UpsertActivityVersionRequest = {
        title: "Lecture 01: Introduction (v2)",
        summary: "Updated overview",
        activityTypeVersionId: "atv-1",
        detail: {
          behaviorFamily: "meeting",
          defaultDurationMinutes: 60,
          modality: "in-person",
          preparationNotes: "Read Chapter 1-2",
          authoringNotes: null,
        },
        publish: true,
      };

      const mockResponse: CreateActivityVersionResponse = {
        version: {
          id: "av-2",
          activityId: "a-1",
          revision: 2,
          title: "Lecture 01: Introduction (v2)",
          summary: "Updated overview",
          activityTypeVersionId: "atv-1",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
          detail: {
            behaviorFamily: "meeting",
            defaultDurationMinutes: 60,
            modality: "in-person",
            preparationNotes: "Read Chapter 1-2",
            authoringNotes: null,
          },
          milestoneTemplates: [],
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.createActivityVersion("a-1", request);

      expect(mockFetch).toHaveBeenCalledWith("/api/activities/a-1/versions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(result).toEqual(mockResponse.version);
    });

    it("throws ApiError on 409 response with conflict error", async () => {
      const request: UpsertActivityVersionRequest = {
        title: "Lecture 01",
        activityTypeVersionId: "atv-1",
        detail: {
          behaviorFamily: "meeting",
          defaultDurationMinutes: null,
          modality: null,
          preparationNotes: null,
          authoringNotes: null,
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        statusText: "Conflict",
        json: async () => ({ error: "Concurrent version update detected" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.createActivityVersion("a-1", request)).rejects.toThrow(
        "Concurrent version update detected",
      );
    });
  });

  describe("getActivityVersion", () => {
    it("calls GET /api/activity-versions/{id} and returns version", async () => {
      const mockResponse: GetActivityVersionResponse = {
        version: {
          id: "av-1",
          activityId: "a-1",
          revision: 1,
          title: "Lecture 01",
          summary: "Introduction",
          activityTypeVersionId: "atv-1",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
          detail: {
            behaviorFamily: "meeting",
            defaultDurationMinutes: 50,
            modality: "in-person",
            preparationNotes: null,
            authoringNotes: null,
          },
          milestoneTemplates: [],
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.getActivityVersion("av-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/activity-versions/av-1", {
        credentials: "include",
      });
      expect(result).toEqual(mockResponse.version);
    });

    it("throws ApiError on 404 response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ error: "Activity Version not found" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.getActivityVersion("nonexistent")).rejects.toThrow(
        "Activity Version not found",
      );
    });
  });

  describe("publishActivityVersion", () => {
    it("calls POST /api/activity-versions/{id}/publish and returns published version", async () => {
      const mockResponse: PublishActivityVersionResponse = {
        version: {
          id: "av-1",
          activityId: "a-1",
          revision: 1,
          title: "Lecture 01",
          summary: "Introduction",
          activityTypeVersionId: "atv-1",
          changeSummary: null,
          publishedAt: "2026-07-14T00:00:00Z",
          detail: {
            behaviorFamily: "meeting",
            defaultDurationMinutes: 50,
            modality: "in-person",
            preparationNotes: null,
            authoringNotes: null,
          },
          milestoneTemplates: [],
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      const result = await redesignApi.publishActivityVersion("av-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/activity-versions/av-1/publish", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(undefined),
      });
      expect(result).toEqual(mockResponse.version);
    });

    it("throws ApiError on non-2xx response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: async () => ({ error: "Cannot publish an already-published version" }),
      });
      global.fetch = mockFetch;

      await expect(redesignApi.publishActivityVersion("av-1")).rejects.toThrow(
        "Cannot publish an already-published version",
      );
    });
  });

  describe("mock injection", () => {
    it("uses mock implementation when set for listCourseActivities", async () => {
      const mockActivities: ActivityDto[] = [
        {
          id: "mock-a-1",
          courseId: "mock-c-1",
          stableCode: "mock-meeting",
          currentVersionId: "mock-av-1",
          archivedAt: null,
        },
      ];

      const mockImpl = {
        listCourseActivities: async () => mockActivities,
      };

      setMockBackend(mockImpl);

      const result = await redesignApi.listCourseActivities("mock-c-1");

      expect(result).toEqual(mockActivities);
    });

    it("clears mock when setMockBackend is called with null", async () => {
      const mockImpl = {
        listCourseActivities: async () => [
          {
            id: "mock-a-1",
            courseId: "mock-c-1",
            stableCode: "mock",
            currentVersionId: "mock-av-1",
            archivedAt: null,
          },
        ],
      };

      setMockBackend(mockImpl);
      setMockBackend(null);

      const mockResponse: ListActivitiesResponse = { activities: [] };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      global.fetch = mockFetch;

      await redesignApi.listCourseActivities("c-1");

      expect(mockFetch).toHaveBeenCalled();
    });

    it("allows partial mock override of getActivity", async () => {
      const mockActivity: ActivityDto = {
        id: "mocked-a-1",
        courseId: "c-1",
        stableCode: "mocked",
        currentVersionId: "mocked-av-1",
        archivedAt: null,
      };

      const mockResponse: GetActivityResponse = {
        activity: mockActivity,
        currentVersion: null,
      };
      const mockImpl = {
        getActivity: async () => mockResponse,
      };

      setMockBackend(mockImpl);

      const result = await redesignApi.getActivity("a-1");

      expect(result).toEqual(mockResponse);
    });
  });
});
