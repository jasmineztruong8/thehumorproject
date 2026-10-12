"use client";

import Link from "next/link";
import { PixelIcon } from "@/components/pixel-icon";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

const storageKey = (userId: string) => `profile-nudge-dismissed:${userId}`;

function readDismissed(userId: string) {
  try {
    return localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}

// Called when a user deliberately removes their photo, so we don't nag them.
export function dismissProfileNudge(userId: string) {
  try {
    localStorage.setItem(storageKey(userId), "1");
  } catch {
    // Storage unavailable: the reminder may show again, which is harmless
  }
}

// Corner reminder for signed-in users who haven't added a profile photo yet.
// Dismissing it is remembered in this browser only.
export function ProfileNudge({ userId }: { userId: string }) {
  const pathname = usePathname();
  const storedDismissed = useSyncExternalStore(
    () => () => {},
    () => readDismissed(userId),
    () => true, // hidden during server render, so it never flashes
  );
  const [dismissedNow, setDismissedNow] = useState(false);

  if (storedDismissed || dismissedNow || pathname === "/profile") return null;

  function dismiss() {
    setDismissedNow(true);
    dismissProfileNudge(userId);
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-80 panel p-4 flex gap-3 items-start"
    >
      <span className="text-2xl" aria-hidden>
        <PixelIcon name="camera" size={22} />
      </span>
      <div className="flex-1 text-sm">
        <p className="font-medium">Finish setting up your profile</p>
        <p className="text-dim mb-2">
          Add a photo so people know who&apos;s joking.
        </p>
        <Link href="/profile" className="font-medium underline underline-offset-4">
          Go to profile
        </Link>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-dim hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}
