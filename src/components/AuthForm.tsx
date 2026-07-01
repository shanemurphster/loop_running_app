"use client";

import { useState } from "react";
import { Mail, Lock, Check } from "lucide-react";
import { useStore } from "@/lib/store";

// Shared auth form: email + password (sign in / create account), an
// email-code option, and guest. Used by the AuthPrompt sheet and /login.
export function AuthForm({ onDone }: { onDone?: () => void }) {
  const {
    signInWithPassword,
    signUpWithPassword,
    confirmSignupCode,
    signInWithEmail,
    verifyEmailCode,
    signInAsGuest,
  } = useStore();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"form" | "code" | "confirm">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const emailOk = /^\S+@\S+\.\S+$/.test(email);

  async function submitPassword() {
    setError("");
    if (!emailOk) return setError("Enter a valid email");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setBusy(true);
    if (mode === "signup") {
      const { error, needsConfirm } = await signUpWithPassword(email.trim(), password);
      setBusy(false);
      if (error) return setError(error);
      if (needsConfirm) return setPhase("confirm");
      onDone?.();
    } else {
      const { error } = await signInWithPassword(email.trim(), password);
      setBusy(false);
      if (error) return setError(error);
      onDone?.();
    }
  }

  async function sendCode() {
    setError("");
    if (!emailOk) return setError("Enter a valid email");
    setBusy(true);
    const { error } = await signInWithEmail(email.trim());
    setBusy(false);
    if (error) return setError(error);
    setPhase("code");
  }

  async function verify() {
    setError("");
    setBusy(true);
    const { error } = await verifyEmailCode(email.trim(), code);
    setBusy(false);
    if (error) return setError(error);
    onDone?.();
  }

  async function confirmSignup() {
    setError("");
    setBusy(true);
    const { error } = await confirmSignupCode(email.trim(), code);
    setBusy(false);
    if (error) return setError(error);
    onDone?.();
  }

  if (phase === "confirm") {
    return (
      <div className="rounded-2xl border border-loop-green/40 bg-loop-green/10 p-5 text-center">
        <Check className="mx-auto mb-2 h-6 w-6 text-loop-green" />
        <p className="font-semibold">Confirm your email</p>
        <p className="mb-3 text-sm text-loop-muted">
          We sent a confirmation link and a code to {email}. Click the link, or
          enter the code below:
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          placeholder="123456"
          className="w-full rounded-xl border border-loop-line bg-loop-panel2 p-3 text-center text-lg tracking-widest outline-none placeholder:text-loop-muted focus:border-loop-muted"
        />
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        <button
          onClick={confirmSignup}
          disabled={busy || code.length < 4}
          className="mt-3 w-full rounded-xl bg-loop-green py-3 font-bold text-black disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Verify code"}
        </button>
      </div>
    );
  }

  if (phase === "code") {
    return (
      <div>
        <p className="mb-3 text-sm text-loop-muted">
          We emailed a sign-in code (and link) to {email}. Enter the code:
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          placeholder="123456"
          className="w-full rounded-xl border border-loop-line bg-loop-panel2 p-3 text-center text-lg tracking-widest outline-none placeholder:text-loop-muted focus:border-loop-muted"
        />
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        <button
          onClick={verify}
          disabled={busy || code.length < 4}
          className="mt-3 w-full rounded-xl bg-loop-green py-3 font-bold text-black disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Verify code"}
        </button>
        <button
          onClick={() => {
            setPhase("form");
            setCode("");
            setError("");
          }}
          className="mt-3 w-full text-center text-sm text-loop-muted"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-loop-line bg-loop-panel2 px-3">
        <Mail className="h-4 w-4 text-loop-muted" />
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-loop-muted"
        />
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-loop-line bg-loop-panel2 px-3">
        <Lock className="h-4 w-4 text-loop-muted" />
        <input
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-loop-muted"
        />
      </div>

      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

      <button
        onClick={submitPassword}
        disabled={busy}
        className="mt-3 w-full rounded-xl bg-loop-green py-3 font-bold text-black transition active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>

      <button
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError("");
        }}
        className="mt-3 w-full text-center text-sm text-loop-muted"
      >
        {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-loop-muted">
        <div className="h-px flex-1 bg-loop-line" /> or <div className="h-px flex-1 bg-loop-line" />
      </div>

      <button
        onClick={sendCode}
        disabled={busy}
        className="w-full rounded-xl border border-loop-line bg-loop-panel2 py-3 text-sm font-semibold text-zinc-200"
      >
        Email me a sign-in code
      </button>
      <button
        onClick={async () => {
          await signInAsGuest();
          onDone?.();
        }}
        className="mt-2 w-full py-2 text-center text-sm text-loop-muted"
      >
        Continue as guest
      </button>
    </div>
  );
}
