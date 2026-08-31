import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InkStory — Your tattoo starts with a story",
  description:
    "InkStory turns your meaning into a considered tattoo concept. Five questions. Three concept directions. One artist-ready brief.",
  metadataBase: new URL("https://inkstory-tattoo-planner.vercel.app"),
  openGraph: {
    title: "InkStory",
    description: "Your tattoo starts with a story.",
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
      <body>{children}</body>
    </html>
  );
}
