/**
 * Fixed editorial artwork, independent of demo briefs and account concepts.
 * Opening a concept never creates a selection, entitlement or generation request.
 */
export const GALLERY_DISCLOSURE = {
  label: "AI concept mockup",
  placement: "Fictional placement",
  provenance: "Fixed editorial inspiration — not a completed tattoo and not generated from any user brief.",
  artistReview: "Imagined anatomy and fine detail are not evidence that a design can be tattooed. A tattoo artist must simplify, adapt and approve the composition, placement and detail before any tattooing.",
  briefNotice: "Starts a blank local brief; no gallery concept is selected or carried over. This does not grant AI generation access or a pilot entitlement.",
} as const;

export const GALLERY_BRIEF_HREF = "/demo/brief";

export const GALLERY_CONCEPTS = [
  {
    id: "stormkeeper",
    number: "01",
    title: "Stormkeeper",
    theme: "Strength in uncertainty",
    placement: "Full sleeve",
    palette: "Black & grey",
    motifs: "Stone guardian · Lighthouse · Ocean",
    description: "A stoic guardian above a restless sea. A distant lighthouse holds its place through the storm.",
    editorialNote: "A mythic stone figure anchors this imagined sleeve, with an ocean and lighthouse below. The contrast between stillness and movement explores strength without pretending the storm has passed.",
    artistQuestion: "What should remain if the guardian, lighthouse and waves cannot all read clearly at the chosen scale?",
    image: "/gallery/stormkeeper.webp",
    alt: "AI concept mockup of a fictional full-sleeve tattoo with a stoic stone guardian, ocean waves and a lighthouse.",
  },
  {
    id: "quiet-sovereign",
    number: "02",
    title: "Quiet Sovereign",
    theme: "Self-command",
    placement: "Full back",
    palette: "Black & grey",
    motifs: "Uncrowned lion · Mountains · Roots",
    description: "An uncrowned lion, steady mountains and reaching roots. Authority that does not need to announce itself.",
    editorialNote: "A calm lion is the centre of this imagined back piece. Mountains and roots frame a study of inner authority: grounded, deliberate and free from the need for a crown.",
    artistQuestion: "How could the artist give the lion enough space, while reducing the mountains and roots to supporting elements?",
    image: "/gallery/quiet-sovereign.webp",
    alt: "AI concept mockup of a fictional full-back tattoo with a calm uncrowned lion, mountains and roots.",
  },
  {
    id: "against-the-current",
    number: "03",
    title: "Against the Current",
    theme: "Persistence",
    placement: "Leg piece",
    palette: "Black & grey · Selective red",
    motifs: "Koi · Peonies · Water",
    description: "A koi moves through turbulent water and peonies. Selective red brings a quiet insistence to the movement.",
    editorialNote: "This Japanese-inspired leg study brings koi, peonies and moving water into a single imagined composition. Its editorial theme is persistence; it is not a claim of traditional symbolism or an artist-approved Japanese tattoo design.",
    artistQuestion: "Which elements and red accents should stay, and how would an artist experienced in Japanese tattooing rethink the composition?",
    image: "/gallery/against-the-current.webp",
    alt: "AI concept mockup of a fictional Japanese-inspired leg tattoo with a koi, peonies and flowing water, with selective red accents.",
  },
] as const;

export type GalleryConcept = (typeof GALLERY_CONCEPTS)[number];
