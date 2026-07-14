import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const migrationDir = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260713231701_phase_b31a_schema_root",
);
const migrationPath = path.join(migrationDir, "migration.sql");

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function expectContainsAll(haystack: string, needles: string[]): void {
  const normalizedHaystack = collapseWhitespace(haystack);
  for (const needle of needles) {
    expect(normalizedHaystack).toContain(collapseWhitespace(needle));
  }
}

describe("Phase B.3.1a Prisma schema root", () => {
  it("adds the accepted activity design and term delivery models additively", () => {
    const schema = read(schemaPath);

    expectContainsAll(schema, [
      "enum ActivityBehaviorFamily {",
      "model ActivityType {",
      "behaviorFamily ActivityBehaviorFamily",
      "model ActivityTypeVersion {",
      "label                 String",
      "model CourseActivityTypeVersion {",
      "model Activity {",
      "stableCode       String    @map(\"stable_code\")",
      "model ActivityVersion {",
      "activityTypeVersionId   String",
      "artifacts             Artifact[]",
      "model MeetingActivityVersion {",
      "model CourseworkActivityVersion {",
      "model AssessmentActivityVersion {",
      "model LearningModuleVersionActivity {",
      "model ActivityVersionLearningModuleScope {",
      "model ActivityVersionTopicAction {",
      "@@unique([activityVersionId, topicVersionId, action], map: \"activity_topic_actions_version_topic_action_key\")",
      "model ActivityTopicScope {",
      "model ActivityVersionMilestoneTemplate {",
      "model TermActivity {",
      "plannedActivityVersionId String",
      "activityTypeVersionId    String",
      "adoptedLabel             String",
      "plannedRevisionId        String?",
      "deliveredRevisionId      String?",
      "model TermActivityRevision {",
      "@@unique([termActivityId, revision])",
      "artifacts           Artifact[]",
      "model TermMeetingActivityRevision {",
      "model TermCourseworkActivityRevision {",
      "model TermAssessmentActivityRevision {",
      "model TermActivityRevisionTopicAction {",
      "@@unique([termActivityRevisionId, topicVersionId, action], map: \"term_revision_topic_action_key\")",
      "model TermActivityMilestone {",
      "activity_version",
      "term_activity_revision",
      "activityVersionId      String?",
      "termActivityRevisionId String?",
    ]);
  });

  it("adds the accepted calendar versioning root without removing B.1 compatibility tables", () => {
    const schema = read(schemaPath);

    expectContainsAll(schema, [
      "enum AcademicCalendarPeriodKind {",
      "instructional",
      "no_instruction",
      "special_schedule",
      "enum TermMilestoneAnchorPolicy {",
      "follow_activity",
      "fixed_instant",
      "standalone",
      "enum TermCalendarExceptionAction {",
      "cancel",
      "add",
      "replace",
      "modify",
      "model AcademicCalendarVersion {",
      "model AcademicCalendarPeriod {",
      "model TermMeetingPattern {",
      "model TermCalendarException {",
      "academicCalendarVersionId String?   @map(\"academic_calendar_version_id\") @db.Uuid",
      "academicCalendarVersionId String?            @map(\"academic_calendar_version_id\") @db.Uuid",
      "model LearningModuleVersionTopic {",
      "model Coverage {",
      "model AssessmentTopic {",
      "model Session {",
      "model InstructorCalendarOverride {",
    ]);
  });

  it("keeps one-row subtype tables and ordering uniques while leaving cross-row family matching to services", () => {
    const schema = read(schemaPath);

    expectContainsAll(schema, [
      "activityVersionId String @id",
      "termActivityRevisionId String @id",
      "@@unique([learningModuleVersionId, sequence], map: \"lm_version_activities_version_sequence_key\")",
      "@@unique([learningModuleVersionId, activityVersionId], map: \"lm_version_activities_version_activity_key\")",
      "@@unique([activityVersionId, learningModuleId], map: \"activity_lm_scopes_version_module_key\")",
      "@@unique([activityId, topicId])",
      "@@unique([activityVersionId, sequence], map: \"activity_milestones_version_sequence_key\")",
      "@@unique([termId, activityId])",
    ]);
  });
});

describe("Phase B.3.1a migration", () => {
  it("creates one forward-only additive migration with milestone anchor checks", () => {
    expect(fs.existsSync(migrationDir)).toBe(true);
    const sql = read(migrationPath);

    expectContainsAll(sql, [
      "CREATE TYPE \"ActivityBehaviorFamily\" AS ENUM",
      "CREATE TYPE \"AcademicCalendarPeriodKind\" AS ENUM",
      "CREATE TYPE \"TermMilestoneAnchorPolicy\" AS ENUM",
      "CREATE TYPE \"TermCalendarExceptionAction\" AS ENUM",
      "ALTER TYPE \"ArtifactParentType\" ADD VALUE 'activity_version'",
      "ALTER TYPE \"ArtifactParentType\" ADD VALUE 'term_activity_revision'",
      "CREATE TABLE \"activity_types\"",
      "CREATE TABLE \"activity_versions\"",
      "CREATE TABLE \"term_activities\"",
      "CREATE TABLE \"term_activity_revisions\"",
      "CREATE TABLE \"academic_calendar_versions\"",
      "CREATE TABLE \"academic_calendar_periods\"",
      "CREATE TABLE \"term_meeting_patterns\"",
      "CREATE TABLE \"term_calendar_exceptions\"",
      "ALTER TABLE \"terms\" ADD COLUMN \"academic_calendar_version_id\" UUID",
      "ALTER TABLE \"academic_calendars\" ADD COLUMN \"current_version_id\" UUID",
      "ALTER TABLE \"academic_calendar_events\" ADD COLUMN \"academic_calendar_version_id\" UUID",
      "ALTER TABLE \"artifacts\" ADD COLUMN \"activity_version_id\" UUID",
      "ALTER TABLE \"artifacts\" ADD COLUMN \"term_activity_revision_id\" UUID",
      "CREATE UNIQUE INDEX \"lm_version_activities_version_activity_key\"",
      "CREATE UNIQUE INDEX \"lm_version_activities_version_sequence_key\"",
      "CHECK (",
      "\"anchor_policy\" = 'follow_activity'",
      "\"anchor_policy\" = 'fixed_instant'",
      "\"anchor_policy\" = 'standalone'",
    ]);

    expect(sql).not.toContain("DROP TABLE \"learning_module_version_topics\"");
    expect(sql).not.toContain("DROP TABLE \"coverages\"");
    expect(sql).not.toContain("DROP TABLE \"assessment_topics\"");
    expect(sql).not.toContain("DROP TABLE \"sessions\"");
    expect(sql).not.toContain("DROP TABLE \"instructor_calendar_overrides\"");
    expect(sql).toMatch(
      /calendar_event_version_fkey"\s+FOREIGN KEY \("academic_calendar_version_id", "academic_calendar_id"\)\s+REFERENCES "academic_calendar_versions"\("id", "academic_calendar_id"\)\s+ON DELETE RESTRICT/,
    );
    expect(sql).toMatch(
      /term_activities_term_learning_module_id_term_id_fkey"\s+FOREIGN KEY \("term_learning_module_id", "term_id"\) REFERENCES "term_learning_modules"\("id", "term_id"\)\s+ON DELETE RESTRICT/,
    );
  });
});
