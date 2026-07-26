import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useGeneratePhoto, 
  useGetGenerationStatus, 
  PhotoInputStyle, 
  PhotoInputAspectRatio, 
  PhotoInputProvider,
  getGetDashboardQueryKey,
  getGetGalleryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Image as ImageIcon, Sparkles, Download, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  prompt: z.string().min(3, "Prompt must be at least 3 characters"),
  style: z.nativeEnum(PhotoInputStyle).default("cinematic" as PhotoInputStyle),
  aspectRatio: z.nativeEnum(PhotoInputAspectRatio).default("16:9" as PhotoInputAspectRatio),
  provider: z.nativeEnum(PhotoInputProvider).default("auto" as PhotoInputProvider),
  numImages: z.number().min(1).max(4).default(1),
  referenceImageUrl: z.string().optional(),
});

export default function ColorsStudioPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const generatePhoto = useGeneratePhoto();
  
  const { data: status, isError } = useGetGenerationStatus(
    jobId as string, 
    { 
      query: { 
        enabled: !!jobId && (jobId !== 'null'), 
        refetchInterval: (query) => {
          const currentStatus = query.state.data?.status;
          return (currentStatus === 'completed' || currentStatus === 'failed') ? false : 2000;
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
      aspectRatio: "16:9",
      provider: "auto",
      numImages: 1,
      referenceImageUrl: "",
    },
  });

  const isGenerating = jobId && (!status || status.status === 'queued' || status.status === 'processing');

  // Handle completion
  useEffect(() => {
    if (status?.status === 'completed') {
      toast.success("Photo generation complete!");
      // Invalidate to update dashboard credits and gallery
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGalleryQueryKey() });
    } else if (status?.status === 'failed') {
      toast.error(`Generation failed: ${status.errorMessage || 'Unknown error'}`);
      setJobId(null);
    }
  }, [status?.status, queryClient, status?.errorMessage]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    setJobId(null);
    generatePhoto.mutate({ data: values }, {
      onSuccess: (data) => {
        setJobId(data.id);
        toast.info(`Job queued. Estimated time: ${data.estimatedSeconds}s`);
        // Update credits
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to start generation");
      }
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto w-full h-full flex flex-col md:flex-row gap-8">
      {/* Left Column: Form */}
      <div className="w-full md:w-[400px] shrink-0 flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white flex items-center gap-3">
            <ImageIcon className="text-secondary" size={28} />
            Colors Studio
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Generate cinematic stills and performance photography.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 flex-1 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Creative Prompt</FormLabel>
                    <FormControl>
                      <textarea 
                        className="flex w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-white shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[120px] resize-none" 
                        placeholder="A neon-lit pop artist performing on stage, deep violet and magenta lighting, atmospheric fog..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
                          <SelectItem value="cinematic">Cinematic</SelectItem>
                          <SelectItem value="editorial">Editorial</SelectItem>
                          <SelectItem value="performance">Performance</SelectItem>
                          <SelectItem value="concert">Concert</SelectItem>
                          <SelectItem value="portrait">Portrait</SelectItem>
                          <SelectItem value="studio">Studio</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="aspectRatio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Aspect Ratio</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background border-input text-white">
                            <SelectValue placeholder="Select ratio" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover border-border text-white">
                          <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                          <SelectItem value="9:16">9:16 (Vertical)</SelectItem>
                          <SelectItem value="1:1">1:1 (Square)</SelectItem>
                          <SelectItem value="4:3">4:3</SelectItem>
                          <SelectItem value="3:4">3:4</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="referenceImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white flex items-center gap-2">Reference Image <span className="text-xs text-muted-foreground font-normal">(Optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." className="bg-background border-input text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button 
                type="submit" 
                disabled={isGenerating || generatePhoto.isPending}
                className="w-full py-4 bg-secondary text-secondary-foreground font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/90 transition-all shadow-[0_0_20px_rgba(232,121,249,0.3)] disabled:opacity-50 disabled:shadow-none"
              >
                {isGenerating || generatePhoto.isPending ? (
                  <><Loader2 className="animate-spin" size={20} /> Processing...</>
                ) : (
                  <><Sparkles size={20} /> Generate Photo (2 Credits)</>
                )}
              </button>
            </form>
          </Form>
        </div>
      </div>

      {/* Right Column: Output */}
      <div className="flex-1 bg-black/40 rounded-3xl border border-border overflow-hidden relative flex flex-col items-center justify-center p-8 min-h-[400px]">
        {isGenerating ? (
          <div className="text-center flex flex-col items-center max-w-sm">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 border-4 border-secondary/20 rounded-full"></div>
              <div 
                className="absolute inset-0 border-4 border-secondary rounded-full border-t-transparent animate-spin" 
                style={{ animationDuration: '3s' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white">
                {status?.progress ? `${Math.round(status.progress * 100)}%` : '...'}
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 animate-pulse">Rendering Masterpiece</h3>
            <p className="text-muted-foreground text-sm">
              Our models are processing your request. This usually takes 10-20 seconds.
            </p>
          </div>
        ) : status?.status === 'completed' && status.outputUrl ? (
          <div className="relative w-full h-full flex items-center justify-center group animate-in fade-in zoom-in duration-700">
            <img 
              src={status.outputUrl} 
              alt="Generated result" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <a 
                href={status.outputUrl} 
                download
                target="_blank"
                rel="noreferrer"
                className="p-4 bg-background/80 backdrop-blur border border-border text-white rounded-full hover:bg-primary transition-colors flex items-center justify-center shadow-xl"
              >
                <Download size={24} />
              </a>
            </div>
          </div>
        ) : status?.status === 'failed' || isError ? (
          <div className="text-center flex flex-col items-center">
            <AlertCircle className="text-destructive mb-4" size={48} />
            <h3 className="text-xl font-bold text-white mb-2">Generation Failed</h3>
            <p className="text-muted-foreground">{status?.errorMessage || 'An unknown error occurred during generation.'}</p>
          </div>
        ) : (
          <div className="text-center flex flex-col items-center opacity-40">
            <ImageIcon className="text-muted-foreground mb-4" size={64} />
            <h3 className="text-xl font-medium text-white mb-2">Awaiting Prompt</h3>
            <p className="text-muted-foreground max-w-sm">
              Configure your shot on the left and click generate to see the magic happen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
