import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useGenerateUgc, 
  useGetGenerationStatus, 
  UgcInputAvatarStyle,
  UgcInputPlatform,
  getGetDashboardQueryKey,
  getGetGalleryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smartphone, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters"),
  productDescription: z.string().min(10, "Describe the product in detail"),
  productImageUrl: z.string().optional(),
  avatarStyle: z.nativeEnum(UgcInputAvatarStyle).default("lifestyle" as UgcInputAvatarStyle),
  platform: z.nativeEnum(UgcInputPlatform).default("tiktok" as UgcInputPlatform),
});

export default function UgcFactoryPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const generateUgc = useGenerateUgc();
  
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
      productDescription: "",
      productImageUrl: "",
      avatarStyle: "lifestyle",
      platform: "tiktok",
    },
  });

  const isGenerating = jobId && (!status || status.status === 'queued' || status.status === 'processing');

  useEffect(() => {
    if (status?.status === 'completed') {
      toast.success("UGC ad generated!");
      queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetGalleryQueryKey() });
    } else if (status?.status === 'failed') {
      toast.error(`Generation failed: ${status.errorMessage || 'Unknown error'}`);
      setJobId(null);
    }
  }, [status?.status, queryClient, status?.errorMessage]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    setJobId(null);
    
    generateUgc.mutate({ data: values }, {
      onSuccess: (data) => {
        setJobId(data.id);
        toast.info(`UGC ad queued. Estimated time: ${data.estimatedSeconds}s`);
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
            <Smartphone className="text-pink-500" size={28} />
            UGC Factory
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Generate organic-looking ads for social platforms.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 flex-1 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Target Platform</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input text-white">
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border text-white">
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="instagram">Instagram Reels</SelectItem>
                        <SelectItem value="youtube">YouTube Shorts</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Ad Script & Concept</FormLabel>
                    <FormControl>
                      <textarea 
                        className="flex w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-white shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[100px] resize-none" 
                        placeholder="Creator points at the product, acts surprised, then shows how to use it..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Product Description</FormLabel>
                    <FormControl>
                      <textarea 
                        className="flex w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-white shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none" 
                        placeholder="What are we selling? Describe features, benefits, branding..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="productImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white flex items-center gap-2">Product Image <span className="text-xs text-muted-foreground font-normal">(Optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="https://... (Product shot)" className="bg-background border-input text-white" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="avatarStyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Creator Style</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background border-input text-white">
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border text-white">
                        <SelectItem value="lifestyle">Lifestyle / Casual</SelectItem>
                        <SelectItem value="street">Street Style</SelectItem>
                        <SelectItem value="studio">Studio Setup</SelectItem>
                        <SelectItem value="unboxing">Unboxing Desk</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <button 
                type="submit" 
                disabled={isGenerating || generateUgc.isPending}
                className="w-full py-4 bg-pink-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-pink-600 transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:opacity-50 disabled:shadow-none"
              >
                {isGenerating || generateUgc.isPending ? (
                  <><Loader2 className="animate-spin" size={20} /> Filming...</>
                ) : (
                  <><Sparkles size={20} /> Generate UGC (8 Credits)</>
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
                className="absolute top-0 left-0 h-full bg-pink-500 transition-all duration-1000"
                style={{ width: `${(status?.progress || 0) * 100}%` }}
              />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 animate-pulse">Producing Content</h3>
            <p className="text-muted-foreground text-sm">
              Our virtual creator is filming your ad. Please wait.
            </p>
          </div>
        ) : status?.status === 'completed' && status.outputUrl ? (
          <div className="relative w-full h-full flex items-center justify-center group animate-in fade-in duration-1000">
            {/* Display vertical video wrapper since it's UGC */}
            <div className="aspect-[9/16] h-full max-h-[80vh] relative border border-border/50 rounded-lg overflow-hidden shadow-2xl">
              <video 
                src={status.outputUrl} 
                autoPlay 
                loop 
                controls 
                className="w-full h-full object-cover"
              />
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
            <Smartphone className="text-muted-foreground mb-4" size={64} />
            <h3 className="text-xl font-medium text-white mb-2">Awaiting Brief</h3>
            <p className="text-muted-foreground max-w-sm">
              Provide your product details and script to generate a platform-native video ad.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
