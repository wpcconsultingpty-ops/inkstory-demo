"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegenerateButton({ briefId }: { briefId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief_id: briefId })
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <button className="btn-ghost" onClick={go} disabled={busy}>
      {busy ? "Resetting…" : "Regenerate concepts"}
    </button>
  );
}
