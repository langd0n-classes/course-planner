import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it.each([false, true])("guards Prisma's .env despite a safe .env.local (direct=%s)", direct => {
  const directory = mkdtempSync(join(tmpdir(), "cp119-reset-"));
  try {
    const local = "postgresql://agent:agent@127.0.0.1/cp_119_fix";
    const remote = "postgresql://user:secret@remote.example/production";
    writeFileSync(join(directory, ".env"), `DATABASE_URL=${direct ? local : remote}\nDATABASE_URL_UNPOOLED=${remote}\n`);
    writeFileSync(join(directory, ".env.local"), `DATABASE_URL=${local}\nDATABASE_URL_UNPOOLED=${local}\n`);
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.DATABASE_URL_UNPOOLED;
    delete env.SEED_FORCE_DATABASE;
    const result = spawnSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), resolve("scripts/guard-db-reset.ts")], { cwd: directory, env, encoding: "utf8", timeout: 10_000 });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Refusing force seed on host "remote.example", database "production"');
    expect(result.stderr).not.toContain("secret");
  } finally {
    rmSync(directory, { recursive: true });
  }
});
