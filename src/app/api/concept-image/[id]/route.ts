import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  MAX_IMAGE_BYTES, RequestError, decodeRasterBase64, rasterMime,
  resolvePrivateImageSource, validateUUID
} from "@/lib/security";
import { apiFailure } from "@/lib/pilot-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const conceptId = validateUUID((await params).id, "concept id");
    const supa = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supa.auth.getUser();
    if (authError || !user) throw new RequestError(401, "Sign in to view this image.");
    const { data: concept, error } = await supa.from("concepts")
      .select("id,user_id,brief_id,image_url").eq("id", conceptId).eq("user_id", user.id).maybeSingle();
    if (error) throw new RequestError(503, "Unable to load this image.");
    if (!concept) throw new RequestError(404, "Image not found.");
    // Defense in depth for old rows whose concept and brief owners disagree.
    const { data: brief, error: briefError } = await supa.from("briefs").select("id")
      .eq("id", concept.brief_id).eq("user_id", user.id).maybeSingle();
    if (briefError) throw new RequestError(503, "Unable to load this image.");
    if (!brief) throw new RequestError(404, "Image not found.");
    const source = resolvePrivateImageSource(
      concept.image_url, user.id, concept.brief_id, process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    );
    let image: Blob;
    if (source.kind === "inline") {
      try {
        const bytes = decodeRasterBase64(source.data, source.mime);
        image = new Blob([bytes], { type: source.mime });
      } catch {
        throw new RequestError(404, "Image not found.");
      }
    } else {
      // The SDK uses the user's JWT for this private download; no public URL,
      // service role, external fetch or URL supplied by the caller is used.
      const { data, error: downloadError } = await supa.storage.from("concepts").download(source.path);
      if (downloadError || !data) throw new RequestError(404, "Image not found.");
      if (data.size > MAX_IMAGE_BYTES) throw new RequestError(404, "Image not found.");
      const mime = rasterMime(new Uint8Array(await data.slice(0, 12).arrayBuffer()));
      if (!mime) throw new RequestError(404, "Image not found.");
      image = data.slice(0, data.size, mime);
    }
    return new Response(image.stream(), {
      headers: {
        "Content-Type": image.type,
        "Content-Length": String(image.size),
        "Cache-Control": "private, no-store, max-age=0",
        "Vary": "Cookie",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Disposition": "inline"
      }
    });
  } catch (error) {
    return apiFailure(error);
  }
}
