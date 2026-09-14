import type { Metadata } from "next";
import Link from "next/link";
import { EarlyAccessLink, PilotLinks } from "@/components/PilotLinks";

export const metadata: Metadata = {
  title: "Pilot scope | InkStory",
  description: "How InkStory's one lifetime free generation attempt works, shared service limits and manual review of failures.",
};

export default function PilotPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="btn-ghost">← InkStory</Link>
      <p className="mt-8 text-sm text-accent">Early access, clearly explained</p>
      <h1 className="mt-3 font-display text-3xl">What this pilot is — and isn’t.</h1>
      <p className="mt-5 text-ink-muted">InkStory is testing a way to turn a tattoo idea into a better conversation with an artist. This page explains the current pilot scope; it is not a checkout agreement or a set of legal terms.</p>
      <div className="mt-10 space-y-10 text-sm leading-relaxed">
        <section>
          <h2 className="font-display text-2xl">You can try the planning flow now</h2>
          <p className="mt-3 text-ink-muted">Explore a fictional sample, capture a local brief through five steps, compare three abstract example layouts, and export your notes. The diagrams are fixed examples, not personalised tattoo concepts. The browser’s print function can save a real, text-only PDF where supported; a plain text download is also available. Neither export includes artwork.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link href="/demo/sample" className="btn-primary">Explore sample brief</Link><Link href="/demo/brief" className="btn-ghost">Write a local brief</Link></div>
        </section>
        <section>
          <h2 className="font-display text-2xl">One lifetime free generation attempt</h2>
          <p className="mt-3 text-ink-muted">When public generation is enabled, a verified email account without a revoked or expired membership can reserve one lifetime free generation attempt. This is one attempt across the account’s entire history: not one per brief, direction, day or device. Previous generation attempts and saved artwork count. Signing up, saving a brief and reviewing directions do not use it.</p>
          <p className="mt-3 text-ink-muted">Each image requires explicit confirmation. Once a generation is reserved, the attempt is permanently used, including provider failures, save failures, timeouts, abandoned requests and expired reservations. There are no retries, refunds of attempts or automatic replacements. Refresh to check for a saved result, not to request again. Contact InkStory on Facebook for manual review of a failure; another attempt or successful result is not promised.</p>
          <p className="mt-3 text-ink-muted">The existing active allowlisted owner allowance remains 10 attempts per rolling 24 hours, not a public entitlement. Expired or revoked memberships do not fall back to the public allowance. The shared service limit remains 12 attempts per rolling 24 hours across everyone, including failed attempts. Your account shows current allowance and availability; all limits are checked again at reservation. Generation can be paused, and no generation time or continuous availability is promised.</p>
          <p className="mt-3 text-ink-muted">Participants can download their own available pilot images. Generation and replacement may fail; existing images are not intentionally removed by starting a replacement request.</p>
          <Link href="/auth/login?next=/brief" className="btn-primary mt-5">Sign up with email</Link>
        </section>
        <section>
          <h2 className="font-display text-2xl">No sales or payment collection</h2>
          <p className="mt-3 text-ink-muted">This is a free early-access pilot, not a live paid product launch. The site has no active checkout, paid concept pack or purchase requirement for pilot image downloads. Asking about early access does not create a purchase or guarantee an invitation.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Your artist makes the design decisions</h2>
          <p className="mt-3 text-ink-muted">Briefs and AI-assisted images are discussion references, not final tattoo artwork, stencils, medical advice or professional approval. A qualified artist must assess anatomy, placement, scale, line weight, cultural context and how the work will age. AI can miss instructions or produce unsuitable details; originality or exclusivity is not guaranteed.</p>
          <p className="mt-3 text-ink-muted">Do not copy another artist’s design or use references you do not have permission to share. Avoid sensitive personal information. Read the <Link href="/privacy" className="text-accent underline">privacy and data-handling explanation</Link> before using an account or requesting generation.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Questions and feedback</h2>
          <p className="mt-3 text-ink-muted">Contact InkStory on Facebook to ask about pilot access, report a problem or share feedback. Start with a general description, not sensitive personal details. Response times and invitations are not guaranteed.</p>
          <div className="mt-5"><EarlyAccessLink /></div>
        </section>
      </div>
      <PilotLinks />
    </main>
  );
}
