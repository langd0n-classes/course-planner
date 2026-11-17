import { expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
vi.mock("@/auth", () => ({ auth: (handler: unknown) => handler }));
import { proxy } from "./proxy";

it.each([
  ["POST", "/api/courses", "https://other.test", 403],
  ["PATCH", "/api/courses/1", "https://other.test", 403],
  ["DELETE", "/api/courses/1", "https://other.test", 403],
  ["PUT", "/api/courses/1", "https://other.test", 403],
  ["POST", "/api/courses", "https://app.test", 200],
  ["POST", "/api/courses", "https://app.test:444", 403],
  ["POST", "/api/courses", undefined, 200],
  ["POST", "/api/courses", "null", 403],
  ["POST", "/api/courses", "invalid", 403],
  ["GET", "/api/courses", "https://other.test", 200],
  ["HEAD", "/api/courses", "https://other.test", 200],
  ["OPTIONS", "/api/courses", "https://other.test", 200],
  ["POST", "/api/auth/callback/google", "https://other.test", 200],
  ["POST", "/courses", "https://other.test", 200],
])("%s %s with Origin %s returns %s", async (method, path, origin, status) => {
  const request = new NextRequest(`https://app.test${path}`, { method, headers: origin ? { origin } : {} });
  const response = await (proxy as unknown as (request: NextRequest) => Promise<NextResponse>)(request);
  expect(response.status).toBe(status);
});
