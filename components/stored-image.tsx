import Image from "next/image";

// An image from our Storage bucket at its natural aspect ratio.
export function StoredImage({
  src,
  alt,
  className = "",
  sizes = "(max-width: 672px) 100vw, 672px",
}: {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={0}
      height={0}
      sizes={sizes}
      className={`w-full h-auto bg-neutral-100 dark:bg-neutral-900 ${className}`}
    />
  );
}
