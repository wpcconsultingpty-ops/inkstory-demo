"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createSupabaseBrowserClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo }
    });
    if (error) {
      setState("error");
      setMsg(error.message);
    } else {
      setState("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-sm text-ink-muted hover:text-white">← Back</Link>
      <h1 className="font-display text-3xl">Sign in</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Enter your email and we&apos;ll send a one-tap magic link. No password to remember.
      </p>

      {state === "sent" ? (
        <div className="card mt-8">
          <p className="text-sm">
            Check <span className="text-white">{email}</span> for a sign-in link. You can close this tab.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary w-full" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Send magic link"}
          </button>
          {state === "error" && <p className="text-sm text-red-400">{msg}</p>}
        </form>
      )}
    </main>
  );
}
