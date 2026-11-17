import { expect, it, vi } from "vitest";
import { readJsonBody } from "./request-json";
it("rejects oversized bodies with and without Content-Length before parsing", async () => {
  for (const headers of [new Headers(), new Headers({ "content-length": "9" })]) {
    const request = new Request("http://localhost", { method: "POST", body: '"éééé"', headers });
    const result = await readJsonBody(request, 8);
    expect(result.response?.status).toBe(413);
  }
});
it("does not read a body whose declared length exceeds the limit", async () => {
  const request = new Request("http://localhost", { method: "POST", body: "{}", headers: { "content-length": "100" } });
  const read = vi.spyOn(request.body!, "getReader");
  expect((await readJsonBody(request, 10)).response?.status).toBe(413);
  expect(read).not.toHaveBeenCalled();
});
it("accepts a body at the exact byte limit", async () => {
  expect(await readJsonBody(new Request("http://localhost", { method: "POST", body: '"é"' }), 4)).toEqual({ data: "é" });
});
it("returns the same malformed JSON error for bounded reads", async () => {
  const result = await readJsonBody(new Request("http://localhost", { method: "POST", body: "{" }), 100);
  expect(result.response?.status).toBe(400);
  expect(await result.response?.json()).toEqual({ error: "The request body is not valid JSON." });
});
