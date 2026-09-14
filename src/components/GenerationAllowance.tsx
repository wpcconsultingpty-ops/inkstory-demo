import Link from "next/link";
import { entitlementMessage, type GenerationEntitlement } from "@/lib/generation-entitlement";

export default function GenerationAllowance({ entitlement }: { entitlement: GenerationEntitlement | null }) {
  return (
    <section className="mt-6 rounded-xl border border-ink-ring bg-ink-edge p-4 text-sm" aria-labelledby="allowance-title" data-testid="generation-allowance">
      <h2 id="allowance-title" className="font-medium">Your image allowance</h2>
      <p className="mt-2 text-ink-muted" role="status">{entitlementMessage(entitlement)}</p>
      <Link href="/pilot" className="mt-2 inline-block py-2 text-accent-soft underline">Read generation limits &amp; manual review policy</Link>
    </section>
  );
}
