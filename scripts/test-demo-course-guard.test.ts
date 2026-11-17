import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("refuses an unconfirmed remote demo database before connecting or writing", () => {
  const result = spawnSync(process.execPath, [
    "node_modules/tsx/dist/cli.mjs", "scripts/test-demo-course-db.ts",
  ], {
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://user:pass@remote.example/db",
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@remote.example/db",
      SEED_FORCE_DATABASE: "",
    },
    encoding: "utf8",
    timeout: 10_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Refusing force seed on host "remote.example", database "db"');
});
