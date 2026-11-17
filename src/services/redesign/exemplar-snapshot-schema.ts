import { z } from "zod";

const key = z.string().min(1).max(200);
const label = z.string().min(1).max(500);
const text = z.string().max(20_000);
const optionalText = text.nullable().optional();
const optionalKey = key.nullable().optional();
const timeZone = z.string().min(1).max(100).refine((value) => {
  if (/^[+-]/.test(value)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Expected a valid IANA time zone");

export const exemplarSnapshotSchema = z.strictObject({
  snapshotId: key,
  course: z.strictObject({ title: label, number: key, description: optionalText }),
  activityTypes: z.array(z.strictObject({
    key, behaviorFamily: z.enum(["meeting", "coursework", "assessment"]),
    label, description: optionalText,
  })).max(100),
  learningModules: z.array(z.strictObject({
    stableCode: key, title: label, description: optionalText,
    objectives: z.array(text).max(100).optional(),
  })).max(100),
  topics: z.array(z.strictObject({
    stableCode: key, learningModuleCode: optionalKey, title: label,
    category: z.string().max(500).nullable().optional(), description: optionalText,
  })).max(500),
  activities: z.array(z.strictObject({
    stableCode: key, typeKey: key, learningModuleCode: optionalKey,
    title: label, summary: optionalText,
    milestoneTemplates: z.array(z.strictObject({
      role: z.enum(["release", "due", "review"]), label,
      linkedActivityCode: key.optional(), relativeDays: z.number().int().min(-3650).max(3650),
      defaultTime: z.string().max(5).regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), timeZone,
    })).max(20).optional(),
    topicActions: z.array(z.strictObject({
      topicRef: key, action: z.enum(["introduced", "practiced", "assessed"]), notes: optionalText,
    })).max(50).optional(),
  })).max(500),
});
