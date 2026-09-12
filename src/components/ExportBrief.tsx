"use client";

import { useState } from "react";
import { downloadBriefText, printBrief, type BriefExport } from "@/lib/export-brief";

export default function ExportBrief(props: BriefExport) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function exportAs(format: "print" | "text") {
    setError("");
    setMessage("");
    try {
      if (format === "print") {
        printBrief(props);
        setMessage("Print dialog requested. Choose “Save as PDF” where your browser supports it. No artwork is included. If no dialog opens in this preview, open InkStory in a full browser tab or download the text brief.");
      } else {
        downloadBriefText(props);
        setMessage("Text download requested. If your browser blocks downloads in this preview, open InkStory in a full browser tab.");
      }
    } catch {
      setError("This browser could not open the export. Try the text download, or open InkStory in a full browser tab and try again.");
    }
  }
  return (
    <section className="card mt-8" aria-labelledby="export-title">
      <h2 id="export-title" className="font-display text-2xl">Take the conversation with you</h2>
      <p className="mt-2 text-sm text-ink-muted">Export all your captured fields and discussion notes. Text only: not an artwork pack or a tattoo-ready design. Review your brief before sharing it.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={() => exportAs("print")}>Print / save brief as PDF (text only)</button>
        <button type="button" className="btn-ghost" onClick={() => exportAs("text")}>Download text brief (.txt)</button>
      </div>
      {message && <p role="status" className="mt-3 text-sm text-ink-muted">{message}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
    </section>
  );
}
