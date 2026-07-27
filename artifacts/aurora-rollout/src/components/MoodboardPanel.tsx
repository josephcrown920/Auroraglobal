import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { X, Upload, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_MOODS = ["Cinematic", "Dark Trap", "Lo-Fi", "Luxury", "Street", "Afrobeats"];

interface Props {
  artistName: string;
  setArtistName: (v: string) => void;
  brief: string;
  setBrief: (v: string) => void;
  mood: string;
  setMood: (v: string) => void;
  referenceImages: string[];
  setReferenceImages: (v: string[]) => void;
  characterImageUrl: string | null;
  setCharacterImageUrl: (v: string | null) => void;
}

export function MoodboardPanel({
  artistName, setArtistName,
  brief, setBrief,
  mood, setMood,
  referenceImages, setReferenceImages,
  characterImageUrl, setCharacterImageUrl
}: Props) {
  const [customMoodMode, setCustomMoodMode] = useState(false);
  const [customMoodText, setCustomMoodText] = useState("");

  const refInputRef = useRef<HTMLInputElement>(null);
  const charInputRef = useRef<HTMLInputElement>(null);

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    
    // Convert to data URLs
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (typeof ev.target?.result === 'string') {
          setReferenceImages(prev => {
            if (prev.length >= 6) return prev;
            return [...prev, ev.target!.result as string];
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleCharUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setCharacterImageUrl(ev.target.result);
      }
    };
    reader.readAsDataURL(e.target.files[0]);
  };

  const removeRefImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    toast.success("Brief saved successfully.");
  };

  return (
    <div className="w-full h-full flex flex-col glass border-r border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-sm">Brief & References</h2>
      </div>

      <div className="flex-1 panel-scroll p-4 space-y-6">
        
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Artist Name</label>
          <Input 
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="e.g. Travis Scott"
            className="bg-card"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">One-line Brief</label>
          <Textarea 
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Late-night luxury trap with cinematic neon visuals..."
            className="bg-card min-h-[80px] resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Mood & Aesthetic</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_MOODS.map(m => (
              <button
                key={m}
                type="button"
                className={cn("mood-chip", mood === m && "selected")}
                onClick={() => {
                  setMood(m);
                  setCustomMoodMode(false);
                }}
              >
                {m}
              </button>
            ))}
            
            {!customMoodMode && !PRESET_MOODS.includes(mood) && mood !== "" ? (
              <button
                type="button"
                className="mood-chip selected"
                onClick={() => setCustomMoodMode(true)}
              >
                {mood}
              </button>
            ) : null}

            {customMoodMode ? (
              <Input
                autoFocus
                className="w-32 h-6 text-xs px-2 py-0 border-primary bg-primary/10"
                value={customMoodText}
                onChange={e => setCustomMoodText(e.target.value)}
                onBlur={() => {
                  if (customMoodText) {
                    setMood(customMoodText);
                  }
                  setCustomMoodMode(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (customMoodText) setMood(customMoodText);
                    setCustomMoodMode(false);
                  }
                }}
                placeholder="Custom..."
              />
            ) : (
              (!mood || PRESET_MOODS.includes(mood)) && (
                <button
                  type="button"
                  className="mood-chip"
                  onClick={() => setCustomMoodMode(true)}
                >
                  + Custom
                </button>
              )
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Identity Anchor</label>
          <p className="text-[10px] text-muted-foreground/70 mb-2">Same face in every scene.</p>
          
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={charInputRef}
            onChange={handleCharUpload} 
          />
          
          <div className="flex items-center gap-4">
            <div 
              className="size-16 rounded-full bg-card border border-dashed border-muted-foreground/30 flex flex-col items-center justify-center shrink-0 cursor-pointer overflow-hidden hover:border-primary/50 transition-colors"
              onClick={() => charInputRef.current?.click()}
            >
              {characterImageUrl ? (
                <img src={characterImageUrl} alt="Character Anchor" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="size-6 text-muted-foreground" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {characterImageUrl ? (
                <div className="flex items-center gap-2">
                  <span className="text-primary">Photo loaded</span>
                  <button type="button" onClick={() => setCharacterImageUrl(null)} className="hover:text-destructive p-1">
                    <X className="size-3" />
                  </button>
                </div>
              ) : (
                "Click to upload artist photo"
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex justify-between">
            <span>Reference Images</span>
            <span>{referenceImages.length}/6</span>
          </label>
          
          <input 
            type="file" 
            accept="image/*" 
            multiple
            className="hidden" 
            ref={refInputRef}
            onChange={handleRefUpload} 
          />

          <div 
            className="grid grid-cols-3 gap-2"
          >
            {referenceImages.map((src, i) => (
              <div key={i} className="aspect-[3/4] rounded-md overflow-hidden relative group">
                <img src={src} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeRefImage(i)}
                  className="absolute top-1 right-1 size-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                >
                  <X className="size-3 text-white" />
                </button>
              </div>
            ))}
            
            {referenceImages.length < 6 && (
              <div 
                onClick={() => refInputRef.current?.click()}
                className="aspect-[3/4] rounded-md bg-card/50 border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors gap-1"
              >
                <Upload className="size-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Upload</span>
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="p-4 border-t border-border shrink-0">
        <Button className="w-full" onClick={handleSave}>Save brief</Button>
      </div>
    </div>
  );
}
