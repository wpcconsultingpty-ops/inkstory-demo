import Link from "next/link";

export const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61594325640339";

export function EarlyAccessLink({ className = "btn-primary" }: { className?: string }) {
  return <a className={className} href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer">Ask about early access<span className="sr-only"> on Facebook (opens a new tab)</span></a>;
}

export function PilotLinks() {
  return (
    <nav aria-label="Pilot information" className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-muted print:hidden">
      <Link className="py-3 hover:text-white" href="/privacy">Privacy & data</Link>
      <Link className="py-3 hover:text-white" href="/pilot">Pilot scope</Link>
      <a className="py-3 hover:text-white" href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer">Contact on Facebook<span className="sr-only"> (opens a new tab)</span></a>
    </nav>
  );
}
