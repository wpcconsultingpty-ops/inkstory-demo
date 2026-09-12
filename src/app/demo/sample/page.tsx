import type { Metadata } from "next";
import DemoConceptsView from "../concepts/[id]/DemoConceptsView";

export const metadata: Metadata = {
  title: "Sample discussion brief | InkStory",
  description: "Explore a fictional tattoo planning brief and fixed abstract layout examples. No personalised AI generation.",
};

export default function SamplePage() {
  return <DemoConceptsView briefId="sample" />;
}
