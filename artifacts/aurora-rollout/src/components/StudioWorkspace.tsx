import { useState } from "react";
import { MoodboardPanel } from "./MoodboardPanel";
import { NodeCanvas } from "./NodeCanvas";
import { AssistantSidebar, Message } from "./AssistantSidebar";
import { BatchOutputPanel, Scene, OutputResult } from "./BatchOutputPanel";

export function StudioWorkspace() {
  const [artistName, setArtistName] = useState("");
  const [brief, setBrief] = useState("");
  const [mood, setMood] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [characterImageUrl, setCharacterImageUrl] = useState<string | null>(null);
  
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [outputs, setOutputs] = useState<OutputResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBatchPanel, setShowBatchPanel] = useState(false);

  const handleGenerateAll = () => {
    setIsGenerating(true);
    setShowBatchPanel(true);
    // the generation fan-out is handled by BatchOutputPanel mounting
  };

  const handleCloseBatchPanel = () => {
    setShowBatchPanel(false);
    // If all are done/error, we can clear the generating flag
    if (outputs.every(o => o.status !== "generating")) {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-foreground">
      {/* Ambient background glow */}
      <div 
        className="aurora-orb" 
        style={{ width: 600, height: 600, top: -100, left: '50%', transform: 'translateX(-50%)', background: 'oklch(0.45 0.18 300 / 0.1)' }} 
      />
      <div 
        className="aurora-orb" 
        style={{ width: 400, height: 400, bottom: -100, right: -100, background: 'oklch(0.4 0.15 280 / 0.08)' }} 
      />

      {/* Left Column */}
      <div className="w-[300px] shrink-0 h-full relative z-10">
        <MoodboardPanel 
          artistName={artistName} setArtistName={setArtistName}
          brief={brief} setBrief={setBrief}
          mood={mood} setMood={setMood}
          referenceImages={referenceImages} setReferenceImages={setReferenceImages}
          characterImageUrl={characterImageUrl} setCharacterImageUrl={setCharacterImageUrl}
        />
      </div>

      {/* Center Column */}
      <div className="flex-1 h-full relative z-10">
        <NodeCanvas 
          brief={brief}
          mood={mood}
          characterImageUrl={characterImageUrl}
          scenes={scenes}
          setScenes={setScenes}
          outputs={outputs}
          isGenerating={isGenerating}
          onGenerateAll={handleGenerateAll}
        />
        
        {/* Full-screen overlay for Batch Output */}
        {showBatchPanel && (
          <BatchOutputPanel 
            scenes={scenes}
            characterImageUrl={characterImageUrl}
            outputs={outputs}
            setOutputs={setOutputs}
            onClose={handleCloseBatchPanel}
          />
        )}
      </div>

      {/* Right Column */}
      <div className="w-[340px] shrink-0 h-full relative z-10">
        <AssistantSidebar 
          artistName={artistName}
          brief={brief}
          mood={mood}
          scenes={scenes}
          messages={messages}
          onMessagesChange={setMessages}
        />
      </div>
    </div>
  );
}
