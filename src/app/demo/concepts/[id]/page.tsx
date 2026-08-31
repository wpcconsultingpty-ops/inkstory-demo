import DemoConceptsView from "./DemoConceptsView";

export const dynamic = "force-dynamic";

export default function DemoConceptsPage({ params }: { params: { id: string } }) {
  return <DemoConceptsView briefId={params.id} />;
}
