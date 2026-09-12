import DemoConceptsView from "./DemoConceptsView";

export const dynamic = "force-dynamic";

export default async function DemoConceptsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DemoConceptsView briefId={id} />;
}
