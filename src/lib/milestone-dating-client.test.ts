import { afterEach, expect, it, vi } from "vitest";
import { redesignApi, setMockBackend } from "./redesign-api-client";
afterEach(() => {
  setMockBackend(null);
  vi.unstubAllGlobals();
});
it("posts milestone dating requests through the typed client", async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ kind: "preview" }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  await redesignApi.previewMilestoneDating("term", {});
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/terms/term/milestone-dating-preview",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({}),
    }),
  );
  await redesignApi.applyMilestoneDating("term", {
    previewToken: "token",
  });
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/terms/term/milestone-dating-apply",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ previewToken: "token" }),
    }),
  );
});

import { CANONICAL_ROUTES } from "./redesign-contract";
it("registers each milestone dating route exactly once", () => {
  expect(
    CANONICAL_ROUTES.filter(
      (route) => route === "/api/terms/[id]/milestone-dating-preview",
    ),
  ).toHaveLength(1);
  expect(
    CANONICAL_ROUTES.filter(
      (route) => route === "/api/terms/[id]/milestone-dating-apply",
    ),
  ).toHaveLength(1);
});
