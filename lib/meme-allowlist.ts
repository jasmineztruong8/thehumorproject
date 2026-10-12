// The only memegen.link templates people can search for and add. memegen has
// ~200 templates and some aren't appropriate, so nothing outside this list is
// ever shown. To remove one, delete its id; to add one, find its id at
// https://api.memegen.link/templates and check the picture first.
export const APPROVED_MEME_IDS: readonly string[] = [
  "drake", "db", "ds", "fine", "gru", "pigeon", "woman-cat", "spongebob",
  "buzz", "rollsafe", "both", "harold", "success", "fry", "mordor", "wonka",
  "morpheus", "stonks", "panik-kalm-panik", "midwit", "kermit", "handshake",
  "right", "exit", "gb", "michael-scott", "leo",
  "khaby-lame", "drowning", "cheems", "doge", "disastergirl", "pooh", "winter",
  "spiderman", "patrick", "money",
];

export function isApprovedMeme(id: string) {
  return APPROVED_MEME_IDS.includes(id);
}
