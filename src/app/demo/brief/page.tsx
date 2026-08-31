import { Suspense } from "react";
import DemoBriefWizard from "../DemoBriefWizard";

export const dynamic = "force-dynamic";

export default function DemoBriefPage() {
  return (
    <Suspense fallback={null}>
      <DemoBriefWizard />
    </Suspense>
  );
}
