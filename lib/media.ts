import "server-only";
import sharp from "sharp";

export type ModelImage = { data: Buffer; mimeType: string };

const GIF_FRAMES = 4;
const FRAME_SIZE = 512;

// What Gemini gets to look at. It only sees the first frame of a GIF, so for
// animated GIFs send a few evenly spaced frames, in order, instead.
export async function framesForModel(data: Buffer, mimeType: string) {
  if (mimeType !== "image/gif") return { images: [{ data, mimeType }], animated: false };

  const pages = (await sharp(data).metadata()).pages ?? 1;
  if (pages < 2) return { images: [{ data, mimeType }], animated: false };

  const picks = [...new Set(
    Array.from({ length: GIF_FRAMES }, (_, i) => Math.round((i * (pages - 1)) / (GIF_FRAMES - 1))),
  )];
  const images = await Promise.all(
    picks.map(async (page) => ({
      data: await sharp(data, { page })
        .resize(FRAME_SIZE, FRAME_SIZE, { fit: "inside" })
        .jpeg({ quality: 80 })
        .toBuffer(),
      mimeType: "image/jpeg",
    })),
  );
  return { images, animated: true };
}

// Library images come from other sites at any size; shrink big stills to
// match what the upload form does in the browser. GIFs are kept as-is so they
// stay animated.
export async function normalizeStill(data: Buffer) {
  return sharp(data)
    .rotate()
    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}
