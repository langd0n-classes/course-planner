import { describe, expect, it } from "vitest";
import { assertSeedForceAllowed } from "../prisma/seed-guard";
describe("force seed guard", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])("allows local host %s", (host) => {
    expect(() => assertSeedForceAllowed(`postgresql://user:secret@${host}/demo`)).not.toThrow();
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
