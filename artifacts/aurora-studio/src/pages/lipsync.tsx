import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useGenerateLipsync, 
  useGetGenerationStatus, 
  LipsyncInputProvider,
  getGetDashboardQueryKey,
  getGetGalleryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  videoUrl: z.string().url("Must be a valid URL"),
  audioUrl: z.string().url("Must be a valid URL"),
  provider: z.nativeEnum(LipsyncInputProvider).default("auto" as LipsyncInputProvider),
});

export default function LipsyncStudioPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const generateLipsync = useGenerateLipsync();
  
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
      videoUrl: "",
      audioUrl: "",
      provider: "auto",
    },
  });

  const isGenerating = jobId && (!status || status.status === 'queued' || status.status === 'processing');

  useEffect(() => {
    if (status?.status === 'completed') {
      toast.success("Lip sync complete!");
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGalleryQueryKey() });
    } else if (status?.status === 'failed') {
      toast.error(`Generation failed: ${status.errorMessage || 'Unknown error'}`);
      setJobId(null);
    }
  }, [status?.status, queryClient, status?.errorMessage]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    setJobId(null);
    
    generateLipsync.mutate({ data: values }, {
      onSuccess: (data) => {
        setJobId(data.id);
        toast.info(`Lip sync queued. Estimated time: ${data.estimatedSeconds}s`);
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
            <Mic className="text-accent" size={28} />
            Lip Sync Studio
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Perfectly map vocal tracks to any face.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 flex-1 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Source Video URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://... (.mp4)" className="bg-background border-input text-white" {...field} />
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
                    <FormLabel className="text-white">Vocal Audio URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://... (.mp3/.wav)" className="bg-background border-input text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Processing Engine</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input text-white">
                          <SelectValue placeholder="Select engine" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border text-white">
                        <SelectItem value="auto">Auto (Recommended)</SelectItem>
                        <SelectItem value="sync">Sync Engine</SelectItem>
                        <SelectItem value="heygen">HeyGen Engine</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button 
                type="submit" 
                disabled={isGenerating || generateLipsync.isPending}
                className="w-full py-4 bg-accent text-accent-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-accent/90 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50 disabled:shadow-none"
              >
                {isGenerating || generateLipsync.isPending ? (
                  <><Loader2 className="animate-spin" size={20} /> Processing...</>
                ) : (
                  <><Sparkles size={20} /> Generate Sync (5 Credits)</>
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
                className="absolute top-0 left-0 h-full bg-accent transition-all duration-1000"
                style={{ width: `${(status?.progress || 0) * 100}%` }}
              />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 animate-pulse">Syncing Audio & Video</h3>
            <p className="text-muted-foreground text-sm">
              Analyzing phonemes and rendering face geometry. Please wait.
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
            <Mic className="text-muted-foreground mb-4" size={64} />
            <h3 className="text-xl font-medium text-white mb-2">Awaiting Source Material</h3>
            <p className="text-muted-foreground max-w-sm">
              Provide a video clip and an audio track to generate a synchronized result.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
