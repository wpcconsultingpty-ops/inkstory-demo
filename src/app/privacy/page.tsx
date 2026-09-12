import type { Metadata } from "next";
import Link from "next/link";
import { EarlyAccessLink, PilotLinks } from "@/components/PilotLinks";

export const metadata: Metadata = {
  title: "Privacy & data handling | InkStory",
  description: "How the InkStory pilot handles local demo notes, account storage and AI image requests.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link className="btn-ghost" href="/">← InkStory</Link>
      <p className="mt-8 text-sm text-accent">Early-access pilot · Operational transparency</p>
      <h1 className="mt-3 font-display text-3xl">Privacy & data handling</h1>
      <p className="mt-5 text-ink-muted">Tattoo stories can be personal. Keep your brief general: do not enter medical details, identity documents, contact information, intimate experiences or other people’s private information. This pilot is not a confidential record-keeping service.</p>
      <div className="mt-10 space-y-10 text-sm leading-relaxed">
        <section>
          <h2 className="font-display text-2xl">The local demo</h2>
          <p className="mt-3 text-ink-muted">Your demo brief is kept in this browser’s local storage when available. If browser storage is blocked or full, it stays in memory only and is lost when the page is refreshed or closed. The page tells you when it cannot save to browser storage. Changes must be saved with the step controls.</p>
          <p className="mt-3 text-ink-muted">The demo does not send your brief to Supabase or OpenAI and does not generate AI images. Its abstract layout diagrams are fixed examples shown to everyone. The sample brief is fictional. Demo notes are not automatically copied into your account.</p>
          <p className="mt-3 text-ink-muted">Anyone using the same browser profile may be able to view saved demo briefs. Use <Link href="/demo/dashboard" className="text-accent underline">Clear demo data</Link> to remove locally saved demo data, or your browser’s site-data controls if storage access is blocked. Clearing demo data does not remove account data or files you downloaded.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Signed-in account storage</h2>
          <p className="mt-3 text-ink-muted">Supabase provides account authentication, database storage for saved briefs and generated concept records, and storage for account images. Sign-in processes your email and authentication information. Saved briefs contain the fields you submit; generation records can include the prompt and image metadata.</p>
          <p className="mt-3 text-ink-muted">Account image requests use an authenticated InkStory route that checks ownership rather than exposing a public gallery. This is an access control, not a promise of absolute confidentiality or end-to-end encryption. Authorised service operators and the systems providing the service may process account data.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">AI generation in the account pilot</h2>
          <p className="mt-3 text-ink-muted">When you explicitly request a pilot image, the saved story, placement, size, style, palette, elements and notes are used to create a prompt sent to OpenAI. Generation requires an invited account, an available allowance and enabled pilot services. Opening the public demo or a concept page does not itself request images.</p>
          <p className="mt-3 text-ink-muted">OpenAI and Supabase process information under their own service arrangements and policies. Do not assume that content you submit is anonymous or immediately deleted. You can read the <a className="text-accent underline" href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer">OpenAI privacy policy (new tab)</a> and <a className="text-accent underline" href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase privacy policy (new tab)</a>.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Site requests and exported copies</h2>
          <p className="mt-3 text-ink-muted">Loading this site makes normal requests to the hosting service, which can receive network information such as IP address and request details. Fonts may be loaded from Google Fonts. This is distinct from sending the story fields for generation. Account sign-in uses session cookies. Following a Facebook contact link takes you to Facebook, where its own data handling applies.</p>
          <p className="mt-3 text-ink-muted">Brief exports are prepared in your browser. The print/save-to-PDF export is text only; image files are downloaded separately from your account. Copies you save, print or share leave the app’s control. Review them before sending anything to an artist.</p>
        </section>
        <section>
          <h2 className="font-display text-2xl">Retention, removal and questions</h2>
          <p className="mt-3 text-ink-muted">The pilot does not promise a fixed retention period or a guaranteed deletion timeline. There is no self-service account deletion flow here. Ask on Facebook about access to, correction of or removal of account data. Removal from the application may not immediately remove provider logs, backups or copies you have shared.</p>
          <p className="mt-3 text-ink-muted">For a privacy question, start with a general message and the nature of your request. Do not send sensitive story details or passwords through Facebook.</p>
          <div className="mt-5"><EarlyAccessLink /></div>
        </section>
      </div>
      <PilotLinks />
    </main>
  );
}
