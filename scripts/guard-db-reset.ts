import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { assertSeedForceAllowed } from "../prisma/seed-guard";

// Prisma reads .env; Next's .env.local files must not change the guarded target.
// Existing command-line environment variables take precedence.
if (existsSync(".env")) loadEnvFile(".env");
assertSeedForceAllowed(process.env.DATABASE_URL, process.env.SEED_FORCE_DATABASE);
// migrate reset uses Prisma's direct URL when configured. Guard both targets.
if (process.env.DATABASE_URL_UNPOOLED) {
  assertSeedForceAllowed(process.env.DATABASE_URL_UNPOOLED, process.env.SEED_FORCE_DATABASE);
}
