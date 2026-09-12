import { emptyBrief, type BriefDraft } from "@/lib/brief";
import { BRIEF_LIMITS, MAX_BRIEF_LENGTH } from "@/lib/security";

export const BRIEF_LABELS: Record<keyof BriefDraft, string> = {
  meaning: "Meaning & story",
  placement: "Placement",
  size_cm: "Approximate size",
  style: "Style",
  palette: "Palette",
  key_elements: "Key elements",
  reference_notes: "References & notes",
};

export const BRIEF_FIELDS = Object.keys(BRIEF_LABELS) as (keyof BriefDraft)[];
export const STEP_LABELS = ["Meaning", "Placement & size", "Style & palette", "Elements & notes", "Review"];
export const STEP_FIELDS: (keyof BriefDraft)[][] = [
  ["meaning"],
  ["placement", "size_cm"],
  ["style", "palette"],
  ["key_elements", "reference_notes"],
  BRIEF_FIELDS,
];

export type BriefErrors = Partial<Record<keyof BriefDraft | "total", string>>;
export const characterCount = (text: string) => Array.from(text).length;

/** Frontend-only checks. Server/DB validation remains the authority. */
export function validateBrief(brief: BriefDraft, step = 4): BriefErrors {
  const errors: BriefErrors = {};
  for (const key of STEP_FIELDS[step] ?? BRIEF_FIELDS) {
    const text = brief[key].trim();
    const max = BRIEF_LIMITS[key];
    if (key !== "reference_notes" && !text) {
      errors[key] = `${BRIEF_LABELS[key]} is required.`;
    } else if (key === "meaning" && characterCount(text) < 10) {
      errors[key] = "Add at least 10 characters about what this piece means.";
    } else if (characterCount(text) > max) {
      errors[key] = `${BRIEF_LABELS[key]} must be ${max.toLocaleString()} characters or fewer.`;
    } else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
      errors[key] = `${BRIEF_LABELS[key]} contains unsupported control characters. Remove them and try again.`;
    }
  }
  if (BRIEF_FIELDS.reduce((sum, key) => sum + characterCount(brief[key].trim()), 0) > MAX_BRIEF_LENGTH) {
    errors.total = "Keep the whole brief within 6,000 characters. Shorten your story, elements or notes.";
  }
  return errors;
}

export function draftFrom(value?: Partial<Record<keyof BriefDraft, unknown>> | null): BriefDraft {
  const result = { ...emptyBrief };
  for (const key of BRIEF_FIELDS) result[key] = typeof value?.[key] === "string" ? value[key] as string : "";
  return result;
}

export function trimmedBrief(brief: BriefDraft): BriefDraft {
  return Object.fromEntries(BRIEF_FIELDS.map((key) => [key, brief[key].trim()])) as BriefDraft;
}

export function firstErrorStep(errors: BriefErrors): number {
  return STEP_FIELDS.slice(0, 4).findIndex((fields) => fields.some((key) => errors[key]));
}
