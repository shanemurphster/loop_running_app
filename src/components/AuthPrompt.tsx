"use client";

import { useState } from "react";
import { X, Mail, Check } from "lucide-react";
import { useStore } from "@/lib/store";

// Global sign-in sheet. Opens whenever a guest tries to interact (react, save,
// compare, add). Email magic-link is primary; "continue as guest" is secondary.
export function AuthPrompt() {
  const { authPromptOpen, closeAuthPrompt, signInWithEmail, signInAsGuest } =
    useStore();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState("");

  if (!authPromptOpen) return null;

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
    } else {
      setStatus("sent");
    }
  }

  async function guest() {
    const { error } = await signInAsGuest();
    if (error) {
      setError(error);
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={closeAuthPrompt}
      />
      <div className="relative z-10 w-full max-w-app animate-slide-up rounded-t-3xl border-t border-loop-line bg-loop-panel p-5 pb-8">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Join Loop</h2>
            <p className="text-sm text-loop-muted">
              Create a free account to react, save, and add routes.
            </p>
          </div>
          <button
            onClick={closeAuthPrompt}
            className="grid h-8 w-8 place-items-center rounded-full bg-loop-panel2 text-loop-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === "sent" ? (
          <div className="rounded-2xl border border-loop-green/40 bg-loop-green/10 p-4 text-center">
            <Check className="mx-auto mb-2 h-6 w-6 text-loop-green" />
            <p className="font-semibold">Check your email</p>
            <p className="text-sm text-loop-muted">
              We sent a sign-in link to {email}.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-loop-line bg-loop-panel2 px-3 py-3">
              <Mail className="h-4 w-4 text-loop-muted" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
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
              className="mt-3 w-full rounded-xl bg-loop-green py-3 font-bold text-black transition active:scale-[0.98] disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>

            <div className="my-4 flex items-center gap-3 text-xs text-loop-muted">
              <div className="h-px flex-1 bg-loop-line" /> or{" "}
              <div className="h-px flex-1 bg-loop-line" />
            </div>

            <button
              onClick={guest}
              className="w-full rounded-xl border border-loop-line bg-loop-panel2 py-3 font-semibold text-zinc-200"
            >
              Continue as guest
            </button>

            {/* Strava login slots in here once the Strava app is approved. */}
            <p className="mt-3 text-center text-[11px] text-loop-muted">
              Strava sign-in coming soon
            </p>
          </>
        )}
      </div>
    </div>
  );
}
