import { useState } from "react";
import { Landing } from "@/components/Landing";
import { AdultStudio } from "@/components/AdultStudio";

// The admin passcode gate was removed by owner request — Landing goes straight
// into the Studio. API calls authenticate via getAdminToken(), which falls back
// to the build-time passcode (see AdminGate.tsx).
type View = "landing" | "studio";

export default function App() {
  const [view, setView] = useState<View>("landing");

  if (view === "landing") return <Landing onEnter={() => setView("studio")} />;
  return <AdultStudio />;
}
