import React from "react";
import { Link } from "wouter";
import { ChevronRight, Play, Image as ImageIcon, Video, Mic, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="relative h-[90vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero-bg.jpg" 
            alt="Cinematic Performance" 
            className="w-full h-full object-cover object-center scale-105 animate-in fade-in zoom-in duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
        </div>
        
        <div className="container mx-auto px-6 relative z-10 flex flex-col items-center md:items-start text-center md:text-left pt-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6 animate-in slide-in-from-bottom-4 duration-700 delay-100">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
            <span className="text-xs font-medium text-white/80 uppercase tracking-wider">Aurora Studio v1.0 Live</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-white tracking-tighter leading-[1.1] max-w-4xl animate-in slide-in-from-bottom-8 duration-700 delay-200">
            Direct your <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-accent italic pr-4">
              masterpiece.
            </span>
          </h1>
          
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl animate-in slide-in-from-bottom-8 duration-700 delay-300">
            The AI creative suite built for artists and labels. Generate cinematic performance shots, music-video stills, and lip-sync clips from a single selfie.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 animate-in slide-in-from-bottom-8 duration-700 delay-500">
            <Link 
              href="/sign-up" 
              className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary/90 hover:scale-105 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all duration-300"
            >
              Enter the Studio <ChevronRight size={18} />
            </Link>
            <Link 
              href="/pricing" 
              className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white border border-white/10 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-all duration-300"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y border-border bg-background">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-8">Trusted by independent creators & labels</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale">
            <span className="font-serif text-2xl font-bold">SONIC</span>
            <span className="font-serif text-2xl font-bold italic">NEXUS</span>
            <span className="font-serif text-2xl font-bold tracking-widest">RECORDS</span>
            <span className="font-serif text-2xl font-bold">ELEVATE</span>
            <span className="font-serif text-2xl font-bold">WAVEFORM</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 md:py-32 relative">
        <div className="container mx-auto px-6">
          <div className="mb-16 md:mb-24 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6">A complete production pipeline on your laptop.</h2>
            <p className="text-muted-foreground text-lg">Every tool you need to build your visual identity, powered by industry-leading generative models.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Feature 1 */}
            <div className="group relative overflow-hidden rounded-3xl bg-card border border-border p-8 md:p-12 hover:border-primary/50 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center mb-8">
                <Video className="text-primary" size={24} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Motion Studio</h3>
              <p className="text-muted-foreground mb-8">Bring static shots to life. Turn a single portrait into a dynamic 10-second cinematic video with advanced motion models.</p>
              <div className="aspect-video rounded-xl bg-background border border-border overflow-hidden relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] bg-cover bg-center opacity-40 blur-[2px]" />
                <div className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white z-10 group-hover:scale-110 transition-transform cursor-pointer">
                  <Play className="ml-1" size={24} fill="currentColor" />
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative overflow-hidden rounded-3xl bg-card border border-border p-8 md:p-12 hover:border-secondary/50 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="h-12 w-12 rounded-2xl bg-secondary/20 flex items-center justify-center mb-8">
                <ImageIcon className="text-secondary" size={24} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Colors Studio</h3>
              <p className="text-muted-foreground mb-8">Generate breathtaking performance photography, editorial magazine shoots, and concert stills matching your exact vision.</p>
              <div className="aspect-video rounded-xl bg-background border border-border overflow-hidden relative">
                <img src="/empty-gallery.jpg" alt="Colors Studio UI" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative overflow-hidden rounded-3xl bg-card border border-border p-8 md:p-12 hover:border-accent/50 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center mb-8">
                <Mic className="text-accent" size={24} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Lip Sync</h3>
              <p className="text-muted-foreground">Upload a video clip and an audio track, and watch as our models perfectly sync the subject's mouth to the vocals. Flawless execution every time.</p>
            </div>

            {/* Feature 4 */}
            <div className="group relative overflow-hidden rounded-3xl bg-card border border-border p-8 md:p-12 hover:border-white/30 transition-colors">
               <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center mb-8">
                <Sparkles className="text-white" size={24} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">UGC Factory</h3>
              <p className="text-muted-foreground">Generate platform-native content for TikTok, Reels, and YouTube Shorts instantly. Just describe the product and pick an avatar style.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Dark immersive CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="container mx-auto px-6 relative z-10 text-center">
          <h2 className="text-4xl md:text-6xl font-serif font-bold text-white mb-8">Ready to step on stage?</h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">Get 100 free credits when you sign up. No credit card required.</p>
          <Link 
            href="/sign-up" 
            className="inline-flex px-10 py-5 bg-white text-black rounded-full font-bold text-lg hover:bg-gray-200 hover:scale-105 transition-all duration-300"
          >
            Create Your Account
          </Link>
        </div>
      </section>
    </div>
  );
}
