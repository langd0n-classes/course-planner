import { loadEnvConfig } from "@next/env";
import { assertSeedForceAllowed } from "../prisma/seed-guard";

loadEnvConfig(process.cwd());
assertSeedForceAllowed(process.env.DATABASE_URL, process.env.SEED_FORCE_DATABASE);
// migrate reset uses Prisma's direct URL when configured. Guard both targets.
if (process.env.DATABASE_URL_UNPOOLED) {
  assertSeedForceAllowed(process.env.DATABASE_URL_UNPOOLED, process.env.SEED_FORCE_DATABASE);
}
