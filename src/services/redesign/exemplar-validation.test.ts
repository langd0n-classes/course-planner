import { expect, it } from "vitest";
import { ExemplarImportService, genericDemoExemplarSnapshot } from "./exemplar-import-service";

const service = new ExemplarImportService();
function invalid(path: string, value: unknown) {
  const snapshot = structuredClone(genericDemoExemplarSnapshot);
  const parts = path.split(".");
  let target = snapshot as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) target = target[part] as Record<string, unknown>;
  target[parts.at(-1)!] = value;
  return snapshot;
}
it.each([
  ["course.title", 42, "$.course.title"],
  ["snapshotId", "x".repeat(201), "$.snapshotId"],
  ["course.description", "x".repeat(20001), "$.course.description"],
  ["topics.0.title", false, "$.topics[0].title"],
  ["topics.0.category", [], "$.topics[0].category"],
  ["learningModules.0.objectives.0", 42, "$.learningModules[0].objectives[0]"],
  ["activities.0.typeKey", null, "$.activities[0].typeKey"],
  ["activities.0.topicActions.0.action", "unknown", "$.activities[0].topicActions[0].action"],
  ["activities.1.milestoneTemplates.0.timeZone", "+01:00", "$.activities[1].milestoneTemplates[0].timeZone"],
  ["activities.1.milestoneTemplates.0.timeZone", "Unknown/Zone", "$.activities[1].milestoneTemplates[0].timeZone"],
  ["activities.1.milestoneTemplates.0.relativeDays", "1", "$.activities[1].milestoneTemplates[0].relativeDays"],
  ["activities.1.milestoneTemplates.0.defaultTime", "99:99", "$.activities[1].milestoneTemplates[0].defaultTime"],
  ["activityTypes.0.behaviorFamily", "unknown", "$.activityTypes[0].behaviorFamily"],
])("rejects invalid %s with the first problem path", (path, value, problemPath) => {
  expect(() => service.stage(invalid(path, value))).toThrow(problemPath);
});
it.each([
  ["topics", 501, genericDemoExemplarSnapshot.topics[0], "$.topics"],
  ["activities", 501, genericDemoExemplarSnapshot.activities[0], "$.activities"],
  ["learningModules", 101, genericDemoExemplarSnapshot.learningModules[0], "$.learningModules"],
  ["activities.0.topicActions", 51, genericDemoExemplarSnapshot.activities[0].topicActions![0], "$.activities[0].topicActions"],
  ["activities.1.milestoneTemplates", 21, genericDemoExemplarSnapshot.activities[1].milestoneTemplates![0], "$.activities[1].milestoneTemplates"],
])("bounds %s", (path, count, item, problemPath) => {
  expect(() => service.stage(invalid(path, Array.from({ length: count }, () => item)))).toThrow(problemPath);
});
it("accepts the generic snapshot", () => {
  expect(service.stage(genericDemoExemplarSnapshot).snapshot).toEqual(genericDemoExemplarSnapshot);
});
