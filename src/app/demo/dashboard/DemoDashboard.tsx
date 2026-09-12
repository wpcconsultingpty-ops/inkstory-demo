"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearDemoData, listDemoBriefs, type DemoBrief } from "@/lib/demo";
import DemoStorageNotice from "@/components/DemoStorageNotice";
import { PilotLinks } from "@/components/PilotLinks";

export default function DemoDashboard() {
  const [briefs, setBriefs] = useState<DemoBrief[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setBriefs(listDemoBriefs());
    setReady(true);
  }, []);

  function reset() {
    if (!confirm("Clear all demo briefs from this browser?")) return;
    const cleared = clearDemoData();
    setBriefs([]);
    setRevision((value) => value + 1);
    setMessage(cleared ? "Demo data removed from this browser. Account data and downloaded exports are unchanged." : "In-memory demo data cleared. Browser storage is blocked, so we could not confirm removal of any older saved copies. Use your browser’s site-data controls to clear them.");
  }

  if (!ready) return <main className="mx-auto max-w-4xl px-6 py-10"><p role="status">Opening local briefs…</p></main>;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-ink-muted hover:text-white">← InkStory</Link>
        <button className="btn-ghost" onClick={reset}>
          Clear demo data
        </button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Your local briefs</h1>
          <p className="mt-1 text-sm text-ink-muted">Planning notes and example layouts. No AI generation or account sync.</p>
        </div>
        <Link href="/demo/brief" className="btn-primary">Start a new brief</Link>
      </div>
      <DemoStorageNotice revision={revision} />
      {message && <p role="status" className="mt-4 text-sm text-accent-soft">{message}</p>}

      <div className="mt-8 space-y-3">
        {briefs.length === 0 && (
          <div className="card text-sm text-ink-muted">
            No demo briefs yet. <Link className="text-accent" href="/demo/brief">Start your first story →</Link>
          </div>
        )}
        {briefs.map((b) => (
          <Link
            key={b.id}
            href={b.status === "draft" ? `/demo/brief?id=${b.id}` : `/demo/concepts/${b.id}`}
            className="card flex flex-wrap items-center justify-between gap-4 hover:border-white/40"
          >
            <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
              <div className="font-display text-lg">
                {b.style ? `${b.style}` : "Untitled brief"}
                {b.placement ? ` · ${b.placement}` : ""}
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                {b.meaning?.slice(0, 100) || "No meaning captured yet"}
              </div>
            </div>
            <span className="pill">{b.status === "reviewed" ? "Reviewed" : "Draft"}</span>
          </Link>
        ))}
      </div>
      <PilotLinks />
    </main>
  );
}
