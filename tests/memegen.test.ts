import { describe, expect, it } from "vitest";
import { APPROVED_MEME_IDS, isApprovedMeme } from "@/lib/meme-allowlist";
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

describe("approved meme list", () => {
  it("allows a listed template and nothing else", () => {
    expect(isApprovedMeme("drake")).toBe(true);
    expect(isApprovedMeme("not-on-the-list")).toBe(false);
    expect(isApprovedMeme("")).toBe(false);
  });

  it("has no duplicate ids", () => {
    expect(new Set(APPROVED_MEME_IDS).size).toBe(APPROVED_MEME_IDS.length);
  });
});
