import { Suspense } from "react";
import DemoBriefWizard from "../DemoBriefWizard";

export const dynamic = "force-dynamic";

export default function DemoBriefPage() {
  return (
    <Suspense fallback={<p role="status" className="p-6">Opening local brief…</p>}>
      <DemoBriefWizard />
    </Suspense>
  );
}
