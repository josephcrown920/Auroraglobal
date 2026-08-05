import { useState } from "react";
import { AdminGate, isAdminUnlocked } from "@/components/AdminGate";
import { AdultStudio } from "@/components/AdultStudio";

export default function App() {
  const [unlocked, setUnlocked] = useState(isAdminUnlocked);

  if (!unlocked) {
    return <AdminGate onUnlocked={() => setUnlocked(true)} />;
  }

  return <AdultStudio />;
}
