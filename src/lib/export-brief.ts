import type { BriefDraft } from "@/lib/brief";
import { BRIEF_FIELDS, BRIEF_LABELS } from "@/components/brief-validation";

export type BriefExport = {
  brief: Partial<Record<keyof BriefDraft, string | null>>;
  mode: "demo" | "account";
  labels?: string[];
  preferredLayout?: string | null;
};

function sections(data: BriefExport): { title: string; text: string }[] {
  return [
    { title: "Purpose", text: "An artist discussion brief from the InkStory early-access pilot. This is a planning aid, not a stencil, final tattoo design or guarantee of suitability. A qualified tattoo artist must assess placement, scale, linework, cultural meaning and how the work will age." },
    { title: "Preview type", text: data.mode === "demo" ? "Local layout demo. The abstract example diagrams are fixed illustrations shown to everyone, not personalised AI tattoo concepts. This text-only export contains no artwork." : "Account pilot brief. Any generated concepts are AI-assisted discussion references, not final tattoo designs. This text-only export contains no artwork; available account images are downloaded separately." },
    ...BRIEF_FIELDS.map((key) => ({ title: BRIEF_LABELS[key], text: data.brief[key]?.trim() || "Not provided" })),
    { title: data.mode === "demo" ? "Example layout labels (not artwork)" : "Saved concept labels", text: data.labels?.length ? data.labels.join("\n") : "No concepts included." },
    ...(data.preferredLayout ? [{ title: "Layout to discuss", text: data.preferredLayout }] : []),
    { title: "Questions for your artist", text: "Which elements will remain readable at this size?\nHow should the composition follow the body?\nWhat changes would improve linework and ageing?\nAre any symbols culturally sensitive or inappropriate?\nWhat would you simplify or leave out?" },
    { title: "Pilot contact", text: "Ask about early access: https://www.facebook.com/profile.php?id=61594325640339" },
  ];
}

/** Real browser print output, not a text file renamed .pdf. DOM text preserves Unicode. */
export function printBrief(data: BriefExport): void {
  if (typeof window === "undefined" || typeof window.print !== "function") throw new Error("Printing is unavailable in this browser.");
  document.getElementById("inkstory-print-brief")?.remove();
  const root = document.createElement("article");
  root.id = "inkstory-print-brief";
  root.setAttribute("aria-label", "InkStory artist discussion brief");
  const h1 = document.createElement("h1");
  h1.textContent = "InkStory — artist discussion brief";
  root.appendChild(h1);
  const date = document.createElement("p");
  date.textContent = `Prepared ${new Date().toLocaleDateString()} · Text only · Early-access pilot`;
  root.appendChild(date);
  for (const item of sections(data)) {
    const section = document.createElement("section");
    const title = document.createElement("h2");
    const text = document.createElement("p");
    title.textContent = item.title;
    text.textContent = item.text;
    section.append(title, text);
    root.appendChild(section);
  }
  document.body.appendChild(root);
  const cleanup = () => root.remove();
  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    window.print();
  } catch (error) {
    cleanup();
    window.removeEventListener("afterprint", cleanup);
    throw error;
  }
}

export function downloadBriefText(data: BriefExport): void {
  const text = ["InkStory — artist discussion brief", ...sections(data).map((section) => `${section.title}\n${section.text}`)].join("\n\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "inkstory-discussion-brief.txt";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
