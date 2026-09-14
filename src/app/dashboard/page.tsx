import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accountConfigured } from "@/components/pilot-client";
import AccountUnavailable from "@/components/AccountUnavailable";
import { PilotLinks } from "@/components/PilotLinks";
import GenerationAllowance from "@/components/GenerationAllowance";
import { readGenerationEntitlement } from "@/lib/pilot-server";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  if (!accountConfigured()) return <AccountUnavailable />;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/dashboard");
  const entitlement = await readGenerationEntitlement(supabase);

  const { data: briefs, error } = await supabase
    .from("briefs")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-ink-muted hover:text-white">← InkStory</Link>
        <form action="/auth/signout" method="post">
          <button className="btn-ghost">Sign out</button>
        </form>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Your briefs</h1>
          <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
        </div>
        <Link href="/brief" className="btn-primary">Start a new brief</Link>
      </div>
      <p className="mt-4 text-sm text-ink-muted">Your account brief does not use an image attempt until a generation request is reserved. Local demo briefs are separate and are not synced here.</p>
      <GenerationAllowance entitlement={entitlement} />

      <div className="mt-8 space-y-3">
        {error && <div role="alert" className="card text-sm text-red-200">Your briefs could not be loaded. Refresh or try again later; this does not mean they have been deleted.</div>}
        {!error && (briefs ?? []).length === 0 && (
          <div className="card text-sm text-ink-muted">
            No briefs yet. <Link className="text-accent" href="/brief">Start your first story →</Link>
          </div>
        )}
        {(briefs ?? []).map((b) => (
          <article
            key={b.id}
            className="card flex flex-wrap items-center justify-between gap-4"
          >
            <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
              <div className="font-display text-lg">
                {b.style ? `${b.style}` : "Untitled brief"}
                {b.placement ? ` · ${b.placement}` : ""}
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                {b.meaning?.slice(0, 100) || "No meaning captured yet"}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link className="btn-ghost" href={`/brief?id=${encodeURIComponent(b.id)}`}>Edit brief</Link>
              <Link className="btn-ghost" href={`/concepts/${encodeURIComponent(b.id)}`}>View concepts</Link>
            </div>
          </article>
        ))}
      </div>
      <PilotLinks />
    </main>
  );
}
