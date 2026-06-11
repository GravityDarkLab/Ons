import { describe, expect, it } from "bun:test";
import { parseAllowedOrigins } from "../../config/env.js";

describe("parseAllowedOrigins", () => {
  it("accepts comma and semicolon separated origins", () => {
    expect(
      parseAllowedOrigins(
        "http://localhost:3000,http://localhost:5173,http://localhost:5174;http://localhost:3001"
      )
    ).toEqual([
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3001",
    ]);
  });

  it("trims whitespace and trailing slashes", () => {
    expect(
      parseAllowedOrigins(" http://localhost:5174/ ; http://localhost:3001// ")
    ).toEqual(["http://localhost:5174", "http://localhost:3001"]);
  });
});
