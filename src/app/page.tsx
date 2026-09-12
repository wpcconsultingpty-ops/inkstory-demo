import Link from "next/link";
import { EarlyAccessLink, PilotLinks } from "@/components/PilotLinks";
import ExampleLayout from "@/components/ExampleLayout";

export default function Landing() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <Link href="/" className="flex items-center gap-2 py-2"><Logo /><span className="font-display text-2xl">InkStory</span></Link>
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-5 text-sm text-ink-muted">
          <Link className="py-3 hover:text-white" href="/pilot">About the pilot</Link>
          <Link className="py-3 hover:text-white" href="/auth/login">Account sign-in</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-8 md:grid-cols-[1.35fr_1fr] md:items-center md:pb-24 md:pt-16">
        <div>
          <span className="pill">Early-access preview · Tattoo planning</span>
          <h1 className="mt-6 font-display text-4xl leading-[1.08] md:text-6xl">Your tattoo starts<br />with a <em className="not-italic text-accent">story</em>.</h1>
          <p className="mt-6 max-w-xl text-lg text-ink-muted">Make space for the meaning before the ink. Capture your ideas in a discussion brief, explore example layouts, and take better questions to your tattoo artist.</p>
          <div className="mt-8 flex flex-wrap gap-3"><EarlyAccessLink /><Link href="/demo/sample" className="btn-ghost">Explore sample brief</Link></div>
          <p className="mt-5 max-w-xl text-sm text-ink-muted">A planning tool, not a tattoo design service. The public demo has no AI generation or checkout. Account image generation is invitation-only and subject to pilot quotas.</p>
        </div>
        <aside className="card" aria-labelledby="sample-title">
          <div className="flex flex-wrap items-center justify-between gap-3"><span className="pill">A look inside</span><span className="text-xs text-ink-muted">Fictional sample</span></div>
          <h2 id="sample-title" className="mt-5 font-display text-2xl">A little room to explore.</h2>
          <p className="mt-3 text-sm text-ink-muted">“A reminder to keep exploring and to make time for the outdoors.”</p>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4">
            <div className="overflow-hidden rounded-xl border border-ink-ring"><ExampleLayout index={0} /></div>
            <div className="text-sm">
              <p className="font-medium">Quiet focal point</p>
              <p className="mt-2 text-ink-muted">What matters most? What could you leave out?</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink-muted">Abstract example diagram — not a personalised tattoo concept.</p>
        </aside>
      </section>

      <section className="mx-auto max-w-6xl border-t border-ink-ring px-6 py-14 md:py-20" aria-labelledby="how-title">
        <div className="grid gap-8 md:grid-cols-[1fr_1.5fr]">
          <div>
            <span className="text-sm text-accent">From an idea to a conversation</span>
            <h2 id="how-title" className="mt-3 font-display text-3xl">Begin with the brief.</h2>
            <p className="mt-4 text-sm text-ink-muted">No sign-in is needed to try the local planning flow. Use a general story, not sensitive personal details.</p>
            <Link href="/demo/brief" className="btn-ghost mt-6">Write a local brief</Link>
          </div>
          <ol className="divide-y divide-ink-ring">
            {[
              ["01", "Capture what matters", "Five short steps cover meaning, placement, size, style, palette, key elements and notes."],
              ["02", "Compare example layouts", "Three fixed abstract diagrams help you discuss space, balance and flow. They do not interpret your story or generate artwork."],
              ["03", "Bring your questions", "Print or save a text-only brief as PDF using your browser, or download a text file. Your artist decides what will work on skin."],
            ].map(([number, title, text]) => (
              <li key={number} className="flex gap-5 py-6 first:pt-0">
                <span className="pt-1 text-sm text-accent">{number}</span>
                <div><h3 className="text-lg font-medium">{title}</h3><p className="mt-2 text-sm text-ink-muted">{text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16" aria-labelledby="pilot-title">
        <div className="card grid gap-6 md:grid-cols-[1.5fr_1fr] md:items-center">
          <div>
            <span className="pill">A small, invitation-only account pilot</span>
            <h2 id="pilot-title" className="mt-4 font-display text-3xl">Help shape what comes next.</h2>
            <p className="mt-3 max-w-2xl text-sm text-ink-muted">We’re testing whether a structured brief and AI-assisted references make that first artist conversation more useful. There are no paid sales in this pilot. Generation can be paused and allowances are limited; creating an account does not guarantee access.</p>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end"><EarlyAccessLink /><Link href="/pilot" className="py-3 text-sm text-accent underline">Read the pilot scope</Link></div>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl border-t border-ink-ring px-6 pb-10 pt-2 text-sm text-ink-muted">
        <PilotLinks />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-2"><Logo /><span className="font-display text-2xl">InkStory</span></div><p>© {new Date().getFullYear()} InkStory. A WPC Consulting product.</p></div>
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 18c2-4 4-6 6-6s4 2 6 6" stroke="#c9a26b" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="10.5" r="1.4" fill="#c9a26b" />
    </svg>
  );
}
