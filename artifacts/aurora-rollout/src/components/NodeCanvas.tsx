import React, { useState } from "react";
import { Edit2, Plus, X, Play, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Scene, OutputResult } from "./BatchOutputPanel";

interface Props {
  brief: string;
  mood: string;
  characterImageUrl: string | null;
  scenes: Scene[];
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>;
  outputs: OutputResult[];
  isGenerating: boolean;
  onGenerateAll: () => void;
}

export function NodeCanvas({
  brief,
  mood,
  characterImageUrl,
  scenes,
  setScenes,
  outputs,
  isGenerating,
  onGenerateAll
}: Props) {
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null);

  // Status computation
  const isBriefDone = brief.trim().length > 0;
  const isStyleDone = mood.trim().length > 0;
  const isCharDone = !!characterImageUrl;
  const isScenesDone = scenes.length > 0 && scenes.every(s => s.title && s.description);
  
  const totalOutputs = outputs.filter(o => o.status === "done").length;
  const generatingCount = outputs.filter(o => o.status === "generating").length;

  const nodes = [
    {
      id: "brief",
      title: "1. Brief",
      summary: isBriefDone ? "Brief defined" : "Awaiting brief",
      status: isBriefDone ? "done" : "active",
    },
    {
      id: "style",
      title: "2. Style",
      summary: isStyleDone ? `Mood: ${mood}` : "Awaiting style",
      status: isStyleDone ? "done" : isBriefDone ? "active" : "idle",
    },
    {
      id: "character",
      title: "3. Character",
      summary: isCharDone ? "Identity locked" : "Awaiting anchor",
      status: isCharDone ? "done" : isStyleDone ? "active" : "idle",
    },
    {
      id: "scenes",
      title: "4. Scenes",
      summary: `${scenes.length} scenes defined`,
      status: isScenesDone ? "done" : isCharDone ? "active" : "idle",
    },
    {
      id: "output",
      title: "5. Batch Output",
      summary: totalOutputs > 0 ? `${totalOutputs} generated` : "Ready to generate",
      status: isGenerating ? "active" : totalOutputs > 0 ? "done" : isScenesDone ? "active" : "idle",
    }
  ] as const;

  const addScene = () => {
    if (scenes.length >= 12) return;
    setScenes(prev => [
      ...prev,
      { id: Math.random().toString(36).substr(2, 9), title: "", description: "" }
    ]);
    setActiveDrawer("scenes");
  };

  const updateScene = (id: string, field: keyof Scene, value: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeScene = (id: string) => {
    setScenes(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="flex-1 h-full relative bg-[var(--canvas-bg)] overflow-hidden flex flex-col items-center justify-center">
      
      {/* Node Pipeline */}
      <div className="relative z-10 flex items-center justify-center w-full px-10 gap-2">
        {nodes.map((node, i) => (
          <React.Fragment key={node.id}>
            <div 
              className={cn(
                "node-card p-5 w-[200px] flex flex-col relative shrink-0 transition-all",
                node.status === "active" && "active scale-105 z-10",
                node.status === "done" && "done opacity-90"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("status-dot", node.status)} />
                  <span className="font-semibold text-sm tracking-tight">{node.title}</span>
                </div>
                {node.id !== "output" && (
                  <button 
                    onClick={() => setActiveDrawer(node.id)}
                    className="p-1 rounded bg-muted/50 hover:bg-primary/20 hover:text-primary transition-colors"
                  >
                    <Edit2 className="size-3" />
                  </button>
                )}
              </div>
              
              <div className="text-xs text-muted-foreground mb-4 h-8 flex items-center">
                {node.summary}
              </div>

              {node.id === "output" && (
                <Button 
                  size="sm" 
                  className="w-full gap-2 mt-auto" 
                  disabled={!isScenesDone || isGenerating}
                  onClick={onGenerateAll}
                  variant={isGenerating ? "outline" : "default"}
                >
                  {isGenerating ? (
                    <><Loader2 className="size-3 animate-spin" /> {generatingCount} Generating</>
                  ) : (
                    <><Play className="size-3" /> Generate All</>
                  )}
                </Button>
              )}
            </div>

            {i < nodes.length - 1 && (
              <svg className="w-12 h-10 shrink-0 mx-2" viewBox="0 0 48 40" fill="none">
                <path 
                  d="M0 20 C 16 20, 32 20, 48 20" 
                  className={cn("connector-line", nodes[i].status === "done" && "done")}
                />
              </svg>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Drawer Overlay */}
      {activeDrawer && (
        <div className="absolute top-0 right-0 bottom-0 w-[400px] glass border-l border-border z-30 flex flex-col shadow-2xl animate-in slide-in-from-right-8 duration-200">
          <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-card/50">
            <h3 className="font-semibold text-lg capitalize">{activeDrawer} Details</h3>
            <button onClick={() => setActiveDrawer(null)} className="p-2 hover:bg-muted rounded-full">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 panel-scroll p-6 bg-card/20">
            {activeDrawer === "brief" && (
              <div className="text-sm text-muted-foreground">
                Edit the brief in the left panel to update this node.
              </div>
            )}
            
            {activeDrawer === "style" && (
              <div className="text-sm text-muted-foreground">
                Select mood and references in the left panel to define the style.
              </div>
            )}

            {activeDrawer === "character" && (
              <div className="text-sm text-muted-foreground">
                Upload an identity anchor image in the left panel.
              </div>
            )}

            {activeDrawer === "scenes" && (
              <div className="space-y-6">
                {scenes.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-border rounded-xl">
                    <p className="text-sm text-muted-foreground mb-4">No scenes defined yet.</p>
                    <Button onClick={addScene} variant="outline" size="sm" className="gap-2">
                      <Plus className="size-4" /> Add First Scene
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      {scenes.map((scene, i) => {
                        const out = outputs.find(o => o.sceneId === scene.id);
                        return (
                          <div key={scene.id} className="p-4 bg-card border border-border rounded-xl space-y-3 relative group">
                            <div className="absolute -left-2 -top-2 size-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold shadow-sm">
                              {i + 1}
                            </div>
                            
                            <button 
                              onClick={() => removeScene(scene.id)}
                              className="absolute top-2 right-2 p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="size-3.5" />
                            </button>

                            <div className="pl-3">
                              <Input 
                                placeholder="Scene Title (e.g. Neon Alley)" 
                                value={scene.title}
                                onChange={(e) => updateScene(scene.id, "title", e.target.value)}
                                className="h-8 text-sm font-medium border-transparent hover:border-border focus:border-primary px-2 mb-2 bg-transparent -ml-2"
                              />
                              <Textarea 
                                placeholder="Describe the action, camera angle, and lighting..."
                                value={scene.description}
                                onChange={(e) => updateScene(scene.id, "description", e.target.value)}
                                className="min-h-[80px] text-xs resize-none"
                              />
                            </div>

                            {out && (
                              <div className="mt-3 flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
                                {out.imageUrl ? (
                                  <img src={out.imageUrl} className="size-10 object-cover rounded bg-muted" />
                                ) : (
                                  <div className="size-10 rounded bg-muted flex items-center justify-center">
                                    {out.status === "generating" ? <Loader2 className="size-4 animate-spin text-primary" /> : <X className="size-4 text-destructive" />}
                                  </div>
                                )}
                                <Badge variant={out.status === "done" ? "default" : "outline"} className="text-[10px]">
                                  {out.status}
                                </Badge>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {scenes.length < 12 && (
                      <Button onClick={addScene} variant="outline" className="w-full gap-2 border-dashed">
                        <Plus className="size-4" /> Add Scene
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
