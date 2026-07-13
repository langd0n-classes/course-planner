import { describe, expect, it } from "vitest";

import { getPreviewAuthEmail, isSignInEmailAllowed } from "./auth-config";

describe("preview authentication configuration", () => {
  it("requires both Vercel preview scope and the explicit bypass flag", () => {
    expect(
      getPreviewAuthEmail({
        VERCEL_ENV: "production",
        COURSE_PLANNER_PREVIEW_AUTH: "true",
        COURSE_PLANNER_PREVIEW_EMAIL: "alice.chen@example.edu",
      }),
    ).toBeNull();

    expect(
      getPreviewAuthEmail({
        VERCEL_ENV: "preview",
        COURSE_PLANNER_PREVIEW_AUTH: "false",
        COURSE_PLANNER_PREVIEW_EMAIL: "alice.chen@example.edu",
      }),
    ).toBeNull();
  });

  it("returns the configured instructor only for an explicitly enabled preview", () => {
    expect(
      getPreviewAuthEmail({
        VERCEL_ENV: "preview",
        COURSE_PLANNER_PREVIEW_AUTH: "true",
        COURSE_PLANNER_PREVIEW_EMAIL: " alice.chen@example.edu ",
      }),
    ).toBe("alice.chen@example.edu");
  });

  it("allows the preview instructor without weakening the regular allowlist", () => {
    const env = {
      VERCEL_ENV: "preview",
      COURSE_PLANNER_PREVIEW_AUTH: "true",
      COURSE_PLANNER_PREVIEW_EMAIL: "alice.chen@example.edu",
      ALLOWED_EMAIL: "owner@example.edu, colleague@example.edu",
    };

    expect(isSignInEmailAllowed("alice.chen@example.edu", env)).toBe(true);
    expect(isSignInEmailAllowed("owner@example.edu", env)).toBe(true);
    expect(isSignInEmailAllowed("stranger@example.edu", env)).toBe(false);
  });
});
