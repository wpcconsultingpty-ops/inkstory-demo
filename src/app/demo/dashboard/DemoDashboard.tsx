"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearDemoData, listDemoBriefs, type DemoBrief } from "@/lib/demo";

export default function DemoDashboard() {
  const [briefs, setBriefs] = useState<DemoBrief[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBriefs(listDemoBriefs());
    setReady(true);
  }, []);

  function reset() {
    if (!confirm("Clear all demo briefs from this browser?")) return;
    clearDemoData();
    setBriefs([]);
  }

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-muted hover:text-white">← InkStory</Link>
        <button className="text-sm text-ink-muted hover:text-white" onClick={reset}>
          Clear demo data
        </button>
      </header>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Your demo briefs</h1>
          <p className="mt-1 text-sm text-ink-muted">Demo mode — stored in this browser only.</p>
        </div>
        <Link href="/demo/brief" className="btn-primary">Start a new brief</Link>
      </div>

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
            className="card flex items-center justify-between hover:border-white/40"
          >
            <div>
              <div className="font-display text-lg">
                {b.style ? `${b.style}` : "Untitled brief"}
                {b.placement ? ` · ${b.placement}` : ""}
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                {b.meaning?.slice(0, 100) || "No meaning captured yet"}
              </div>
            </div>
            <span className="pill capitalize">{b.status.replace("_", " ")}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
