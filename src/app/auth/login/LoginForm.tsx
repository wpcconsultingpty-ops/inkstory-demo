"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { accountConfigured, safeReturnPath } from "@/components/pilot-client";
import AccountUnavailable from "@/components/AccountUnavailable";
import { EarlyAccessLink, PilotLinks } from "@/components/PilotLinks";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeReturnPath(params.get("next"));
  const lock = useRef(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(params.get("error") ? "The sign-in or sign-out request could not be confirmed. Please try again." : "");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createSupabaseBrowserClient();
      const address = email.trim();
      if (stage === "code") {
        const { error } = await supabase.auth.verifyOtp({ email: address, token: code.trim(), type: "email" });
        if (error) { setMessage("That code could not be verified. Check the latest email, or request another code below."); return; }
      } else if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) { setMessage("Sign-in failed. Check your email and password, or use an email code. If requests are limited, wait and try again later."); return; }
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: address,
          options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) { setMessage("We could not send a sign-in email. Check the address, wait before retrying, or ask about account availability on Facebook."); return; }
        setEmail(address);
        setStage("code");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setMessage("Account sign-in is unavailable in this browser or the network request failed. Open InkStory in a full browser tab, or try again later. The local sample does not require an account.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!accountConfigured()) return <AccountUnavailable />;
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className="btn-ghost">← InkStory</Link>
      <span className="pill mt-8">Account pilot</span>
      <h1 className="mt-4 font-display text-3xl">{stage === "code" ? "Check your email" : "Sign up or sign in"}</h1>
      <p className="mt-3 text-sm text-ink-muted">Verify your email to check your one lifetime free generation attempt, available when public generation is enabled and service capacity remains. One attempt across this account, not per brief or direction. Reserved attempts count even if they fail or expire; no retries, with manual review on Facebook only. Active allowlisted accounts keep their separate rolling allowance. Account storage is separate from the local demo.</p>
      {stage === "code" && <p role="status" className="mt-4 break-words text-sm">Sign-in email requested for {email}. Enter its one-time code here, or follow the sign-in link if provided. Check spam if it has not arrived.</p>}
      <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          {stage === "email" ? (
            <>
              <div><label htmlFor="email" className="mb-2 block text-sm">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby="login-help" /></div>
              {mode === "password" && <div><label htmlFor="password" className="mb-2 block text-sm">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(event) => setPassword(event.target.value)} /></div>}
              <p id="login-help" className="text-sm text-ink-muted">{mode === "otp" ? "We’ll request a sign-in email. A new account may be created if this is your first visit." : "Use the password for your existing account."}</p>
            </>
          ) : (
            <div><label htmlFor="code" className="mb-2 block text-sm">One-time email code</label><input id="code" name="code" inputMode="numeric" pattern="[0-9]{6,10}" autoComplete="one-time-code" minLength={6} maxLength={10} required className="input" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></div>
          )}
          <button className="btn-primary w-full" type="submit">{busy ? "Working…" : stage === "code" ? "Verify code & sign in" : mode === "otp" ? "Email me a sign-in code" : "Sign in"}</button>
          <button className="btn-ghost w-full" type="button" onClick={() => {
            if (stage === "code") { setStage("email"); setCode(""); } else { setMode((value) => value === "otp" ? "password" : "otp"); setPassword(""); }
            setMessage("");
          }}>{stage === "code" ? "Request another code or change email" : mode === "otp" ? "Use an existing password" : "Use an email code instead"}</button>
        </fieldset>
      </form>
      {message && <p role="alert" className="mt-5 text-sm text-red-200">{message}</p>}
      <p className="mt-5 text-sm text-ink-muted">Read <Link href="/privacy" className="text-accent underline">privacy & data handling</Link> before saving a personal story.</p>
      <section className="mt-8 border-t border-ink-ring pt-6">
        <h2 className="font-display text-2xl">Just exploring?</h2>
        <p className="mt-2 text-sm text-ink-muted">The public sample contains a fictional brief and fixed abstract layouts. It needs no sign-in and makes no AI requests.</p>
        <div className="mt-4 flex flex-wrap gap-3"><Link href="/demo/sample" className="btn-ghost">Explore sample brief</Link><EarlyAccessLink className="btn-ghost" /></div>
      </section>
      <PilotLinks />
    </main>
  );
}
