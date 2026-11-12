"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginForm({ next, domainHint }: { next: string; domainHint?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "google" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function google() {
    setState("google");
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo(),
        queryParams: { prompt: "select_account", ...(domainHint ? { hd: domainHint } : {}) },
      },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    }
  }

  async function magic(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: true },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else setState("sent");
  }

  return (
    <div className="mt-8 flex flex-col gap-5">
      <button type="button" onClick={google} disabled={state === "google"} className="btn h-10 w-full text-[0.875rem]">
        <GoogleIcon />
        {state === "google" ? "Opening Google…" : "Continue with Google"}
      </button>
      <div className="flex items-center gap-3 text-xs text-fog">
        <span className="h-px flex-1 bg-rule" />
        or
        <span className="h-px flex-1 bg-rule" />
      </div>
      {state === "sent" ? (
        <div className="rounded-md border border-rule bg-paper px-3.5 py-3 text-[0.8125rem]">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-graphite">We sent a sign-in link to {email}. Open it on this device.</p>
        </div>
      ) : (
        <form onSubmit={magic} className="flex flex-col gap-2.5">
          <label className="field">
            <span className="label">Work email</span>
            <input
              className="input h-10"
              type="email"
              required
              autoComplete="email"
              placeholder={domainHint ? `name@${domainHint}` : "name@company.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="btn btn-primary h-10 w-full" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>
      )}
      {error ? (
        <p className="text-[0.8125rem] text-brick" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
