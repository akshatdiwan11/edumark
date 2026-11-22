import { describe, expect, it } from "vitest";
import { distanceMeters } from "../geo.js";

describe("distanceMeters", () => {
  it("is zero for the same point", () => {
    expect(distanceMeters(28.6, 77.2, 28.6, 77.2)).toBe(0);
  });
  it("measures ~111 m per 0.001 degree of latitude", () => {
    expect(distanceMeters(28.6, 77.2, 28.601, 77.2)).toBeCloseTo(111.2, 0);
  });
});
