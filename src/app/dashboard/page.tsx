import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/dashboard");

  const { data: briefs } = await supabase
    .from("briefs")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-ink-muted hover:text-white">← InkStory</Link>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-ink-muted hover:text-white">Sign out</button>
        </form>
      </header>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Your briefs</h1>
          <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
        </div>
        <Link href="/brief" className="btn-primary">Start a new brief</Link>
      </div>

      <div className="mt-8 space-y-3">
        {(briefs ?? []).length === 0 && (
          <div className="card text-sm text-ink-muted">
            No briefs yet. <Link className="text-accent" href="/brief">Start your first story →</Link>
          </div>
        )}
        {(briefs ?? []).map((b) => (
          <Link
            key={b.id}
            href={b.status === "draft" ? `/brief?id=${b.id}` : `/concepts/${b.id}`}
            className="card flex items-center justify-between hover:border-white/40"
          >
            <div>
              <div className="font-display text-lg">
                {b.style ? `${b.style}` : "Untitled brief"}
                {b.placement ? ` · ${b.placement}` : ""}
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                {b.meaning?.slice(0, 100) || "No meaning captured yet"}
              </div>
            </div>
            <span className="pill capitalize">{b.status.replace("_", " ")}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
