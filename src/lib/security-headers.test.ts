import { expect, it } from "vitest";
import config from "../../next.config";
it("adds security headers to every response without a CSP", async () => {
  const rules = await config.headers!();
  const headers = rules.find((rule) => rule.source === "/:path*")!.headers;
  expect(headers).toEqual(expect.arrayContaining([
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
  ]));
  expect(headers.some((h) => h.key === "Content-Security-Policy")).toBe(false);
});
