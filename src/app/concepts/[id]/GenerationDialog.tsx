"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

/** Native modal gives Escape handling and inert background; cleanup also runs on route changes. */
export default function GenerationDialog({ titleId, descriptionId, onClose, children, wide = false }: {
  titleId: string;
  descriptionId: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    dialog.querySelector<HTMLElement>("[data-dialog-focus]")?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), summary, [tabindex='0']")]
      .filter((control) => control.getClientRects().length > 0 && getComputedStyle(control).visibility !== "hidden");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return (
    <dialog
      ref={dialogRef}
      className="gallery-dialog"
      style={{ width: wide ? "min(1200px, calc(100% - 32px))" : "min(680px, calc(100% - 32px))" }}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={containTab}
    >{children}</dialog>
  );
}
