import { describe, expect, it } from "vitest";
import { createAuthorLabeler } from "@/lib/display-name";

const alice = { first_name: "Alice", last_name: "Smith" };

describe("author labels", () => {
  it("shows first name and last initial to members", () => {
    expect(createAuthorLabeler(true)("a", alice)).toBe("Alice S.");
  });

  it("numbers authors anon1, anon2, ... for signed-out visitors", () => {
    const label = createAuthorLabeler(false);
    expect(label("a", null)).toBe("anon1");
    expect(label("b", null)).toBe("anon2");
    expect(label("a", null)).toBe("anon1"); // same person, same label on a page
  });

  it("never shows a name to signed-out visitors, even if one is passed", () => {
    expect(createAuthorLabeler(false)("a", alice)).toBe("anon1");
  });

  it("starts numbering over on each page", () => {
    createAuthorLabeler(false)("a", null);
    expect(createAuthorLabeler(false)("b", null)).toBe("anon1");
  });

  it("has no label for images without an uploader", () => {
    expect(createAuthorLabeler(true)(null, null)).toBeNull();
  });
});
