import type { Metadata } from "next";
import "./globals.css";

const isStaging = process.env.NEXT_PUBLIC_INKSTORY_ENVIRONMENT === "staging";
export const metadata: Metadata = {
  title: isStaging ? "InkStory Staging — Test environment" : "InkStory — Tattoo planning, early-access preview",
  robots: isStaging ? { index: false, follow: false, nocache: true } : undefined,
  description:
    "Explore a tattoo discussion brief and one lifetime free image attempt for verified email accounts when enabled. A planning reference, not a tattoo design service.",
  metadataBase: new URL(isStaging ? "https://inkstory-staging.vercel.app" : "https://inkstory-tattoo-planner.vercel.app"),
  openGraph: {
    title: "InkStory",
    description: "Your tattoo starts with a story. Plan your brief and check your account's one lifetime free image attempt when public generation is enabled.",
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
          STAGING · Test environment · Image generation subject to account & service limits · Payments disabled · Production is separate
        </div>}
        {children}
      </body>
    </html>
  );
}
