import type { RedesignTx } from "./types";

// Only called for a newly imported demo, before Activity adoption. Repeat loads
// preserve instructor changes to vocabulary and estimates.
export async function seedDemoEffort(tx: RedesignTx, courseId: string) {
  await tx.courseEffortSize.createMany({
    data: [
      {
        courseId,
        scale: "student",
        label: "Small",
        minMinutes: 30,
        maxMinutes: 45,
        sequence: 0,
      },
      {
        courseId,
        scale: "student",
        label: "Medium",
        minMinutes: 60,
        maxMinutes: 120,
        sequence: 1,
      },
      {
        courseId,
        scale: "student",
        label: "Large",
        minMinutes: 180,
        maxMinutes: 300,
        sequence: 2,
      },
    ],
  });
  const reading = await tx.courseEffortPartKind.create({
    data: { courseId, label: "Reading", sequence: 0 },
  });
  const practice = await tx.courseEffortPartKind.create({
    data: { courseId, label: "Practice", sequence: 1 },
  });
  const versions: {
    id: string;
    courseworkDetail?: object | null;
    assessmentDetail?: object | null;
  }[] = await tx.activityVersion.findMany({
    where: { activity: { courseId } },
    include: { courseworkDetail: true, assessmentDetail: true },
    orderBy: { id: "asc" },
  });
  let withParts = false;
  for (const version of versions) {
    if (version.courseworkDetail) {
      await tx.courseworkActivityVersion.update({
        where: { activityVersionId: version.id },
        data: { effortMinMinutes: 60, effortMaxMinutes: 120 },
      });
      if (!withParts) {
        await tx.activityVersionEffortPart.createMany({
          data: [
            {
              activityVersionId: version.id,
              sequence: 0,
              label: "Reading",
              partKindId: reading.id,
              minMinutes: 15,
              maxMinutes: 30,
              note: "Read the instructions and examples.",
            },
            {
              activityVersionId: version.id,
              sequence: 1,
              label: "Practice",
              partKindId: practice.id,
              minMinutes: 45,
              maxMinutes: 90,
              note: null,
            },
          ],
        });
        withParts = true;
      }
    } else if (version.assessmentDetail) {
      await tx.assessmentActivityVersion.update({
        where: { activityVersionId: version.id },
        data: { effortMinMinutes: 30, effortMaxMinutes: 45 },
      });
    }
  }
}
