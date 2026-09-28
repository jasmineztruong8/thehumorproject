import Image from "next/image";

type Props = {
  url: string | null;
  firstName: string | null;
  lastName: string | null;
  size: number;
};

// Profile photo, or initials when there isn't one yet.
export function Avatar({ url, firstName, lastName, size }: Props) {
  if (url) {
    return (
      <Image
        src={url}
        alt="Profile photo"
        width={size}
        height={size}
        className="rounded-full object-cover aspect-square"
      />
    );
  }

  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-medium"
    >
      {initials}
    </span>
  );
}
