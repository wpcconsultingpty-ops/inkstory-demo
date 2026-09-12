import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BriefWizard from "./BriefWizard";
import AccountUnavailable from "@/components/AccountUnavailable";
import { accountConfigured } from "@/components/pilot-client";

export const dynamic = "force-dynamic";

export default async function BriefPage({
  searchParams
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  if (!accountConfigured()) return <AccountUnavailable />;
  const { id } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(id ? `/brief?id=${id}` : "/brief")}`);

  let initial: any = null;
  if (id) {
    const { data, error } = await supabase.from("briefs").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) return <AccountUnavailable message="We could not load your saved brief. Try again later; this does not mean the brief has been deleted." />;
    if (!data) notFound();
    initial = data;
  }

  return <BriefWizard key={id ?? "new"} initial={initial} userEmail={user.email ?? ""} />;
}
