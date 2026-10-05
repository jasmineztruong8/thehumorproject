// Feature switches. The meme library (/memes, template search, library
// images in the feed) is built but turned off until its content is
// moderated. Set ENABLE_MEME_LIBRARY=true in the environment to turn it on.
export const MEME_LIBRARY_ENABLED = process.env.ENABLE_MEME_LIBRARY === "true";
