"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setState("working");
    setMsg("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    });
    if (error) {
      setState("error");
      setMsg(error.message);
    } else {
      setStage("code");
      setState("idle");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setState("working");
    setMsg("");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email"
    });
    if (error) {
      setState("error");
      setMsg(error.message);
    } else {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-sm text-ink-muted hover:text-white">← Back</Link>

      {stage === "email" ? (
        <>
          <h1 className="font-display text-3xl">Sign in</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Enter your email and we&apos;ll send you a one-time code.
          </p>
          <form onSubmit={sendCode} className="mt-8 space-y-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button className="btn-primary w-full" disabled={state === "working"}>
              {state === "working" ? "Sending code…" : "Email me a code"}
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl">Check your email</h1>
          <p className="mt-2 text-sm text-ink-muted">
            We sent a 6-digit code to <span className="text-white">{email}</span>. Enter it below to continue.
          </p>
          <form onSubmit={verifyCode} className="mt-8 space-y-3">
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="123456"
              className="input text-center text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            <button className="btn-primary w-full" disabled={state === "working" || code.length !== 6}>
              {state === "working" ? "Verifying…" : "Continue"}
            </button>
            <button
              type="button"
              className="w-full text-xs text-ink-muted hover:text-white"
              onClick={() => {
                setStage("email");
                setCode("");
                setMsg("");
              }}
            >
              Use a different email
            </button>
          </form>
        </>
      )}

      {state === "error" && msg && <p className="mt-4 text-sm text-red-400">{msg}</p>}
    </main>
  );
}
