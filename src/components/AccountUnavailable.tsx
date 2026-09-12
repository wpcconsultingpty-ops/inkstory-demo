import Link from "next/link";
import { PilotLinks } from "./PilotLinks";

export default function AccountUnavailable({ message = "Account services are not configured in this preview. You can still explore the local sample and capture a brief without signing in." }: { message?: string }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="btn-ghost">← InkStory</Link>
      <h1 className="mt-8 font-display text-3xl">Account services unavailable</h1>
      <p role="alert" className="mt-3 text-ink-muted">{message}</p>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/demo/sample" className="btn-primary">Explore sample brief</Link><Link href="/demo/brief" className="btn-ghost">Start a local brief</Link></div>
      <PilotLinks />
    </main>
  );
}
