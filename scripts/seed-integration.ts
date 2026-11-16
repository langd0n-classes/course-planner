import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { seedId } from "../prisma/seed-data";
import { demoSemesters } from "../src/services/redesign/demo-course-service";

const url = process.env.SEED_TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/cp15") {
  throw new Error(
    "SEED_TEST_DATABASE_URL must point to the dedicated cp15 database",
  );
}
process.env.DATABASE_URL = url;
process.env.DATABASE_URL_UNPOOLED = url;
const db = new PrismaClient();
const seedCli = (force = false) =>
  execFileSync(
    "./node_modules/.bin/tsx",
    ["prisma/seed.ts", ...(force ? ["--force"] : [])],
    {
      env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
      stdio: "pipe",
    },
  );

async function contents() {
  const tables = await db.$queryRawUnsafe<Array<{ tablename: string }>>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename",
  );
  const result: Record<string, unknown> = {};
  for (const { tablename } of tables) {
    const rows = await db.$queryRawUnsafe<Array<{ rows: unknown }>>(
      `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) AS rows FROM "${tablename}" t`,
    );
    result[tablename] = rows[0].rows;
  }
  return result;
}

async function main() {
  try {
    seedCli(true);
    const first = await contents();

    const [current, next] = demoSemesters(new Date());
    const exemplarTerms = await db.term.findMany({
      where: { courseId: seedId("exemplar-course") },
      include: { activities: true, calendarSlots: true },
    });
    assert.deepEqual(
      exemplarTerms.map((term) => term.code).sort(),
      [current.code, next.code].sort(),
      "the exemplar course must hold the current and next Term",
    );
    const currentTerm = exemplarTerms.find((term) => term.code === current.code)!;
    assert.equal(currentTerm.status, current.inProgress ? "active" : "planned");
    assert.equal(currentTerm.startDate.toISOString().slice(0, 10), current.startDate.toISOString().slice(0, 10));
    assert.ok(currentTerm.activities.length > 0, "the current Term must have adopted Activities");
    assert.ok(exemplarTerms.every((term) => term.calendarSlots.length > 20));
    assert.equal(
      await db.term.count({ where: { id: seedId("term"), code: "S26" } }),
      1,
      "the foundation course keeps its fixed past Term",
    );
    seedCli();
    assert.deepEqual(
      await contents(),
      first,
      "two default runs must leave every application table identical",
    );

    const outsider = await db.instructor.create({
      data: { name: "Real Instructor", email: "real@example.test" },
    });
    const realCourse = await db.course.create({
      data: {
        instructorId: outsider.id,
        shortId: "001",
        title: "Real Course",
        number: "R 101",
      },
    });
    const withOutsider = await contents();
    seedCli();
    assert.deepEqual(
      await contents(),
      withOutsider,
      "default seed must not change non-seed rows",
    );
    assert.deepEqual(
      await db.course.findUnique({ where: { id: realCourse.id } }),
      realCourse,
    );

    seedCli(true);
    assert.equal(
      await db.instructor.findUnique({ where: { id: outsider.id } }),
      null,
    );
    assert.equal(
      await db.course.findUnique({ where: { id: realCourse.id } }),
      null,
    );
    console.log(
      "Seed integration checks passed: current and next Term, identical rerun, preserved outsider, force wipe.",
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
