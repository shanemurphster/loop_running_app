"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { Avatar } from "./Avatar";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const { currentUser } = useStore();
  return (
    <header className="flex items-end justify-between px-4 pb-3 pt-5">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-loop-green">
          Loop
        </h1>
        {subtitle && <p className="text-sm text-loop-muted">{subtitle}</p>}
      </div>
      <Link href="/profile">
        <Avatar user={currentUser} size={40} />
      </Link>
    </header>
  );
}
