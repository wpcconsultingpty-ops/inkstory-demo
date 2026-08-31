import Link from "next/link";

export default function Landing() {
  return (
    <main className="min-h-screen">
      <Nav />
      <Hero />
      <How />
      <Pricing />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="flex items-center gap-2">
        <Logo />
        <span className="font-display text-lg">InkStory</span>
      </Link>
      <nav className="hidden gap-8 text-sm text-ink-muted md:flex">
        <a href="#how" className="hover:text-white">How it works</a>
        <a href="#pricing" className="hover:text-white">Concept Pack</a>
      </nav>
      <Link href="/demo/brief" className="btn-primary">Try the demo</Link>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-16 pt-6 md:pb-28 md:pt-16">
      <div className="flex flex-col gap-6">
        <span className="pill w-fit">A better way to plan a tattoo</span>
        <h1 className="font-display text-4xl leading-[1.05] md:text-6xl">
          Your tattoo starts <br className="hidden md:block" />
          with a <em className="not-italic text-accent">story</em>.
        </h1>
        <p className="max-w-2xl text-lg text-ink-muted">
          Answer five questions about what this piece needs to carry. InkStory turns your meaning into three
          considered concept directions and an artist-ready brief — so the first conversation with your artist
          starts miles ahead.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/demo/brief" className="btn-primary">Try the demo — no sign-in</Link>
          <Link href="/brief" className="btn-ghost">Sign in to save your work</Link>
        </div>
        <p className="text-xs text-ink-muted/70">
          Demo mode runs entirely in your browser. Sign in with your email to save briefs to your account.
        </p>
      </div>
    </section>
  );
}

function How() {
  const steps = [
    { n: "01", h: "Tell us the story", p: "Meaning, placement, size, style and the elements that must appear." },
    { n: "02", h: "See three directions", p: "InkStory generates three distinct concept directions from your brief." },
    { n: "03", h: "Take it to your artist", p: "Download the artist-ready PDF: brief, references and hi-res concepts." }
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <h2 className="font-display text-3xl md:text-4xl">How it works</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="card">
            <div className="font-display text-3xl text-accent">{s.n}</div>
            <h3 className="mt-3 font-display text-xl">{s.h}</h3>
            <p className="mt-2 text-sm text-ink-muted">{s.p}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <h2 className="font-display text-3xl md:text-4xl">Concept Pack</h2>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Start free. Upgrade only when you want the polished, artist-ready output.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="pill">Explorer</div>
          <div className="mt-4 font-display text-4xl">A$0</div>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            <li>Full 5-step brief</li>
            <li>3 low-res concept directions</li>
            <li>Save and return later</li>
          </ul>
          <Link href="/brief" className="btn-ghost mt-6 w-fit">Start free</Link>
        </div>
        <div className="card border-accent/60">
          <div className="pill border-accent/60 text-accent">Concept Pack — Most Popular</div>
          <div className="mt-4 font-display text-4xl">A$19</div>
          <ul className="mt-4 space-y-2 text-sm text-ink-muted">
            <li>High-resolution concept downloads</li>
            <li>Artist-ready PDF brief with references</li>
            <li>Unlimited concept regenerations</li>
          </ul>
          <Link href="/brief" className="btn-primary mt-6 w-fit">Start with Concept Pack</Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-6 py-16 text-sm text-ink-muted">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Logo /> <span className="font-display">InkStory</span>
        </div>
        <div>© {new Date().getFullYear()} InkStory. A WPC Consulting product.</div>
      </div>
    </footer>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-label="InkStory">
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 18c2-4 4-6 6-6s4 2 6 6" stroke="#c9a26b" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="14" cy="10.5" r="1.4" fill="#c9a26b" />
    </svg>
  );
}
