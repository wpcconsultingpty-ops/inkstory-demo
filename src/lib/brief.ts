export type BriefDraft = {
  meaning: string;
  placement: string;
  size_cm: string;
  style: string;
  key_elements: string;
  palette: string;
  reference_notes: string;
};

export const emptyBrief: BriefDraft = {
  meaning: "",
  placement: "",
  size_cm: "",
  style: "",
  key_elements: "",
  palette: "",
  reference_notes: ""
};

export const STYLES = [
  "Fine-line",
  "Black-and-grey realism",
  "Neo-traditional",
  "Japanese (Irezumi)",
  "Norse / runic",
  "Illustrative",
  "Minimal geometric",
  "Watercolour",
  "Bold traditional"
];

export const PLACEMENTS = [
  "Inner forearm",
  "Outer forearm",
  "Upper arm / bicep",
  "Full sleeve",
  "Chest",
  "Ribs",
  "Back",
  "Thigh",
  "Calf",
  "Hand or wrist"
];

export const SIZES = ["Small (3–7cm)", "Medium (8–15cm)", "Large (16–25cm)", "XL / sleeve panel"];

export const PALETTES = ["Black and grey", "Black-line only", "Muted colour", "Bold colour", "Watercolour wash"];

export function buildPrompt(b: BriefDraft): string {
  const parts = [
    "A refined tattoo concept design, isolated on plain off-white background, high detail, portfolio-quality.",
    b.style ? `Style: ${b.style}.` : "",
    b.key_elements ? `Key elements: ${b.key_elements}.` : "",
    b.meaning ? `Meaning and story: ${b.meaning}.` : "",
    b.placement ? `Placement: ${b.placement}.` : "",
    b.size_cm ? `Approximate size: ${b.size_cm}.` : "",
    b.palette ? `Palette: ${b.palette}.` : "",
    b.reference_notes ? `References/notes: ${b.reference_notes}.` : "",
    "Composition is centered, negative space intentional, linework confident, no text, no watermarks, no signature."
  ];
  return parts.filter(Boolean).join(" ");
}
