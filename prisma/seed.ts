import { PrismaClient } from "@prisma/client";
import { seedDemoRows } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--force")) {
    throw new Error(
      `Unknown seed option: ${args.filter((arg) => arg !== "--force").join(", ")}`,
    );
  }
  if (args.includes("--force")) {
    // The explicit force path wipes every application table, including tables
    // added since this script was written. Prisma migration history is retained.
    await prisma.$executeRawUnsafe(`DO $$ DECLARE tables text; BEGIN
      SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO tables
      FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations';
      IF tables IS NOT NULL THEN EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE'; END IF;
    END $$`);
  }
  await seedDemoRows(prisma, {
    instructorEmail: process.env.SEED_INSTRUCTOR_EMAIL,
    instructorName: process.env.SEED_INSTRUCTOR_NAME,
  });
  console.log("Seeded redesign foundation data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
