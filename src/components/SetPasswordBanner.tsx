"use client";

import { useEffect, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { useStore } from "@/lib/store";

// Nudges accounts that authenticated via email-code only (no password ever
// set) to add one, so they're not locked out if they lose access to their
// inbox. Dismissible per browser session — reappears next time the app loads.
export function SetPasswordBanner() {
  const { ready, user, isGuest, passwordSet, setPassword } = useStore();

  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPasswordInput] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) return;
    setDismissed(sessionStorage.getItem(`loop:pw-dismissed:${user.id}`) === "1");
  }, [user]);

  if (!ready || !user || isGuest || passwordSet || dismissed || done) return null;

  function dismiss() {
    if (user) sessionStorage.setItem(`loop:pw-dismissed:${user.id}`, "1");
    setDismissed(true);
  }

  async function submit() {
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirm) return setError("Passwords don't match");
    setBusy(true);
    const { error } = await setPassword(password);
    setBusy(false);
    if (error) return setError(error);
    setDone(true);
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto w-full max-w-app px-3 pt-3">
      <div className="rounded-2xl border border-loop-line bg-loop-panel p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-loop-green/10 text-loop-green">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Add a password to your account</p>
            <p className="mt-0.5 text-xs text-loop-muted">
              You signed in with an email code. Set a password so you can sign
              in even if you can't check that inbox.
            </p>
          </div>
          <button
            aria-label="Dismiss"
            onClick={dismiss}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-loop-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {open ? (
          <div className="mt-3">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-loop-line bg-loop-panel2 p-3 text-sm outline-none placeholder:text-loop-muted focus:border-loop-muted"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="mt-2 w-full rounded-xl border border-loop-line bg-loop-panel2 p-3 text-sm outline-none placeholder:text-loop-muted focus:border-loop-muted"
            />
            {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
            <button
              onClick={submit}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-loop-green py-2.5 text-sm font-bold text-black disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save password"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="mt-3 w-full rounded-xl border border-loop-line bg-loop-panel2 py-2.5 text-sm font-semibold text-zinc-200"
          >
            Set password
          </button>
        )}
      </div>
    </div>
  );
}
