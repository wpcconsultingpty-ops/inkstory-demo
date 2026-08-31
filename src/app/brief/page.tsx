import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BriefWizard from "./BriefWizard";

export const dynamic = "force-dynamic";

export default async function BriefPage({
  searchParams
}: {
  searchParams: { id?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/brief");

  let initial: any = null;
  if (searchParams.id) {
    const { data } = await supabase.from("briefs").select("*").eq("id", searchParams.id).maybeSingle();
    if (data) initial = data;
  }

  return <BriefWizard initial={initial} userEmail={user.email ?? ""} />;
}
