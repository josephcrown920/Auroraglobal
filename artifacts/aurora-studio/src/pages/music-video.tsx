import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useGenerateMusicVideo, 
  useGetGenerationStatus, 
  MusicVideoInputStyle,
  getGetDashboardQueryKey,
  getGetGalleryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Music, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters"),
  audioUrl: z.string().url("Must be a valid URL"),
  style: z.nativeEnum(MusicVideoInputStyle).default("performance" as MusicVideoInputStyle),
  beatSync: z.boolean().default(true),
});

export default function MusicVideoStudioPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const generateMV = useGenerateMusicVideo();
  
  const { data: status, isError } = useGetGenerationStatus(
    jobId as string, 
    { 
      query: { 
        enabled: !!jobId && (jobId !== 'null'), 
        refetchInterval: (query) => {
          const currentStatus = query.state.data?.status;
          return (currentStatus === 'completed' || currentStatus === 'failed') ? false : 3000;
        },
        queryKey: ['generationStatus', jobId]
      } 
    }
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
      audioUrl: "",
      style: "performance",
      beatSync: true,
    },
  });

  const isGenerating = jobId && (!status || status.status === 'queued' || status.status === 'processing');

  useEffect(() => {
    if (status?.status === 'completed') {
      toast.success("Music video complete!");
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGalleryQueryKey() });
    } else if (status?.status === 'failed') {
      toast.error(`Generation failed: ${status.errorMessage || 'Unknown error'}`);
      setJobId(null);
    }
  }, [status?.status, queryClient, status?.errorMessage]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    setJobId(null);
    
    generateMV.mutate({ data: values }, {
      onSuccess: (data) => {
        setJobId(data.id);
        toast.info(`Music video queued. Estimated time: ${data.estimatedSeconds}s`);
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to start generation");
      }
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full h-full flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-[400px] shrink-0 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white flex items-center gap-3">
            <Music className="text-cyan-500" size={28} />
            Music Video
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Generate AI music videos synchronized to your track.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 flex-1 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Director's Prompt</FormLabel>
                    <FormControl>
                      <textarea 
                        className="flex w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-white shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[120px] resize-none" 
                        placeholder="Describe the overall narrative, aesthetic, lighting, and camera moves..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="audioUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Track Audio URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://... (.mp3/.wav)" className="bg-background border-input text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="style"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Video Style</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input text-white">
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border text-white">
                        <SelectItem value="performance">Performance</SelectItem>
                        <SelectItem value="narrative">Narrative Story</SelectItem>
                        <SelectItem value="abstract">Abstract Visualizer</SelectItem>
                        <SelectItem value="lyric_video">Lyric Video Background</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="beatSync"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-border bg-background p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base text-white">Audio Beat Sync</FormLabel>
                      <div className="text-xs text-muted-foreground">Cut and pulse video to the beat</div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="data-[state=checked]:bg-cyan-500"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <button 
                type="submit" 
                disabled={isGenerating || generateMV.isPending}
                className="w-full py-4 bg-cyan-500 text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:shadow-none"
              >
                {isGenerating || generateMV.isPending ? (
                  <><Loader2 className="animate-spin" size={20} /> Producing...</>
                ) : (
                  <><Sparkles size={20} /> Generate Video (25 Credits)</>
                )}
              </button>
            </form>
          </Form>
        </div>
      </div>

      <div className="flex-1 bg-black/60 rounded-3xl border border-border overflow-hidden relative flex flex-col items-center justify-center p-8 min-h-[400px]">
        {isGenerating ? (
          <div className="text-center flex flex-col items-center max-w-sm">
            <div className="w-full h-2 bg-background rounded-full mb-8 overflow-hidden relative">
              <div 
                className="absolute top-0 left-0 h-full bg-cyan-500 transition-all duration-1000"
                style={{ width: `${(status?.progress || 0) * 100}%` }}
              />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 animate-pulse">Directing Masterpiece</h3>
            <p className="text-muted-foreground text-sm">
              Music videos are heavy compute tasks. This may take a few minutes to render.
            </p>
          </div>
        ) : status?.status === 'completed' && status.outputUrl ? (
          <div className="relative w-full h-full flex items-center justify-center group animate-in fade-in duration-1000">
            <video 
              src={status.outputUrl} 
              autoPlay 
              loop 
              controls 
              className="max-w-full max-h-full rounded-lg shadow-2xl border border-border/50"
            />
          </div>
        ) : status?.status === 'failed' || isError ? (
          <div className="text-center flex flex-col items-center">
            <AlertCircle className="text-destructive mb-4" size={48} />
            <h3 className="text-xl font-bold text-white mb-2">Generation Failed</h3>
            <p className="text-muted-foreground">{status?.errorMessage || 'An unknown error occurred during generation.'}</p>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center opacity-40">
            <Music className="text-muted-foreground mb-4" size={64} />
            <h3 className="text-xl font-medium text-white mb-2">Awaiting Track</h3>
            <p className="text-muted-foreground max-w-sm">
              Provide your audio track and creative direction to start the shoot.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
