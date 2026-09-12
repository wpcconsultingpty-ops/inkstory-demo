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
  // Length-delimited raw text preserves every character without JSON-escape
  // expansion (6000 quotes/backslashes must not become a 12000-char prompt).
  // Field lengths count Unicode code points, matching the database. Values
  // remain untrusted creative data, even when they contain marker-like text.
  return Object.entries({
    meaning: b.meaning,
    placement: b.placement,
    size_cm: b.size_cm,
    style: b.style,
    key_elements: b.key_elements,
    palette: b.palette,
    reference_notes: b.reference_notes
  }).map(([key, value]) => `${key} [${Array.from(value).length} code points]\n${value}`).join("\n");
}
