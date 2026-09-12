import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const dir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root: dir,
  base: "./",
  resolve: {
    alias: [
      { find: "next/link", replacement: path.join(dir, "link.tsx") },
      { find: "next/navigation", replacement: path.join(dir, "navigation.tsx") },
      { find: "@", replacement: path.join(dir, "../src") }
    ]
  },
  define: {
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify("")
  },
  esbuild: { jsx: "automatic" },
  build: { outDir: path.join(dir, "../preview-dist"), emptyOutDir: true }
});
