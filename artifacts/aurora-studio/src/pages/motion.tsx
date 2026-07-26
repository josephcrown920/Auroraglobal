import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useGenerateVideo, 
  useGetGenerationStatus, 
  VideoInputStyle, 
  VideoInputDuration, 
  VideoInputProvider,
  getGetDashboardQueryKey,
  getGetGalleryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Sparkles, Download, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  prompt: z.string().min(3, "Prompt must be at least 3 characters"),
  style: z.nativeEnum(VideoInputStyle).default("cinematic" as VideoInputStyle),
  duration: z.number().default(5),
  provider: z.nativeEnum(VideoInputProvider).default("kling" as VideoInputProvider),
  sourceImageUrl: z.string().optional(),
  motionReferenceUrl: z.string().optional(),
});

export default function MotionStudioPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const generateVideo = useGenerateVideo();
  
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
      style: "cinematic",
      duration: 5,
      provider: "kling",
      sourceImageUrl: "",
      motionReferenceUrl: "",
    },
  });

  const isGenerating = jobId && (!status || status.status === 'queued' || status.status === 'processing');

  useEffect(() => {
    if (status?.status === 'completed') {
      toast.success("Video generation complete!");
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGalleryQueryKey() });
    } else if (status?.status === 'failed') {
      toast.error(`Generation failed: ${status.errorMessage || 'Unknown error'}`);
      setJobId(null);
    }
  }, [status?.status, queryClient, status?.errorMessage]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    setJobId(null);
    // Coerce duration
    const payload = { ...values, duration: Number(values.duration) as 5 | 10 };
    
    generateVideo.mutate({ data: payload }, {
      onSuccess: (data) => {
        setJobId(data.id);
        toast.info(`Video queued. Estimated time: ${data.estimatedSeconds}s`);
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to start video generation");
      }
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full h-full flex flex-col md:flex-row gap-8">
      {/* Left Column: Form */}
      <div className="w-full md:w-[400px] shrink-0 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white flex items-center gap-3">
            <Video className="text-primary" size={28} />
            Motion Studio
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Bring images to life with cinematic motion models.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 flex-1 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Motion Prompt</FormLabel>
                    <FormControl>
                      <textarea 
                        className="flex w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-white shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px] resize-none" 
                        placeholder="Camera pans slowly around the subject as they turn their head to the light..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sourceImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white flex items-center gap-2">Source Image URL <span className="text-xs text-muted-foreground font-normal">(Optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="https://... (Start from an image)" className="bg-background border-input text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Duration</FormLabel>
                      <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-input text-white">
                            <SelectValue placeholder="Select length" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border text-white">
                          <SelectItem value="5">5 Seconds</SelectItem>
                          <SelectItem value="10">10 Seconds</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Style</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-input text-white">
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border text-white">
                          <SelectItem value="realistic">Realistic</SelectItem>
                          <SelectItem value="cinematic">Cinematic</SelectItem>
                          <SelectItem value="performance">Performance</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Engine</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input text-white">
                          <SelectValue placeholder="Select engine" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border text-white">
                        <SelectItem value="kling">Kling (High Quality)</SelectItem>
                        <SelectItem value="seedance">Seedance (Fast)</SelectItem>
                        <SelectItem value="fal">Fal (Experimental)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button 
                type="submit" 
                disabled={isGenerating || generateVideo.isPending}
                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] disabled:opacity-50 disabled:shadow-none"
              >
                {isGenerating || generateVideo.isPending ? (
                  <><Loader2 className="animate-spin" size={20} /> Rendering...</>
                ) : (
                  <><Sparkles size={20} /> Generate Video (10 Credits)</>
                )}
              </button>
            </form>
          </Form>
        </div>
      </div>

      {/* Right Column: Output */}
      <div className="flex-1 bg-black/60 rounded-3xl border border-border overflow-hidden relative flex flex-col items-center justify-center p-8 min-h-[400px]">
        {isGenerating ? (
          <div className="text-center flex flex-col items-center max-w-sm">
            <div className="w-full h-2 bg-background rounded-full mb-8 overflow-hidden relative">
              <div 
                className="absolute top-0 left-0 h-full bg-primary transition-all duration-1000"
                style={{ width: `${(status?.progress || 0) * 100}%` }}
              />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 animate-pulse">Rendering Video Sequence</h3>
            <p className="text-muted-foreground text-sm">
              Video generation can take several minutes depending on network load. Feel free to explore other tools while you wait.
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
            <Video className="text-muted-foreground mb-4" size={64} />
            <h3 className="text-xl font-medium text-white mb-2">Awaiting Instructions</h3>
            <p className="text-muted-foreground max-w-sm">
              Write a motion prompt and generate a high-quality video clip.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
