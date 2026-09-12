import type { Metadata } from "next";
import "./globals.css";

const isStaging = process.env.NEXT_PUBLIC_INKSTORY_ENVIRONMENT === "staging";
export const metadata: Metadata = {
  title: isStaging ? "InkStory Staging — Test environment" : "InkStory — Tattoo planning, early-access preview",
  robots: isStaging ? { index: false, follow: false, nocache: true } : undefined,
  description:
    "Explore a local tattoo discussion brief and abstract example layouts. A planning preview with invitation-only account generation, not a paid tattoo design service.",
  metadataBase: new URL(isStaging ? "https://inkstory-staging.vercel.app" : "https://inkstory-tattoo-planner.vercel.app"),
  openGraph: {
    title: "InkStory",
    description: "Your tattoo starts with a story. Explore the local planning preview; account image generation is invitation-only.",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {isStaging && <div className="border-b border-ink-ring bg-ink-edge px-5 py-3 text-center text-sm text-accent-soft" role="note">
          STAGING · Test data only · AI generation and payments disabled · Production is separate
        </div>}
        {children}
      </body>
    </html>
  );
}
