import { useState } from "react";
import { Landing } from "@/components/Landing";
import { AdminGate, isAdminUnlocked } from "@/components/AdminGate";
import { AdultStudio } from "@/components/AdultStudio";

type View = "landing" | "gate" | "studio";

function initialView(): View {
  return isAdminUnlocked() ? "studio" : "landing";
}

export default function App() {
  const [view, setView] = useState<View>(initialView);

  if (view === "landing") return <Landing onEnter={() => setView("gate")} />;
  if (view === "gate")    return <AdminGate onUnlocked={() => setView("studio")} />;
  return <AdultStudio />;
}
