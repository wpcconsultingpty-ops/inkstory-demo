import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { GALLERY_BRIEF_HREF, GALLERY_CONCEPTS, GALLERY_DISCLOSURE } from "../src/lib/gallery";
import { previewImageSrc } from "../preview/image";

const root = resolve(import.meta.dirname, "..");
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

test("the gallery is three distinct, fixed editorial studies", () => {
  assert.deepEqual(GALLERY_CONCEPTS.map(({ id, title, theme, placement }) => ({ id, title, theme, placement })), [
    { id: "stormkeeper", title: "Stormkeeper", theme: "Strength in uncertainty", placement: "Full sleeve" },
    { id: "quiet-sovereign", title: "Quiet Sovereign", theme: "Self-command", placement: "Full back" },
    { id: "against-the-current", title: "Against the Current", theme: "Persistence", placement: "Leg piece" },
  ]);
  assert.equal(new Set(GALLERY_CONCEPTS.map((concept) => concept.image)).size, 3);
  assert.match(GALLERY_CONCEPTS[0].motifs, /Stone guardian.*Lighthouse.*Ocean/);
  assert.match(GALLERY_CONCEPTS[1].motifs, /Uncrowned lion.*Mountains.*Roots/);
  assert.match(GALLERY_CONCEPTS[2].motifs, /Koi.*Peonies.*Water/);
  assert.match(GALLERY_CONCEPTS[2].palette, /Selective red/);
});

test("every concept references a real local WebP, with fictional AI alt text", () => {
  for (const concept of GALLERY_CONCEPTS) {
    assert.equal(concept.image, `/gallery/${concept.id}.webp`);
    assert.match(concept.alt, /^AI concept mockup of a fictional /);
    const image = readFileSync(resolve(root, `public${concept.image}`));
    assert.equal(image.toString("ascii", 0, 4), "RIFF");
    assert.equal(image.toString("ascii", 8, 12), "WEBP");
    assert.ok(image.length > 1024 && image.length < 600_000, `${concept.id} must be a web-sized image, not a placeholder`);
  }
});

test("gallery disclosures reject personalisation, completed tattoos and tattooability claims", () => {
  assert.equal(GALLERY_DISCLOSURE.label, "AI concept mockup");
  assert.equal(GALLERY_DISCLOSURE.placement, "Fictional placement");
  assert.match(GALLERY_DISCLOSURE.provenance, /Fixed editorial inspiration/);
  assert.match(GALLERY_DISCLOSURE.provenance, /not a completed tattoo/);
  assert.match(GALLERY_DISCLOSURE.provenance, /not generated from any user brief/);
  assert.match(GALLERY_DISCLOSURE.artistReview, /not evidence that a design can be tattooed/);
  assert.match(GALLERY_DISCLOSURE.artistReview, /artist must simplify, adapt and approve/);
});

test("cards, enlarged views and homepage teaser reuse the editorial disclosures", () => {
  const grid = source("src/app/gallery/GalleryGrid.tsx");
  const [card, detail] = grid.split("<dialog");
  for (const view of [card, detail, source("src/components/GalleryTeaser.tsx")]) {
    assert.match(view, /GALLERY_DISCLOSURE\.label/);
    assert.match(view, /GALLERY_DISCLOSURE\.placement/);
    assert.match(view, /GALLERY_DISCLOSURE\.provenance/);
  }
  assert.match(detail, /GALLERY_DISCLOSURE\.artistReview/);
  assert.match(source("src/app/gallery/page.tsx"), /GALLERY_DISCLOSURE\.artistReview/);
});

test("gallery brief links are blank starts, with no entitlement or gallery persistence", () => {
  assert.equal(GALLERY_BRIEF_HREF, "/demo/brief");
  assert.match(GALLERY_DISCLOSURE.briefNotice, /Starts a blank local brief/);
  assert.match(GALLERY_DISCLOSURE.briefNotice, /no gallery concept is selected or carried over/);
  assert.match(GALLERY_DISCLOSURE.briefNotice, /does not grant AI generation access or a pilot entitlement/);
  for (const path of ["src/app/gallery/page.tsx", "src/app/gallery/GalleryGrid.tsx"]) {
    const code = source(path);
    assert.match(code, /href=\{GALLERY_BRIEF_HREF\}/);
    assert.match(code, /GALLERY_DISCLOSURE\.briefNotice/);
    assert.doesNotMatch(code, /localStorage|sessionStorage|fetch\(|supabase|createDemoBrief|updateDemoBrief|\/api\//);
  }
});

test("gallery uses labelled native modal dialogs and returns focus to its opener", () => {
  const grid = source("src/app/gallery/GalleryGrid.tsx");
  assert.match(grid, /\.showModal\(\)/);
  assert.match(grid, /aria-haspopup="dialog"/);
  assert.match(grid, /aria-labelledby=\{`\$\{concept\.id\}-detail-title`\}/);
  assert.match(grid, /aria-describedby=\{`\$\{concept\.id\}-detail-disclosure`\}/);
  assert.match(grid, /onClose=\{restoreFocus\}/);
  assert.match(grid, /openButtonRef\.current\?\.focus/);
  assert.match(grid, /dialogRef\.current\?\.close\(\)/);
});

test("gallery is noindex and reachable without replacing the demo diagrams", () => {
  assert.match(source("src/app/gallery/page.tsx"), /robots: \{ index: false, follow: false, nocache: true \}/);
  assert.match(source("src/app/page.tsx"), /href="\/gallery"/);
  assert.match(source("src/app/page.tsx"), /<GalleryTeaser \/>/);
  assert.match(source("src/components/PilotLinks.tsx"), /href="\/gallery"/);
  assert.match(source("src/app/demo/concepts/[id]/DemoConceptsView.tsx"), /<ExampleLayout index=\{index\} \/>/);
  assert.doesNotMatch(source("src/lib/demo.ts"), /GALLERY_CONCEPTS|\/gallery\/.*\.webp/);
});

test("isolated review supports the gallery and relative image paths without persistent storage", () => {
  assert.equal(previewImageSrc("/gallery/stormkeeper.webp"), "./gallery/stormkeeper.webp");
  assert.equal(new URL(previewImageSrc("/gallery/stormkeeper.webp"), "https://review.example/prefix/index.html").pathname, "/prefix/gallery/stormkeeper.webp");
  assert.equal(previewImageSrc("https://example.com/image.webp"), "https://example.com/image.webp");
  assert.equal(previewImageSrc("//example.com/image.webp"), "//example.com/image.webp");
  const config = source("preview/vite.config.mjs");
  assert.match(config, /publicDir: path.join\(dir, "\.\.\/public"\)/);
  assert.match(config, /find: "next\/image"/);
  assert.match(config, /"window.localStorage": "undefined"/);
  assert.match(source("preview/main.tsx"), /path === "\/gallery"/);
});
