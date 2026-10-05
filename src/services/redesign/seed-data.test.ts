import { describe, expect, it } from "vitest";
import { seedId } from "../../../prisma/seed-data";

describe("default seed identifiers", () => {
  it("uses stable distinct UUIDs for each demo row", () => {
    expect(seedId("term")).toBe(seedId("term"));
    expect(seedId("term")).not.toBe(seedId("course"));
    expect(seedId("term")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
