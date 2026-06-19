"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Plus, Trophy, User } from "lucide-react";
import clsx from "clsx";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Search },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app border-t border-loop-line bg-loop-ink/95 backdrop-blur">
      <div className="grid grid-cols-5 items-center px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {ITEMS.slice(0, 2).map((item) => (
          <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}

        {/* Center add button */}
        <div className="flex justify-center">
          <Link
            href="/add"
            aria-label="Add route"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-loop-green text-black shadow-lg shadow-loop-green/30 transition active:scale-95"
          >
            <Plus className="h-7 w-7" strokeWidth={2.5} />
          </Link>
        </div>

        {ITEMS.slice(2).map((item) => (
          <NavLink key={item.href} {...item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex flex-col items-center gap-1 py-1 text-[11px] font-medium transition",
        active ? "text-loop-green" : "text-loop-muted hover:text-zinc-300"
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
