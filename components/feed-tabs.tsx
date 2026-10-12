import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";

const TABS = [
  { id: "new", href: "/", text: "New", icon: "sparkle" },
  { id: "top", href: "/?sort=top", text: "Top captions", icon: "trophy" },
  { id: "mine", href: "/my", text: "Mine", icon: "person" },
] as const;

// The tab row shared by the feed (New, Top captions) and the Mine page.
// "Mine" is only offered to signed-in users.
export function FeedTabs({
  active,
  signedIn,
  className = "",
}: {
  active: (typeof TABS)[number]["id"];
  signedIn: boolean;
  className?: string;
}) {
  return (
    <nav className={`flex flex-wrap gap-3 ${className}`}>
      {TABS.filter((tab) => signedIn || tab.id !== "mine").map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={active === tab.id ? "page" : undefined}
          className={`inline-flex items-center gap-2.5 border-2 px-3 py-1.5 text-sm font-medium ${
            active === tab.id ? "tab-on" : "tab-off border-line bg-card"
          }`}
        >
          <PixelIcon name={tab.icon} size={12} />
          {tab.text}
        </Link>
      ))}
    </nav>
  );
}
