import { describe, expect, it } from "vitest";
import { matchesQuery } from "@/lib/memegen";

const michael = { id: "michael-scott", name: "Michael Scott No God No", keywords: ["The Office"] };

describe("meme template search", () => {
  it("matches the name, id or keywords, ignoring case", () => {
    expect(matchesQuery(michael, "michael")).toBe(true);
    expect(matchesQuery(michael, "OFFICE")).toBe(true);
    expect(matchesQuery(michael, "scott")).toBe(true);
  });

  it("needs every word to match", () => {
    expect(matchesQuery(michael, "office michael")).toBe(true);
    expect(matchesQuery(michael, "office drake")).toBe(false);
  });

  it("matches everything for an empty search", () => {
    expect(matchesQuery(michael, "  ")).toBe(true);
  });
});
