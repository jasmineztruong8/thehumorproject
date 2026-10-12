"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { SunOrMoon } from "@/components/pixel-icon";

// What the sidekick says on each page. The first match wins.
// "{tonight}" reads "Today" from the sun and "Tonight" from the moon.
const LINES: [prefix: string, lines: string[]][] = [
  ["/submit", [
    "Ooh, new material. The writers' room is warming up.",
    "Blurry is fine. Blurry is a comedic choice.",
    "No pressure, but this photo could change everything.",
  ]],
  ["/images/", [
    "Think you can beat the top caption? Hit generate.",
    "Give the AI a topic. It loves a prompt.",
    "If it flops, we blame the AI. That's the deal.",
  ]],
  ["/memes", [
    "A classic template never goes out of style.",
    "Pick one. I'll pretend I haven't seen it a thousand times.",
  ]],
  ["/my", [
    "Ah, your greatest hits.",
    "Every legend has an early catalog.",
  ]],
  ["/profile", [
    "Looking good. I assume. I'm sixteen pixels wide.",
    "A photo helps people know who's joking.",
  ]],
  ["/onboarding", ["A name! Every comedian needs one."]],
  ["/login", ["Members upload, caption and vote. I just float here."]],
  ["/admin", ["With great power comes great moderation."]],
  ["/privacy", ["The fine print. Riveting stuff."]],
  ["/", [
    "Welcome to the show. {tonight}'s guests: your camera roll.",
    "Vote wisely. Comedy careers hang in the balance.",
    "Got a weird photo? Upload it. I'll wait.",
  ]],
];

function linesFor(pathname: string) {
  const match = LINES.find(([prefix]) => (prefix === "/" ? true : pathname.startsWith(prefix)));
  return match ? match[1] : LINES[LINES.length - 1][1];
}

// A pixel sun (light mode) or moon (dark mode) in the empty bottom-left
// corner that comments on the page you're on. Click it for another line;
// the ✕ closes the speech bubble until you click the character again.
// Only shown on wide screens, where the margin is empty.
export function Sidekick() {
  const pathname = usePathname();
  const [quiet, setQuiet] = useState(false);

  return (
    <aside className="hidden xl:flex fixed bottom-4 left-4 z-10 flex-col items-start gap-2 pointer-events-none">
      {/* Keyed by page so each page starts on its first line */}
      <Chatter key={pathname} lines={linesFor(pathname)} quiet={quiet} setQuiet={setQuiet} />
    </aside>
  );
}

function Chatter({
  lines,
  quiet,
  setQuiet,
}: {
  lines: string[];
  quiet: boolean;
  setQuiet: (quiet: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [before, after] = lines[index % lines.length].split("{tonight}");

  // Clicking the character reopens a closed bubble, otherwise moves to the next line
  function talk() {
    if (quiet) setQuiet(false);
    else setIndex(index + 1);
  }

  return (
    <>
      {/* Never wider than the empty margin beside the 42rem page column */}
      {!quiet && (
        <div
          className="panel pointer-events-auto p-3 pr-6 relative"
          style={{ maxWidth: "min(13rem, calc((100vw - 42rem) / 2 - 2rem))" }}
        >
          <p aria-live="polite">
            {before}
            {after !== undefined && (
              <>
                <span className="dark:hidden">Today</span>
                <span className="hidden dark:inline">Tonight</span>
                {after}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setQuiet(true)}
            aria-label="Close the speech bubble"
            className="absolute top-1 right-1.5 text-xs text-dim hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={talk}
        aria-label={quiet ? "Say something" : "Say something else"}
        className="pointer-events-auto ml-2 cursor-pointer transition-transform hover:-translate-y-1"
      >
        <SunOrMoon size={80} />
      </button>
    </>
  );
}
