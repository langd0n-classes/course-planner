import { localInstant } from "./meeting-placement";
import { localDate } from "@/lib/term-revision-rules";
import type {
  MilestoneTemplateDraft,
  TermActivityMilestoneInput,
} from "./types";

export type MilestoneDatingActivity = {
  id: string;
  activityId: string;
  adoptedLabel: string;
  plannedRevisionId: string | null;
  archivedAt?: Date | null;
  hasTemplateMilestoneHistory?: boolean;
  milestones: (TermActivityMilestoneInput & { id: string })[];
  templates: (MilestoneTemplateDraft & { id: string })[];
  sourceTemplates?: (MilestoneTemplateDraft & { id: string })[];
  meeting: {
    startsAt: Date | null;
    calendarSlotId: string | null;
    status?: string | null;
  } | null;
};
export type MilestoneDatingReason =
  | "invalid_time_zone"
  | "invalid_default_time"
  | "linked_meeting_canceled"
  | "linked_activity_archived"
  | "linked_meeting_undated"
  | "linked_activity_not_a_meeting"
  | "no_template"
  | "no_default_time"
  | "no_time_zone"
  | "local_time_does_not_exist";
type Item = {
  termActivityId: string;
  expectedPlannedRevisionId: string | null;
  adoptedLabel: string;
  milestoneId: string | null;
  sourceTemplateId: string | null;
  label: string;
  linkedTermActivityId: string | null;
  linkedMeetingLabel: string | null;
};
export function planMilestoneDating(input: {
  activities: MilestoneDatingActivity[];
  slots: { id: string; date: string }[];
}) {
  const dates: (Item & { occursAt: Date; timeZone: string })[] = [];
  const creates: (Item & { milestone: TermActivityMilestoneInput })[] = [];
  const undated: (Item & { reason: MilestoneDatingReason })[] = [];
  let alreadyDatedCount = 0;
  const slots = new Map(input.slots.map((s) => [s.id, s.date]));
  for (const activity of input.activities) {
    if (activity.archivedAt) continue;
    const milestones: (TermActivityMilestoneInput & { id: string | null })[] = [
      ...activity.milestones,
    ];
    const hasTemplateMilestones =
      activity.hasTemplateMilestoneHistory ||
      activity.milestones.some((m) => m.sourceTemplateId);
    for (const template of hasTemplateMilestones ? [] : activity.templates) {
      if (milestones.some((m) => m.sourceTemplateId === template.id)) continue;
      const linked = input.activities.find(
        (a) =>
          a.activityId === template.linkedActivityId &&
          a.id !== activity.id &&
          !a.archivedAt,
      );
      if (!linked) continue;
      const milestone = {
        id: null,
        sourceTemplateId: template.id,
        role: template.role,
        label: template.label,
        linkedTermActivityId: linked.id,
        occursAt: null,
        timeZone: template.timeZone ?? null,
        anchorPolicy: "follow_activity" as const,
        notes: template.notes ?? null,
      };
      milestones.push(milestone);
      creates.push({ ...item(milestone), milestone });
    }
    function item(m: TermActivityMilestoneInput & { id: string | null }): Item {
      return {
        termActivityId: activity.id,
        expectedPlannedRevisionId: activity.plannedRevisionId,
        adoptedLabel: activity.adoptedLabel,
        milestoneId: m.id,
        sourceTemplateId: m.sourceTemplateId ?? null,
        label: m.label,
        linkedTermActivityId: m.linkedTermActivityId ?? null,
        linkedMeetingLabel:
          input.activities.find((a) => a.id === m.linkedTermActivityId)
            ?.adoptedLabel ?? null,
      };
    }
    for (const milestone of milestones) {
      if (milestone.occursAt) {
        alreadyDatedCount++;
        continue;
      }
      if (milestone.anchorPolicy !== "follow_activity") continue;
      const entry = item(milestone);
      const template = [
        ...(activity.sourceTemplates ?? []),
        ...activity.templates,
      ].find((t) => t.id === milestone.sourceTemplateId);
      const linked = input.activities.find(
        (a) => a.id === milestone.linkedTermActivityId,
      );
      let reason: MilestoneDatingReason | null = !template
        ? "no_template"
        : !template.defaultTime
          ? "no_default_time"
          : !template.timeZone
            ? "no_time_zone"
            : !linked
              ? "linked_meeting_undated"
              : linked.archivedAt
                ? "linked_activity_archived"
                : !linked.meeting
                  ? "linked_activity_not_a_meeting"
                  : null;
      if (reason) {
        undated.push({ ...entry, reason });
        continue;
      }
      if (linked!.meeting!.status === "canceled")
        reason = "linked_meeting_canceled";
      else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(template!.defaultTime!))
        reason = "invalid_default_time";
      else {
        try {
          new Intl.DateTimeFormat("en", { timeZone: template!.timeZone! });
        } catch {
          reason = "invalid_time_zone";
        }
      }
      if (reason) {
        undated.push({ ...entry, reason });
        continue;
      }
      const meeting = linked!.meeting!;
      const date = meeting.startsAt
        ? localDate(meeting.startsAt, template!.timeZone!)
        : slots.get(meeting.calendarSlotId ?? "");
      if (!date) {
        undated.push({ ...entry, reason: "linked_meeting_undated" });
        continue;
      }
      const shifted = new Date(`${date}T12:00:00Z`);
      shifted.setUTCDate(shifted.getUTCDate() + (template!.relativeDays ?? 0));
      try {
        dates.push({
          ...entry,
          occursAt: localInstant(
            shifted.toISOString().slice(0, 10),
            template!.defaultTime!,
            template!.timeZone!,
          ),
          timeZone: template!.timeZone!,
        });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.startsWith("Local time does not exist:")
        )
          throw error;
        reason = "local_time_does_not_exist";
        undated.push({ ...entry, reason });
      }
    }
  }
  return { dates, creates, undated, alreadyDatedCount };
}
