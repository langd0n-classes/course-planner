import { describe, expect, it } from "vitest";
import { assertSeedForceAllowed } from "../prisma/seed-guard";
describe("force seed guard", () => {
  it.each(["localhost", "LOCALHOST", "localhost.", "127.0.0.1", "[::1]"])("allows local host %s", (host) => {
    expect(() => assertSeedForceAllowed(`postgresql://user:secret@${host}/course_planner_dev`)).not.toThrow();
  });
  it("allows a remote database only with an exact name confirmation", () => {
    expect(() => assertSeedForceAllowed("postgresql://user:secret@remote/demo", "demo")).not.toThrow();
    expect(() => assertSeedForceAllowed("postgresql://user:secret@remote/demo", "other")).toThrow(/remote.*demo/);
  });
  it("decodes the database name for confirmation", () => {
    expect(() => assertSeedForceAllowed("postgresql://user:secret@remote/my%20db", "my db")).not.toThrow();
  });
  it("does not expose passwords or the full URL", () => {
    try { assertSeedForceAllowed("postgresql://user:secret@remote/demo"); throw new Error("guard did not reject"); }
    catch (error) {
      expect((error as Error).message).toContain("remote");
      expect((error as Error).message).toContain("demo");
      expect((error as Error).message).not.toMatch(/secret|postgresql:\/\//);
    }
  });
  it.each([undefined, "invalid", "postgresql://remote/"])("rejects missing or invalid database URL %s", (url) => {
    expect(() => assertSeedForceAllowed(url)).toThrow();
  });
});

it.each(["?host=remote", "?host="])("requires confirmation for a host query override %s", (query) => {
  const url = `postgresql://user:secret@localhost/demo${query}`;
  expect(() => assertSeedForceAllowed(url)).toThrow(/SEED_FORCE_DATABASE/);
  expect(() => assertSeedForceAllowed(url, "other")).toThrow();
  expect(() => assertSeedForceAllowed(url, "demo")).not.toThrow();
});

it.each(["production", "demo", "postgres"])("rejects arbitrary local database %s", database => {
  const url = `postgresql://user:secret@localhost/${database}`;
  expect(() => assertSeedForceAllowed(url)).toThrow();
  expect(() => assertSeedForceAllowed(url, database)).not.toThrow();
});
it.each(["cp_hardening", "cp15", "cp_119_fix", "cp15_119", "course_planner"])("allows development database %s", database => {
  expect(() => assertSeedForceAllowed(`postgresql://user:secret@localhost/${database}`)).not.toThrow();
});

it("accepts the CI database names and the configured local example", async () => {
  const { readFileSync } = await import("node:fs");
  const ci = readFileSync(".github/workflows/ci.yml", "utf8");
  const urls = ci.match(/postgresql:\/\/[^\s"']+/g)!;
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) expect(() => assertSeedForceAllowed(url)).not.toThrow();
  const env = Object.fromEntries(readFileSync(".env.example", "utf8").split("\n").filter(line => line && !line.startsWith("#")).map(line => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)]; }));
  expect(() => assertSeedForceAllowed(env.DATABASE_URL, env.SEED_FORCE_DATABASE)).not.toThrow();
  const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
  expect(scripts["db:reset"]).toMatch(/^tsx scripts\/guard-db-reset.ts && .*prisma migrate reset/);
});

it("allows isolated seed integration databases and rejects other names", async () => {
  const { assertSeedTestDatabaseAllowed } = await import("../prisma/seed-guard");
  for (const name of ["cp15", "cp15_119"]) expect(() => assertSeedTestDatabaseAllowed(`postgresql://agent:agent@localhost/${name}`)).not.toThrow();
  for (const name of ["cp15production", "postgres", "course_planner", "cp_119_fix"]) expect(() => assertSeedTestDatabaseAllowed(`postgresql://agent:agent@localhost/${name}`)).toThrow();
});
