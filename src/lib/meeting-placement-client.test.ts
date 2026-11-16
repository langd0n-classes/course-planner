import { afterEach, expect, it, vi } from "vitest";
import { redesignApi, setMockBackend } from "./redesign-api-client";
afterEach(() => {
  setMockBackend(null);
  vi.unstubAllGlobals();
});
it("posts meeting placement requests through the typed client", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ kind: "preview" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  await redesignApi.previewMeetingPlacement("term", {
    defaultMeetingTime: null,
  });
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/terms/term/placement-preview",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ defaultMeetingTime: null }),
    }),
  );
  await redesignApi.applyMeetingPlacement("term", {
    defaultMeetingTime: null,
    previewToken: "token",
  });
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/terms/term/placement-apply",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ defaultMeetingTime: null, previewToken: "token" }),
    }),
  );
});

import { CANONICAL_ROUTES } from "./redesign-contract";
it("registers each placement route exactly once", () => {
  expect(CANONICAL_ROUTES.filter(route => route === "/api/terms/[id]/placement-preview")).toHaveLength(1);
  expect(CANONICAL_ROUTES.filter(route => route === "/api/terms/[id]/placement-apply")).toHaveLength(1);
});
