import { ExemplarImportService, genericDemoExemplarSnapshot } from "./exemplar-import-service";
import type { RedesignDb, RedesignTx } from "./types";

const DEMO_KEY = "generic-demo-v1";

export async function loadDemoCourse(
  db: RedesignDb,
  instructorId: string,
  importer: Pick<ExemplarImportService, "apply"> = new ExemplarImportService(),
): Promise<{ courseId: string; created: boolean }> {
  return db.$transaction(async (tx: RedesignTx) => {
    // Serialize demo loads for this Instructor. The transaction also rolls back
    // the new Course if its exemplar import fails.
    await tx.$queryRaw`SELECT id FROM instructors WHERE id = ${instructorId}::uuid FOR UPDATE`;
    const existing = await tx.course.findUnique({
      where: { instructorId_demoKey: { instructorId, demoKey: DEMO_KEY } },
      select: { id: true },
    });
    if (existing) return { courseId: existing.id, created: false };

    const instructor = await tx.instructor.update({
      where: { id: instructorId },
      data: { nextCourseSerial: { increment: 1 } },
      select: { nextCourseSerial: true },
    });
    const course = await tx.course.create({
      data: {
        instructorId,
        demoKey: DEMO_KEY,
        shortId: (instructor.nextCourseSerial - 1).toString().padStart(3, "0"),
        title: genericDemoExemplarSnapshot.course.title,
        number: genericDemoExemplarSnapshot.course.number,
        description: genericDemoExemplarSnapshot.course.description,
      },
    });

    await importer.apply(
      { $transaction: async (fn) => fn(tx) },
      {
        instructorId,
        courseId: course.id,
        snapshot: genericDemoExemplarSnapshot,
      },
    );
    return { courseId: course.id, created: true };
  }, { timeout: 300_000, maxWait: 30_000 });
}
