"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-loop-muted">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-black tracking-tight text-loop-green">Loop</h1>
      <p className="mb-8 text-loop-muted">Discover your next run</p>
      <div className="w-full max-w-sm">
        <AuthForm onDone={() => router.push("/")} />
      </div>
    </div>
  );
}
