"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// A header link that marks itself as the current page.
export function NavLink({
  href,
  className = "nav-link",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const current = usePathname() === href;
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={className}>
      {children}
    </Link>
  );
}
