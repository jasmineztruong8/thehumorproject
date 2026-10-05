// memegen.link: an open-source (MIT) collection of ~200 blank meme templates,
// some with animated GIF versions. Free, no API key.

const API = "https://api.memegen.link/templates";

export type MemeTemplate = {
  id: string;
  name: string;
  thumbnail: string; // still image, quick to load in search results
  url: string; // what gets added: the animated GIF when there is one
  isGif: boolean;
  attribution: string;
};

type Raw = { id: string; name: string; blank: string; styles: string[]; keywords: string[] };

function toTemplate(t: Raw): MemeTemplate {
  const isGif = t.styles.includes("animated");
  return {
    id: t.id,
    name: t.name,
    thumbnail: t.blank,
    url: isGif ? t.blank.replace(/\.\w+$/, ".gif") : t.blank,
    isGif,
    attribution: "Meme template via memegen.link (open source)",
  };
}

export async function getMemeTemplates() {
  // The list rarely changes, so let Next cache it for a day
  const res = await fetch(API, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`memegen failed: ${res.status}`);
  return ((await res.json()) as Raw[]).map((t) => ({ raw: t, template: toTemplate(t) }));
}

// Matches the template's name, id and keywords (e.g. "office" finds Michael
// Scott). Memegen's own filter only matches names.
export function matchesQuery(t: Pick<Raw, "id" | "name" | "keywords">, query: string) {
  const haystack = [t.id, t.name, ...t.keywords].join(" ").toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export async function searchMemeTemplates(query: string, gifsOnly: boolean) {
  const all = await getMemeTemplates();
  return all
    .filter(({ raw, template }) => (!gifsOnly || template.isGif) && matchesQuery(raw, query))
    .map(({ template }) => template)
    .slice(0, 24);
}

// Looked up on the server, so users can only add real templates.
export async function getMemeTemplate(id: string) {
  const all = await getMemeTemplates();
  return all.find(({ template }) => template.id === id)?.template ?? null;
}
