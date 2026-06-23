"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Check } from "lucide-react";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-loop-muted">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { signInWithEmail, signInAsGuest } = useStore();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    params.get("error") ? "error" : "idle"
  );
  const [error, setError] = useState(
    params.get("error") ? "That sign-in link didn't work — try again." : ""
  );

  async function sendLink() {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email");
      setStatus("error");
      return;
    }
    setStatus("sending");
    const { error } = await signInWithEmail(email.trim());
    if (error) {
      setError(error);
      setStatus("error");
    } else setStatus("sent");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <h1 className="text-4xl font-black tracking-tight text-loop-green">Loop</h1>
      <p className="mb-8 text-loop-muted">Discover your next run</p>

      <div className="w-full max-w-sm">
        {status === "sent" ? (
          <div className="rounded-2xl border border-loop-green/40 bg-loop-green/10 p-5 text-center">
            <Check className="mx-auto mb-2 h-7 w-7 text-loop-green" />
            <p className="font-semibold">Check your email</p>
            <p className="text-sm text-loop-muted">Sign-in link sent to {email}.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-loop-line bg-loop-panel px-3 py-3">
              <Mail className="h-4 w-4 text-loop-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setStatus("idle");
                }}
                placeholder="you@email.com"
                className="w-full bg-transparent text-sm outline-none placeholder:text-loop-muted"
              />
            </div>
            {status === "error" && (
              <p className="mt-2 text-sm text-rose-400">{error}</p>
            )}
            <button
              onClick={sendLink}
              disabled={status === "sending"}
              className="mt-3 w-full rounded-xl bg-loop-green py-3 font-bold text-black disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            <button
              onClick={async () => {
                await signInAsGuest();
                router.push("/");
              }}
              className="mt-3 w-full rounded-xl border border-loop-line bg-loop-panel py-3 font-semibold text-zinc-200"
            >
              Browse as guest
            </button>
          </>
        )}
      </div>
    </div>
  );
}
