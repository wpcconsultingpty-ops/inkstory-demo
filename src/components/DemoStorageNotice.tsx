"use client";

import { useEffect, useState } from "react";
import { getDemoStorageState } from "@/lib/demo";

export default function DemoStorageNotice({ revision = 0, unsaved = false }: { revision?: number; unsaved?: boolean }) {
  const [state, setState] = useState<"checking" | "local" | "memory">("checking");
  useEffect(() => { setState(getDemoStorageState()); }, [revision]);
  return (
    <p role="status" className={`mt-3 text-sm ${state === "memory" ? "text-accent-soft" : "text-ink-muted"}`}>
      {state === "checking" ? "Checking local storage…" : state === "memory"
        ? "Not saved to browser storage. This preview is keeping your brief in memory only; refreshing or closing the page will lose it. Export a copy before leaving."
        : unsaved ? "Unsaved changes. Use Save locally & continue to keep this step in this browser." : "Local demo only. Saved steps stay in this browser, not your account. Anyone using this browser may see them."}
    </p>
  );
}
