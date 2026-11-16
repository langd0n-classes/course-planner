import { describe, expect, it, vi } from "vitest";
import {
  DEMO_MARKER_TABLE,
  DemoModeConfigError,
  assertDemoDatabase,
  demoModeConfig,
  hasDemoMarker,
  isDemoMode,
} from "./demo-mode";

const conflicts = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ALLOWED_EMAIL",
  "COURSE_PLANNER_PREVIEW_AUTH",
  "COURSE_PLANNER_PREVIEW_EMAIL",
];

function fakeDb(marker: string | null) {
  const query = vi.fn();
  return {
    query,
    async $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> {
      query(strings, ...values);
      return [{ marker }] as T;
    },
  };
}

describe("demo mode configuration", () => {
  it.each([undefined, "", "true", "TRUE", "1", "false", "true "])(
    "enables only the exact true flag (%s)",
    (flag) => {
      const env = flag === undefined ? {} : { COURSE_PLANNER_DEMO: flag };
      expect(demoModeConfig(env)).toEqual({ enabled: flag === "true" });
      expect(isDemoMode(env)).toBe(flag === "true");
    },
  );

  it.each(conflicts)("rejects %s without exposing its value", (name) => {
    const env = { COURSE_PLANNER_DEMO: "true", [name]: "private-value@example.test" };
    expect(() => demoModeConfig(env)).toThrow(DemoModeConfigError);
    expect(() => demoModeConfig(env)).toThrow(name);
    expect(() => demoModeConfig(env)).not.toThrow("private-value@example.test");
    expect(() => isDemoMode(env)).toThrow(DemoModeConfigError);
  });

  it("names every configured conflict", () => {
    const env = Object.fromEntries(conflicts.map((name) => [name, "secret"]));
    try {
      demoModeConfig({ ...env, COURSE_PLANNER_DEMO: "true" });
      expect.fail("Expected configuration error");
    } catch (error) {
      expect(error).toBeInstanceOf(DemoModeConfigError);
      for (const name of conflicts) expect((error as Error).message).toContain(name);
      expect((error as Error).message).not.toContain("secret");
    }
  });

  it.each(conflicts)("ignores whitespace-only %s", (name) => {
    expect(demoModeConfig({ COURSE_PLANNER_DEMO: "true", [name]: "   " }))
      .toEqual({ enabled: true });
  });

  it("ignores conflicts when the flag is absent", () => {
    expect(demoModeConfig(Object.fromEntries(conflicts.map((name) => [name, "set"]))))
      .toEqual({ enabled: false });
  });

  it("reads only the flag when disabled and never reads public variables", () => {
    const reads: string[] = [];
    const env = new Proxy({}, {
      get: (_, name: string) => {
        reads.push(name);
        return undefined;
      },
    });
    expect(demoModeConfig(env)).toEqual({ enabled: false });
    expect(reads).toEqual(["COURSE_PLANNER_DEMO"]);
    reads.length = 0;
    const enabled = new Proxy({ COURSE_PLANNER_DEMO: "true" }, {
      get: (target, name: string) => {
        reads.push(name);
        return target[name as keyof typeof target];
      },
    });
    expect(demoModeConfig(enabled)).toEqual({ enabled: true });
    expect(reads.some((name) => name.startsWith("NEXT_PUBLIC_"))).toBe(false);
  });

  it("defaults to the server environment", () => {
    vi.stubEnv("COURSE_PLANNER_DEMO", "false");
    try {
      expect(demoModeConfig()).toEqual({ enabled: false });
      expect(isDemoMode()).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("demo database marker", () => {
  it.each([null, "_demo_marker"])("checks marker presence (%s)", async (marker) => {
    const db = fakeDb(marker);
    expect(DEMO_MARKER_TABLE).toBe("_demo_marker");
    expect(await hasDemoMarker(db)).toBe(marker !== null);
    const [query] = db.query.mock.calls[0] as unknown as [TemplateStringsArray];
    expect(query.join("").trim()).toBe("SELECT to_regclass('public._demo_marker')::text AS marker");
  });

  it("treats an empty result as a missing marker", async () => {
    const db = { $queryRaw: async <T = unknown>() => [] as T };
    expect(await hasDemoMarker(db)).toBe(false);
  });

  it.each([
    [false, false], [false, true], [true, false], [true, true],
  ])("requires flag %s and marker %s", async (enabled, present) => {
    const db = fakeDb(present ? "_demo_marker" : null);
    const result = assertDemoDatabase(db, { COURSE_PLANNER_DEMO: String(enabled) });
    if (enabled && present) {
      await expect(result).resolves.toBeUndefined();
    } else {
      await expect(result).rejects.toBeInstanceOf(DemoModeConfigError);
      await expect(result).rejects.toThrow(enabled ? "marker" : "not enabled");
    }
    expect(db.query).toHaveBeenCalledTimes(enabled ? 1 : 0);
  });

  it("rejects conflicting configuration before querying", async () => {
    const db = fakeDb("_demo_marker");
    await expect(assertDemoDatabase(db, {
      COURSE_PLANNER_DEMO: "true", ALLOWED_EMAIL: "owner@example.test",
    })).rejects.toThrow(DemoModeConfigError);
    expect(db.query).not.toHaveBeenCalled();
  });
});
