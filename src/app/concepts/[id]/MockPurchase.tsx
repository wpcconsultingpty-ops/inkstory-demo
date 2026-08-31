"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MockPurchase({ briefId }: { briefId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true);
    await fetch("/api/purchase", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief_id: briefId })
    });
    router.refresh();
  }
  return (
    <button className="btn-primary mt-4" onClick={pay} disabled={busy}>
      {busy ? "Unlocking…" : "Unlock Concept Pack (mock)"}
    </button>
  );
}
