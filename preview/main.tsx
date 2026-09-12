import React, { useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import Landing from "../src/app/page";
import DemoBriefWizard from "../src/app/demo/DemoBriefWizard";
import DemoConceptsView from "../src/app/demo/concepts/[id]/DemoConceptsView";
import DemoDashboard from "../src/app/demo/dashboard/DemoDashboard";
import AccountUnavailable from "../src/components/AccountUnavailable";
import PrivacyPage from "../src/app/privacy/page";
import PilotPage from "../src/app/pilot/page";
import GalleryPage from "../src/app/gallery/page";
import { Navigation } from "./navigation";
import "../src/app/globals.css";

function App() {
  const [route, setRoute] = useState("/");
  const navigate = (path: string) => { setRoute(path); window.scrollTo(0, 0); };
  const path = route.split("?")[0];
  let view: ReactNode;
  if (path === "/") view = <Landing />;
  else if (path === "/privacy") view = <PrivacyPage />;
  else if (path === "/pilot") view = <PilotPage />;
  else if (path === "/gallery") view = <GalleryPage />;
  else if (path === "/demo/brief") view = <DemoBriefWizard />;
  else if (path === "/demo/sample") view = <DemoConceptsView briefId="sample" />;
  else if (path === "/demo/dashboard") view = <DemoDashboard />;
  else if (path.startsWith("/demo/concepts/")) view = <DemoConceptsView briefId={decodeURIComponent(path.slice("/demo/concepts/".length))} />;
  else view = <AccountUnavailable message="This isolated preview has no account connection and cannot make AI requests or take payment. The local planning flow uses the same components as the repaired application." />;
  return <Navigation.Provider value={{ route, navigate }}>
    <div className="border-b border-ink-ring px-5 py-3 text-center text-xs text-ink-muted">
      Isolated preview · Memory-only notes · No account access, AI charges or payments · Production is unchanged
    </div>
    <div key={route}>{view}</div>
  </Navigation.Provider>;
}
createRoot(document.getElementById("root")!).render(<App />);
