import { beforeEach, expect, it, vi } from "vitest";
import type { NextAuthConfig } from "next-auth";
const captured = vi.hoisted(() => ({ config: {} as NextAuthConfig }));
vi.mock("next-auth", () => ({ default: (config: NextAuthConfig) => { captured.config = config; return {}; } }));
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("COURSE_PLANNER_PREVIEW_AUTH", "true");
  vi.stubEnv("COURSE_PLANNER_PREVIEW_EMAIL", "preview@example.test");
  vi.stubEnv("ALLOWED_EMAIL", "owner@example.test");
});
async function config() { await import("../../auth"); return captured.config; }
async function preview() {
  const cfg = await config();
  const provider = cfg.providers.find((p) => typeof p !== "function" && p.options?.id === "course-planner-preview");
  if (!provider || typeof provider === "function") throw new Error("Missing preview provider");
  // Auth.js merges provider options during initialization.
  return provider.options as { credentials: Record<string, unknown>; authorize: (credentials: Record<string, unknown>) => Promise<unknown> };
}
it("keeps the main preview provider credential-free", async () => {
  const provider = await preview();
  expect(provider.credentials).toEqual({});
  expect(await provider.authorize({})).toEqual({
    id: "preview:preview@example.test", email: "preview@example.test", name: "Preview Instructor",
  });
});
it.each([false, undefined, "true"])("rejects Google email_verified=%s", async (email_verified) => {
  const cb = (await config()).callbacks!.signIn!;
  expect(await cb({ account: { provider: "google" }, profile: { email: "owner@example.test", email_verified }, user: {} } as never)).toBe(false);
});
it("accepts verified allowlisted Google profiles", async () => {
  const cb = (await config()).callbacks!.signIn!;
  expect(await cb({ account: { provider: "google" }, profile: { email: "owner@example.test", email_verified: true }, user: {} } as never)).toBe(true);
});
it("rechecks the current allowlist on session reads", async () => {
  const cb = (await config()).callbacks!.session!;
  const args = { session: { user: { email: "owner@example.test" }, expires: "2099-01-01" }, token: {} };
  expect(await cb(args as never)).toMatchObject({ user: { email: "owner@example.test" } });
  vi.stubEnv("ALLOWED_EMAIL", "new@example.test");
  expect(await cb(args as never)).toMatchObject({ user: undefined });
});
