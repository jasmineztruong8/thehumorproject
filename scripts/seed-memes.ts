// Fills the meme library (images with source = 'library') with recognizable
// templates from memegen.link, an open-source (MIT) collection of blank meme
// templates (animated GIF versions where they exist). Users can add any of
// the other templates themselves from the search on /memes.
//
// Run locally, never on Vercel:   npm run seed:memes
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY
// in .env.local. Safe to re-run: images already in the library are skipped.
import { addToLibrary } from "@/lib/library";
import { getMemeTemplates } from "@/lib/memegen";

// Recognizable templates from https://api.memegen.link/templates
const MEMEGEN_IDS = [
  "drake", "db", "ds", "cmm", "fine", "gru", "pigeon", "woman-cat", "spongebob",
  "buzz", "rollsafe", "both", "harold", "success", "fry", "mordor", "wonka",
  "morpheus", "stonks", "panik-kalm-panik", "midwit", "kermit", "handshake",
  "slap", "right", "astronaut", "exit", "gb", "michael-scott", "leo",
  "khaby-lame", "drowning", "cheems", "doge", "disastergirl", "pooh", "winter",
  "spiderman", "patrick", "money",
];

async function main() {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"]) {
    if (!process.env[name]) throw new Error(`${name} is missing from .env.local`);
  }
  const templates = (await getMemeTemplates())
    .map(({ template }) => template)
    .filter((t) => MEMEGEN_IDS.includes(t.id));
  const items = templates.map((t) => ({
    key: `memegen-${t.id}`,
    title: t.name,
    url: t.url,
    attribution: t.attribution,
  }));
  console.log(`Seeding ${items.length} images…`);
  for (const item of items) {
    try {
      const { added } = await addToLibrary(item, null);
      console.log(`${added ? "added" : "skip "} ${item.title}`);
      // Stay under the Gemini free tier's requests-per-minute limit
      if (added) await new Promise((resolve) => setTimeout(resolve, 4000));
    } catch (e) {
      console.warn(`fail  ${item.title}: ${(e as Error).message}`);
    }
  }
}

main();
