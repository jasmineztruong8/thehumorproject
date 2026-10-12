import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";

// "Back to the feed" with a left-pointing pixel arrow.
export function BackLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`nav-link self-start text-sm text-dim ${className}`}>
      <PixelIcon name="arrow" size={12} className="-rotate-90" /> Back to the feed
    </Link>
  );
}
