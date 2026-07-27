import React, { useEffect } from "react";
import { X, Download, RefreshCcw, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateSceneImage } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface Scene {
  id: string;
  title: string;
  description: string;
}

export interface OutputResult {
  sceneId: string;
  status: "generating" | "done" | "error";
  imageUrl?: string;
}

interface Props {
  scenes: Scene[];
  characterImageUrl: string | null;
  outputs: OutputResult[];
  setOutputs: React.Dispatch<React.SetStateAction<OutputResult[]>>;
  onClose: () => void;
}

export function BatchOutputPanel({ scenes, characterImageUrl, outputs, setOutputs, onClose }: Props) {
  
  const generateForScene = async (scene: Scene) => {
    setOutputs(prev => {
      const idx = prev.findIndex(o => o.sceneId === scene.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], status: "generating", imageUrl: undefined };
        return next;
      }
      return [...prev, { sceneId: scene.id, status: "generating" }];
    });

    try {
      const res = await generateSceneImage(scene.description, characterImageUrl || undefined);
      setOutputs(prev => prev.map(o => o.sceneId === scene.id ? { ...o, status: "done", imageUrl: res.url } : o));
    } catch (err) {
      setOutputs(prev => prev.map(o => o.sceneId === scene.id ? { ...o, status: "error" } : o));
    }
  };

  // On mount, fan out for any scene that doesn't have an output yet
  useEffect(() => {
    scenes.forEach(scene => {
      const existing = outputs.find(o => o.sceneId === scene.id);
      if (!existing || existing.status === 'error') {
        generateForScene(scene);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = async (url: string, title: string) => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // fallback
      window.open(url, '_blank');
    }
  };

  return (
    <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in zoom-in-95 duration-200">
      <div className="p-6 border-b border-border flex items-center justify-between glass sticky top-0 z-30">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SparklesIcon className="size-5 text-primary" />
            Batch Generation Output
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Generating {scenes.length} scenes concurrently</p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose} className="gap-2">
          <X className="size-4" />
          Close View
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenes.map(scene => {
            const out = outputs.find(o => o.sceneId === scene.id);
            const status = out?.status || "generating";
            
            return (
              <div key={scene.id} className="output-card flex flex-col">
                <div className="aspect-video bg-muted/30 relative flex items-center justify-center border-b border-border">
                  {status === "generating" && (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Loader2 className="size-6 text-primary animate-spin" />
                      <span className="text-xs font-medium animate-pulse">Synthesizing...</span>
                    </div>
                  )}
                  
                  {status === "error" && (
                    <div className="flex flex-col items-center gap-3 text-destructive">
                      <X className="size-6" />
                      <span className="text-xs font-medium">Generation failed</span>
                    </div>
                  )}

                  {status === "done" && out?.imageUrl && (
                    <img 
                      src={out.imageUrl} 
                      alt={scene.title}
                      className="w-full h-full object-cover animate-in fade-in duration-500"
                    />
                  )}
                </div>
                
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm line-clamp-1">{scene.title}</h3>
                    <Badge 
                      variant={status === "done" ? "default" : status === "error" ? "destructive" : "secondary"}
                      className="text-[10px] uppercase tracking-wider px-1.5"
                    >
                      {status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {scene.description}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-border flex items-center justify-end gap-2">
                    {status === "error" && (
                      <Button variant="outline" size="sm" onClick={() => generateForScene(scene)} className="w-full">
                        <RefreshCcw className="size-3 mr-2" /> Retry
                      </Button>
                    )}
                    {status === "done" && out?.imageUrl && (
                      <Button variant="secondary" size="sm" onClick={() => handleDownload(out.imageUrl!, scene.title)} className="w-full">
                        <Download className="size-3 mr-2" /> Download
                      </Button>
                    )}
                    {status === "generating" && (
                      <Button variant="secondary" size="sm" disabled className="w-full">
                        Generating...
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SparklesIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
