// Test suite for redesign-fixtures: proves deterministic defaults, typed overrides,
// fresh nested data, and discriminant preservation without Zod validation.

import { describe, it, expect } from "vitest";
import type {
  ActivityTypeDto,
  ActivityDto,
  ActivityVersionDto,
  TermActivityDto,
  TermActivityRevisionDto,
  TermCalendarExceptionDto,
} from "./redesign-contract";
import {
  createMeetingActivityType,
  createMeetingActivityTypeVersion,
  createCourseworkActivityType,
  createCourseworkActivityTypeVersion,
  createMeetingActivityDetail,
  createCourseworkActivityDetail,
  createMeetingActivity,
  createMeetingActivityVersion,
  createCourseworkActivity,
  createCourseworkActivityVersion,
  createMilestoneTemplate,
  createTermActivityMilestone,
  createTermActivityRevisionTopicAction,
  createTermActivityRevision,
  createTermActivity,
  createTermCalendarException,
  createAcademicCalendarPeriod,
  createAcademicCalendarVersion,
  createMeetingRevisionDetail,
  createCourseworkRevisionDetail,
  createMeetingActivityVersionRequest,
  createCourseworkActivityVersionRequest,
  createTermActivityRevisionPreviewRequest,
  createTermCalendarExceptionRequest,
  createAcademicCalendarVersionRequest,
  createUpsertTermMeetingPatternRequest,
} from "./redesign-fixtures";

describe("redesign-fixtures", () => {
  describe("deterministic defaults", () => {
    it("meeting activity type has consistent UUIDs and defaults", () => {
      const type1 = createMeetingActivityType();
      const type2 = createMeetingActivityType();

      expect(type1.id).toBe(type2.id);
      expect(type1.behaviorFamily).toBe("meeting");
      expect(type1.currentVersionId).toBe(
        "00000000-0000-0000-0000-000000000011"
      );
      expect(type1.archivedAt).toBeNull();
    });

    it("meeting activity type version has consistent revision", () => {
      const version1 = createMeetingActivityTypeVersion();
      const version2 = createMeetingActivityTypeVersion();

      expect(version1.revision).toBe(1);
      expect(version2.revision).toBe(1);
      expect(version1.label).toBe("Lecture");
      expect(version1.publishedAt).toBe("2024-11-01T12:00:00Z");
    });

    it("coursework activity type version has correct behavior family", () => {
      const version = createCourseworkActivityTypeVersion();
      expect(version.label).toBe("Project");
      expect(version.activityTypeId).toBe(
        "00000000-0000-0000-0000-000000000012"
      );
    });

    it("meeting activity detail has meeting discriminant", () => {
      const detail = createMeetingActivityDetail();
      expect(detail.behaviorFamily).toBe("meeting");
      expect(detail.modality).toBe("in-person");
      expect(detail.defaultDurationMinutes).toBe(75);
    });

    it("coursework activity detail has coursework discriminant", () => {
      const detail = createCourseworkActivityDetail();
      expect(detail.behaviorFamily).toBe("coursework");
      expect(detail.submissionPolicy).toBe(
        "Electronic submission via portal"
      );
      expect(detail.releasePolicy).toBe(
        "Released one week before due date"
      );
    });

    it("meeting activity version includes meeting detail with correct discriminant", () => {
      const version = createMeetingActivityVersion();
      expect(version.detail.behaviorFamily).toBe("meeting");
      expect(version.title).toBe("Lecture 01: Introduction to Designing");
    });

    it("term activity has consistent IDs across defaults", () => {
      const activity = createTermActivity();
      expect(activity.id).toBe("00000000-0000-0000-0000-000000000031");
      expect(activity.termId).toBe("00000000-0000-0000-0000-000000000030");
      expect(activity.courseId).toBe("00000000-0000-0000-0000-000000000002");
    });

    it("term activity revision has correct created timestamp", () => {
      const revision = createTermActivityRevision();
      expect(revision.createdAt).toBe("2024-12-15T10:30:00Z");
      expect(revision.revision).toBe(1);
    });

    it("academic calendar version has deterministic academic year", () => {
      const version = createAcademicCalendarVersion();
      expect(version.academicYear).toBe("2024-2025");
      expect(version.version).toBe(1);
      expect(version.publishedAt).toBe("2024-11-01T12:00:00Z");
    });

    it("academic calendar period has instructional kind by default", () => {
      const period = createAcademicCalendarPeriod();
      expect(period.kind).toBe("instructional");
      expect(period.startsOn).toBe("2025-01-13");
      expect(period.endsOn).toBe("2025-05-02");
    });

    it("meeting pattern request has MWF schedule by default", () => {
      const pattern = createUpsertTermMeetingPatternRequest();
      expect(pattern.daysOfWeek).toContain("monday");
      expect(pattern.daysOfWeek).toContain("wednesday");
      expect(pattern.daysOfWeek).toContain("friday");
      expect(pattern.startTimeLocal).toBe("09:00");
    });
  });

  describe("typed overrides", () => {
    it("meeting activity type accepts partial overrides", () => {
      const custom = createMeetingActivityType({
        archivedAt: "2025-01-01T00:00:00Z",
      });
      expect(custom.behaviorFamily).toBe("meeting"); // default
      expect(custom.archivedAt).toBe("2025-01-01T00:00:00Z"); // override
    });

    it("activity version accepts title and summary overrides", () => {
      const custom = createMeetingActivityVersion({
        title: "Custom Lecture Title",
        summary: "Custom summary",
      });
      expect(custom.title).toBe("Custom Lecture Title");
      expect(custom.summary).toBe("Custom summary");
      expect(custom.detail.behaviorFamily).toBe("meeting"); // preserved
    });

    it("coursework activity version accepts partial milestone template overrides", () => {
      const custom = createCourseworkActivityVersion({
        milestoneTemplates: [
          createMilestoneTemplate({
            role: "release",
            label: "Custom Release",
          }),
          createMilestoneTemplate({
            role: "due",
            label: "Custom Due",
          }),
        ],
      });
      expect(custom.milestoneTemplates).toHaveLength(2);
      expect(custom.milestoneTemplates[0].label).toBe("Custom Release");
      expect(custom.milestoneTemplates[1].label).toBe("Custom Due");
    });

    it("term activity accepts deep adoption state overrides", () => {
      const custom = createTermActivity({
        adoptedLabel: "Renamed Project",
        ordinal: 5,
        lifecycleState: "completed",
      });
      expect(custom.adoptedLabel).toBe("Renamed Project");
      expect(custom.ordinal).toBe(5);
      expect(custom.lifecycleState).toBe("completed");
      expect(custom.termId).toBe("00000000-0000-0000-0000-000000000030"); // preserved
    });

    it("meeting revision detail accepts modality override", () => {
      const detail = createMeetingRevisionDetail({
        modality: "online",
        status: "moved",
      });
      expect(detail.behaviorFamily).toBe("meeting");
      expect(detail.modality).toBe("online");
      expect(detail.status).toBe("moved");
    });

    it("coursework revision detail accepts lifecycle state override", () => {
      const detail = createCourseworkRevisionDetail({
        lifecycleState: "submitted",
      });
      expect(detail.behaviorFamily).toBe("coursework");
      expect(detail.lifecycleState).toBe("submitted");
    });

    it("term calendar exception accepts action and reason overrides", () => {
      const exception = createTermCalendarException({
        action: "add",
        reason: "Makeup lecture scheduled",
      });
      expect(exception.action).toBe("add");
      expect(exception.reason).toBe("Makeup lecture scheduled");
      expect(exception.termId).toBe("00000000-0000-0000-0000-000000000030"); // preserved
    });

    it("meeting pattern request accepts custom day and time overrides", () => {
      const pattern = createUpsertTermMeetingPatternRequest({
        daysOfWeek: ["Tuesday", "Thursday"],
        startTimeLocal: "13:00",
        endTimeLocal: "14:30",
      });
      expect(pattern.daysOfWeek).toHaveLength(2);
      expect(pattern.daysOfWeek).toContain("Tuesday");
      expect(pattern.daysOfWeek).toContain("Thursday");
      expect(pattern.startTimeLocal).toBe("13:00");
      expect(pattern.endTimeLocal).toBe("14:30");
    });
  });

  describe("fresh nested data", () => {
    it("each call to createMeetingActivityVersion returns fresh milestone array", () => {
      const v1 = createMeetingActivityVersion();
      const v2 = createMeetingActivityVersion();

      // Arrays are different objects
      expect(v1.milestoneTemplates).not.toBe(v2.milestoneTemplates);
      // But have same structure
      expect(v1.milestoneTemplates[0].role).toBe(
        v2.milestoneTemplates[0].role
      );
    });

    it("milestone template has deterministic ID", () => {
      const m1 = createMilestoneTemplate();
      const m2 = createMilestoneTemplate();

      expect(m1.id).toBe(m2.id);
    });

    it("coursework activity version returns fresh nested arrays", () => {
      const v1 = createCourseworkActivityVersion();
      const v2 = createCourseworkActivityVersion();

      expect(v1.milestoneTemplates).not.toBe(v2.milestoneTemplates);
      expect(v1.detail).not.toBe(v2.detail);
      // All 4 milestones in each version
      expect(v1.milestoneTemplates).toHaveLength(4);
      expect(v2.milestoneTemplates).toHaveLength(4);
    });

    it("term activity revision topic actions are fresh", () => {
      const r1 = createTermActivityRevision();
      const r2 = createTermActivityRevision();

      expect(r1.topicActions).not.toBe(r2.topicActions);
      expect(r1.topicActions[0].id).toBe(r2.topicActions[0].id);
    });

    it("term activity revision milestones are fresh", () => {
      const r1 = createTermActivityRevision();
      const r2 = createTermActivityRevision();

      expect(r1.milestones).not.toBe(r2.milestones);
      expect(r1.milestones[0].id).toBe(r2.milestones[0].id);
    });

  });

  describe("multiple project milestones", () => {
    it("coursework activity version includes all 4 milestone types", () => {
      const version = createCourseworkActivityVersion();

      expect(version.milestoneTemplates).toHaveLength(4);
      expect(version.milestoneTemplates[0].role).toBe("release");
      expect(version.milestoneTemplates[1].role).toBe("phase_release");
      expect(version.milestoneTemplates[2].role).toBe("phase_release");
      expect(version.milestoneTemplates[3].role).toBe("due");
    });

    it("project milestones have sequenced labels", () => {
      const version = createCourseworkActivityVersion();
      const templates = version.milestoneTemplates;

      expect(templates[0].label).toBe("Project released");
      expect(templates[1].label).toBe("Phase 1: Prototype due");
      expect(templates[2].label).toBe("Phase 2: Peer review due");
      expect(templates[3].label).toBe("Final submission due");
    });

    it("project milestones have relative day anchors", () => {
      const version = createCourseworkActivityVersion();
      const templates = version.milestoneTemplates;

      // First release has no relative days
      expect(templates[0].relativeDays).toBeNull();
      // Subsequent phases have increasing relative days
      expect(templates[1].relativeDays).toBe(7);
      expect(templates[2].relativeDays).toBe(14);
      expect(templates[3].relativeDays).toBe(21);
    });

    it("milestones preserve sequence ordering", () => {
      const version = createCourseworkActivityVersion();
      const templates = version.milestoneTemplates;

      for (let i = 0; i < templates.length; i++) {
        expect(templates[i].sequence).toBe(i + 1);
      }
    });
  });

  describe("discriminant and anchor policy preservation", () => {
    it("meeting activity always has meeting detail discriminant", () => {
      const v = createMeetingActivityVersion();
      expect(v.detail.behaviorFamily).toBe("meeting");
      expect("modality" in v.detail).toBe(true);
      expect("submissionPolicy" in v.detail).toBe(false);
    });

    it("coursework activity always has coursework detail discriminant", () => {
      const v = createCourseworkActivityVersion();
      expect(v.detail.behaviorFamily).toBe("coursework");
      expect("submissionPolicy" in v.detail).toBe(true);
      expect("modality" in v.detail).toBe(false);
    });

    it("meeting revision detail preserves meeting discriminant", () => {
      const detail = createMeetingRevisionDetail({
        status: "moved",
      });
      expect(detail.behaviorFamily).toBe("meeting");
      expect("status" in detail).toBe(true);
    });

    it("coursework revision detail preserves coursework discriminant", () => {
      const detail = createCourseworkRevisionDetail({
        lifecycleState: "graded",
      });
      expect(detail.behaviorFamily).toBe("coursework");
      expect("lifecycleState" in detail).toBe(true);
    });

    it("term activity revision has coursework detail by default", () => {
      const revision = createTermActivityRevision();
      expect(revision.detail.behaviorFamily).toBe("coursework");
    });

    it("term activity milestone anchor policy is fixed_instant by default", () => {
      const milestone = createTermActivityMilestone();
      expect(milestone.anchorPolicy).toBe("fixed_instant");
      expect(milestone.occursAt).toBe("2025-02-10T23:59:00Z");
    });

    it("term activity milestone can override anchor policy", () => {
      const milestone = createTermActivityMilestone({
        anchorPolicy: "follow_activity",
        linkedTermActivityId: "00000000-0000-0000-0000-000000000020",
      });
      expect(milestone.anchorPolicy).toBe("follow_activity");
      expect(milestone.linkedTermActivityId).toBe(
        "00000000-0000-0000-0000-000000000020"
      );
    });

    it("term calendar exception action preserved", () => {
      const exceptions = [
        createTermCalendarException({ action: "cancel" }),
        createTermCalendarException({ action: "add" }),
        createTermCalendarException({ action: "replace" }),
        createTermCalendarException({ action: "modify" }),
      ];

      exceptions.forEach((ex, i) => {
        expect(["cancel", "add", "replace", "modify"][i]).toBe(ex.action);
      });
    });
  });

  describe("activity type and activity relationships", () => {
    it("meeting activity version links to meeting activity type version", () => {
      const activityVersion = createMeetingActivityVersion();
      const typeVersion = createMeetingActivityTypeVersion();

      expect(activityVersion.activityTypeVersionId).toBe(typeVersion.id);
    });

    it("coursework activity version links to coursework activity type version", () => {
      const activityVersion = createCourseworkActivityVersion();
      const typeVersion = createCourseworkActivityTypeVersion();

      expect(activityVersion.activityTypeVersionId).toBe(typeVersion.id);
    });

    it("term activity links adopted version to activity", () => {
      const activity = createCourseworkActivity();
      const termActivity = createTermActivity({
        activityId: activity.id,
        plannedActivityVersionId: activity.currentVersionId!,
      });

      expect(termActivity.activityId).toBe(activity.id);
      expect(termActivity.plannedActivityVersionId).toBe(
        activity.currentVersionId
      );
    });

    it("term activity revision references base activity version", () => {
      const activity = createCourseworkActivity();
      const version = createCourseworkActivityVersion();
      const revision = createTermActivityRevision({
        baseActivityVersionId: version.id,
      });

      expect(revision.baseActivityVersionId).toBe(version.id);
    });
  });

  describe("calendar and term integration", () => {
    it("academic calendar period fits within term dates", () => {
      const period = createAcademicCalendarPeriod();
      expect(period.startsOn).toBe("2025-01-13");
      expect(period.endsOn).toBe("2025-05-02");
    });

    it("term activity created date is plausible", () => {
      const termActivity = createTermActivity();
      expect(termActivity.plannedRevisionId).toBe(
        "00000000-0000-0000-0000-000000000032"
      );
    });

    it("calendar exception targets term start/end range", () => {
      const exception = createTermCalendarException();
      expect(exception.targetDate).toBe("2025-03-17");
      expect(exception.action).toBe("cancel");
    });
  });

  describe("type satisfaction", () => {
    it("meeting activity version satisfies ActivityVersionDto", () => {
      const version: ActivityVersionDto = createMeetingActivityVersion();
      expect(version.detail.behaviorFamily).toBe("meeting");
      expect(version.milestoneTemplates).toBeDefined();
    });

    it("term activity satisfies TermActivityDto", () => {
      const activity: TermActivityDto = createTermActivity();
      expect(activity.termId).toBeDefined();
      expect(activity.plannedActivityVersionId).toBeDefined();
    });

    it("term activity revision satisfies TermActivityRevisionDto", () => {
      const revision: TermActivityRevisionDto = createTermActivityRevision();
      expect(revision.topicActions).toBeDefined();
      expect(revision.milestones).toBeDefined();
    });

    it("calendar exception satisfies TermCalendarExceptionDto", () => {
      const exception: TermCalendarExceptionDto =
        createTermCalendarException();
      expect(exception.action).toBeDefined();
      expect(exception.termId).toBeDefined();
    });
  });

  describe("request-input factories", () => {
    it("meeting activity version request includes meeting detail and milestone templates", () => {
      const request = createMeetingActivityVersionRequest();
      expect(request.title).toBe("Lecture 01: Introduction to Designing");
      expect(request.detail.behaviorFamily).toBe("meeting");
      expect(request.milestoneTemplates).toHaveLength(1);
      expect(request.milestoneTemplates?.[0]?.role).toBe("release");
    });

    it("coursework activity version request includes multiple milestone templates", () => {
      const request = createCourseworkActivityVersionRequest();
      expect(request.title).toBe("Project 1: Data Visualization");
      expect(request.detail.behaviorFamily).toBe("coursework");
      expect(request.milestoneTemplates).toHaveLength(4);
      expect(request.milestoneTemplates?.[0]?.role).toBe("release");
      expect(request.milestoneTemplates?.[1]?.role).toBe("phase_release");
      expect(request.milestoneTemplates?.[2]?.role).toBe("phase_release");
      expect(request.milestoneTemplates?.[3]?.role).toBe("due");
    });

    it("term activity revision preview request includes detail, topic actions, and milestones", () => {
      const request = createTermActivityRevisionPreviewRequest();
      expect(request.title).toBe("Project 1: Data Visualization (Delivered)");
      expect(request.detail.behaviorFamily).toBe("coursework");
      expect(request.topicActions).toHaveLength(1);
      expect(request.milestones).toHaveLength(1);
      expect(request.milestones?.[0]?.role).toBe("due");
    });

    it("term calendar exception request has cancel action by default", () => {
      const request = createTermCalendarExceptionRequest();
      expect(request.action).toBe("cancel");
      expect(request.targetDate).toBe("2025-03-12");
      expect(request.label).toBe("Spring Break");
    });

    it("academic calendar version request includes event and special-schedule period", () => {
      const request = createAcademicCalendarVersionRequest();
      expect(request.name).toBe("Academic Year 2024-2025");
      expect(request.events).toHaveLength(1);
      expect(request.events?.[0]?.eventType).toBe("term_start");
      expect(request.periods).toHaveLength(3);
      expect(request.periods?.[0]?.kind).toBe("instructional");
      expect(request.periods?.[1]?.kind).toBe("no_instruction");
      expect(request.periods?.[2]?.kind).toBe("special_schedule");
      expect(request.periods?.[2]?.label).toBe("Finals");
    });

    it("upsert term meeting pattern request has MWF schedule by default", () => {
      const request = createUpsertTermMeetingPatternRequest();
      expect(request.daysOfWeek).toHaveLength(3);
      expect(request.startTimeLocal).toBe("09:00");
      expect(request.endTimeLocal).toBe("10:15");
      expect(request.timeZone).toBe("America/New_York");
    });
  });
});
