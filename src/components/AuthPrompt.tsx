"use client";

import { X } from "lucide-react";
import { useStore } from "@/lib/store";
import { AuthForm } from "./AuthForm";

// Global sign-in sheet. Opens whenever a guest tries to interact.
export function AuthPrompt() {
  const { authPromptOpen, closeAuthPrompt } = useStore();
  if (!authPromptOpen) return null;

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
        <AuthForm onDone={closeAuthPrompt} />
      </div>
    </div>
  );
}
