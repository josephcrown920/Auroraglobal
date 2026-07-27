import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wand2, Zap, PlaySquare, Video, Mic2, Smartphone, 
  Sparkles, History, Settings, User, Plus, Search, 
  ChevronRight, MoreVertical, LayoutGrid, Layers, Download
} from 'lucide-react';

export function Editor() {
  // state for active tool
  const [activeTool, setActiveTool] = useState<string | null>(null);

  return (
    <div className="h-[100dvh] w-full bg-[#0A0A0B] text-[#EDEDED] font-outfit overflow-hidden flex selection:bg-[#007AFF]/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .glass-panel {
          background: rgba(26, 26, 26, 0.6);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .tool-gradient {
          background: linear-gradient(180deg, rgba(30,30,30,0) 0%, rgba(10,10,11,1) 100%);
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      
      {/* LEFT RAIL */}
      <aside className="w-16 sm:w-20 border-r border-white/5 bg-[#0A0A0B] flex flex-col items-center py-6 justify-between z-20 shrink-0">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Logo Mark */}
          <button className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#00E5FF] flex items-center justify-center shadow-[0_0_20px_rgba(0,122,255,0.3)] transition-transform hover:scale-105">
            <Sparkles className="w-5 h-5 text-white" />
          </button>
          
          <nav className="flex flex-col items-center gap-4 w-full">
            <RailItem icon={<LayoutGrid />} label="Studio" active />
            <RailItem icon={<History />} label="Gallery" />
            <RailItem icon={<Layers />} label="Assets" />
          </nav>
        </div>
        
        <div className="flex flex-col items-center gap-4 w-full">
          <RailItem icon={<Settings />} label="Settings" />
          <div className="w-8 h-8 rounded-full bg-[#1A1A1C] border border-white/20 overflow-hidden cursor-pointer hover:border-white/40 transition-colors flex items-center justify-center">
            <span className="text-xs font-medium text-white/80">AU</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative min-w-0">
        
        {/* TOP HEADER */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 z-20 bg-[#0A0A0B] shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-medium text-white/60 flex items-center gap-2 tracking-wide">
              <span>Workspace</span>
              <ChevronRight className="w-3 h-3 text-white/30" />
              <span className="text-white">Untitled Project</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-5">
            {/* Credit Balance */}
            <div className="flex items-center gap-2 bg-[#141415] border border-white/10 rounded-full pl-1 pr-4 py-1 cursor-pointer hover:bg-white/5 transition-colors">
              <div className="w-7 h-7 rounded-full bg-[#1A1A1C] flex items-center justify-center shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-[#007AFF]" />
              </div>
              <span className="font-space text-sm font-semibold tracking-tight text-white/90">250</span>
            </div>
            
            <button className="h-9 px-4 bg-[#007AFF] hover:bg-[#0066D6] text-white text-sm font-medium rounded-md transition-colors shadow-[0_0_15px_rgba(0,122,255,0.2)]">
              Export
            </button>
          </div>
        </header>

        {/* EDITOR STAGE & RIGHT PANEL WRAPPER */}
        <div className="flex-1 flex overflow-hidden bg-[#111112]">
          
          {/* CENTER STAGE / CANVAS */}
          <section className="flex-1 flex flex-col relative min-w-0">
            {/* Grid background for canvas feel */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] pointer-events-none" />
            
            <div className="flex-1 flex items-center justify-center p-8 z-10 overflow-hidden">
              <div className="max-w-3xl w-full text-center">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-12"
                >
                  <h2 className="text-3xl font-semibold mb-3 tracking-tight text-white/90">What are we producing today?</h2>
                  <p className="text-white/40 text-sm">Select a medium to initialize the canvas environment.</p>
                </motion.div>

                {/* FLOATING TOOLS BAR */}
                <div className="glass-panel rounded-2xl p-2 inline-flex items-center gap-1 sm:gap-2 shadow-2xl shadow-black/50 overflow-x-auto max-w-full scrollbar-hide">
                  <ToolButton 
                    id="colors"
                    icon={<Wand2 className="w-5 h-5" />} 
                    label="Colors" 
                    desc="Photos" 
                    cost={2} 
                    active={activeTool === 'colors'}
                    onClick={() => setActiveTool('colors')}
                  />
                  <div className="w-px h-10 bg-white/10 mx-1 shrink-0" />
                  <ToolButton 
                    id="tiktok"
                    icon={<Smartphone className="w-5 h-5" />} 
                    label="TikTok30" 
                    desc="UGC Batches" 
                    cost={6} 
                    active={activeTool === 'tiktok'}
                    onClick={() => setActiveTool('tiktok')}
                  />
                  <div className="w-px h-10 bg-white/10 mx-1 shrink-0" />
                  <ToolButton 
                    id="lipsync"
                    icon={<Mic2 className="w-5 h-5" />} 
                    label="Lip Sync" 
                    desc="Synced Videos" 
                    cost={8} 
                    active={activeTool === 'lipsync'}
                    onClick={() => setActiveTool('lipsync')}
                  />
                  <div className="w-px h-10 bg-white/10 mx-1 shrink-0" />
                  <ToolButton 
                    id="motion"
                    icon={<PlaySquare className="w-5 h-5" />} 
                    label="Motion" 
                    desc="Cinematic" 
                    cost={10} 
                    active={activeTool === 'motion'}
                    onClick={() => setActiveTool('motion')}
                  />
                  <div className="w-px h-10 bg-white/10 mx-1 shrink-0" />
                  <ToolButton 
                    id="musicvideo"
                    icon={<Video className="w-5 h-5" />} 
                    label="Music Video" 
                    desc="Full Production" 
                    cost={12} 
                    active={activeTool === 'musicvideo'}
                    onClick={() => setActiveTool('musicvideo')}
                  />
                </div>
              </div>
            </div>
            
            {/* Bottom Timeline / Status Bar area (empty for now, gives editor feel) */}
            <div className="h-10 sm:h-12 border-t border-white/5 bg-[#0A0A0B] flex items-center px-4 justify-between text-[10px] sm:text-xs text-white/30 z-20 shrink-0 font-space tracking-wide">
              <div className="flex gap-4">
                <span>1920×1080</span>
                <span className="hidden sm:inline">30 FPS</span>
                <span>00:00:00:00</span>
              </div>
              <div className="flex gap-3">
                <span className="hover:text-white/60 cursor-pointer">Fit</span>
                <span className="hover:text-white/60 cursor-pointer">100%</span>
              </div>
            </div>
          </section>

          {/* RIGHT PANEL: Recent Projects or Tool Settings */}
          <aside className="w-72 sm:w-80 border-l border-white/5 bg-[#0A0A0B] flex flex-col z-20 shrink-0">
            {activeTool ? (
              <ToolSettingsPanel tool={activeTool} onClose={() => setActiveTool(null)} />
            ) : (
              <div className="flex-1 flex flex-col h-full">
                <div className="h-14 border-b border-white/5 flex items-center justify-between px-5 shrink-0">
                  <h3 className="font-medium text-sm text-white/80">Recent Projects</h3>
                  <button className="text-white/40 hover:text-white p-1 rounded transition-colors">
                    <Search className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                  <ProjectCard 
                    title="Neon Pop Singer" 
                    type="Colors" 
                    date="2 hrs ago" 
                    image="/__mockup/images/aurora-proj-1.jpg" 
                  />
                  <ProjectCard 
                    title="Club DJ Set" 
                    type="Motion" 
                    date="5 hrs ago" 
                    image="/__mockup/images/aurora-proj-2.jpg" 
                  />
                  <ProjectCard 
                    title="Indie Rock Live" 
                    type="Music Video" 
                    date="Yesterday" 
                    image="/__mockup/images/aurora-proj-3.jpg" 
                  />
                  <ProjectCard 
                    title="Cyberpunk Dancer" 
                    type="TikTok30" 
                    date="2 days ago" 
                    image="/__mockup/images/aurora-proj-4.jpg" 
                  />
                  <ProjectCard 
                    title="Avant-garde Promo" 
                    type="Colors" 
                    date="3 days ago" 
                    image="/__mockup/images/aurora-proj-5.jpg" 
                  />
                  
                  {/* Create New Card */}
                  <div className="h-24 rounded-lg border border-white/5 border-dashed bg-white/[0.02] hover:bg-white/[0.04] transition-colors flex items-center justify-center cursor-pointer group mt-4">
                    <div className="flex flex-col items-center gap-2 text-white/40 group-hover:text-[#007AFF] transition-colors">
                      <Plus className="w-5 h-5" />
                      <span className="text-xs font-medium">New Project</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
          
        </div>
      </main>
    </div>
  );
}

// ---------------------------
// SUB-COMPONENTS
// ---------------------------

function RailItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div className="relative group w-full flex justify-center">
      <button 
        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
          active ? 'bg-[#007AFF]/10 text-[#007AFF]' : 'text-white/40 hover:text-white hover:bg-white/5'
        }`}
      >
        {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5 stroke-[1.5]' })}
      </button>
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#007AFF] rounded-r-full" />
      )}
      
      {/* Tooltip */}
      <div className="absolute left-16 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-[#1A1A1C] border border-white/10 rounded-md text-xs font-medium text-white/90 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
        {label}
      </div>
    </div>
  );
}

function ToolButton({ 
  id, icon, label, desc, cost, active, onClick 
}: { 
  id: string, icon: React.ReactNode, label: string, desc: string, cost: number, active: boolean, onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick}
      className={`relative px-3 sm:px-4 py-3 rounded-xl flex flex-col items-center gap-2 min-w-[90px] sm:min-w-[100px] transition-all duration-300 shrink-0 ${
        active 
          ? 'bg-[#1A1A1C] border-white/10 shadow-lg scale-105' 
          : 'hover:bg-white/5 border-transparent'
      } border`}
    >
      <div className={`${active ? 'text-[#007AFF]' : 'text-white/60'}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6 stroke-[1.5]' })}
      </div>
      <div className="text-center">
        <div className={`text-sm font-medium ${active ? 'text-white' : 'text-white/80'}`}>{label}</div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider mt-0.5">{desc}</div>
      </div>
      
      <div className={`absolute -top-2.5 -right-2.5 bg-[#0A0A0B] border border-white/10 rounded-full px-2 py-0.5 flex items-center gap-1 shadow-md transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`}>
        <Sparkles className="w-2.5 h-2.5 text-[#007AFF]" />
        <span className="font-space text-xs font-medium text-white/90">{cost}</span>
      </div>
    </button>
  );
}

function ProjectCard({ title, type, date, image }: { title: string, type: string, date: string, image: string }) {
  return (
    <div className="group relative rounded-lg overflow-hidden border border-white/5 bg-[#141415] hover:border-white/20 transition-all cursor-pointer h-20 sm:h-24 flex">
      <div className="w-20 sm:w-24 shrink-0 h-full bg-[#1A1A1C] overflow-hidden relative">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
          onError={(e) => {
            // Fallback if image not generated yet
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFjIi8+PC9zdmc+';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#141415] opacity-50" />
      </div>
      <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
        <div>
          <h4 className="text-sm font-medium text-white/90 truncate">{title}</h4>
          <span className="text-[10px] text-[#007AFF] font-medium tracking-wide uppercase mt-0.5 block">{type}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/40">{date}</span>
          <button className="text-white/20 hover:text-white/80 transition-colors">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolSettingsPanel({ tool, onClose }: { tool: string, onClose: () => void }) {
  
  const getToolDetails = () => {
    switch(tool) {
      case 'colors': return { name: 'Colors', cost: 2, icon: <Wand2 /> };
      case 'tiktok': return { name: 'TikTok30', cost: 6, icon: <Smartphone /> };
      case 'lipsync': return { name: 'Lip Sync', cost: 8, icon: <Mic2 /> };
      case 'motion': return { name: 'Motion', cost: 10, icon: <PlaySquare /> };
      case 'musicvideo': return { name: 'Music Video', cost: 12, icon: <Video /> };
      default: return { name: 'Tool', cost: 0, icon: <Settings /> };
    }
  };

  const details = getToolDetails();

  return (
    <div className="flex-1 flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-5 shrink-0 bg-[#0A0A0B]">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-white/40 hover:text-white mr-1 -ml-1 transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="text-[#007AFF] w-4 h-4">{React.cloneElement(details.icon as React.ReactElement, { className: 'w-full h-full' })}</div>
          <h3 className="font-medium text-sm text-white/90">{details.name}</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-white/70">
          <Sparkles className="w-3 h-3 text-[#007AFF]" />
          <span className="font-space">{details.cost}</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 scrollbar-hide space-y-6">
        
        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-white/50 tracking-wider">PROMPT</label>
          <textarea 
            className="w-full h-32 bg-[#141415] border border-white/10 rounded-lg p-3 text-sm text-white/90 focus:outline-none focus:border-[#007AFF]/50 focus:ring-1 focus:ring-[#007AFF]/50 resize-none placeholder:text-white/20 transition-all"
            placeholder="Describe your vision..."
          ></textarea>
        </div>

        {/* References */}
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-white/50 tracking-wider">REFERENCES</label>
          <div className="grid grid-cols-3 gap-2">
            <div className="aspect-square rounded-md border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 hover:border-white/30 hover:bg-white/5 transition-colors cursor-pointer text-white/40">
              <Plus className="w-4 h-4" />
              <span className="text-[10px]">Add Image</span>
            </div>
          </div>
        </div>
        
        {/* Settings depending on tool */}
        {(tool === 'colors' || tool === 'motion' || tool === 'tiktok') && (
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-white/50 tracking-wider">ASPECT RATIO</label>
            <div className="grid grid-cols-3 gap-2">
              {['1:1', '16:9', '9:16'].map(ratio => (
                <button key={ratio} className={`py-2 rounded-md text-xs font-medium border transition-colors ${ratio === '16:9' ? 'bg-[#007AFF]/10 border-[#007AFF]/30 text-[#007AFF]' : 'bg-[#141415] border-white/5 text-white/60 hover:bg-white/5 hover:text-white'}`}>
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        )}

        {(tool === 'motion' || tool === 'lipsync' || tool === 'musicvideo') && (
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-white/50 tracking-wider">AUDIO TRACK</label>
            <div className="h-12 bg-[#141415] border border-white/10 rounded-lg flex items-center justify-between px-3 cursor-pointer hover:border-white/30 hover:bg-white/[0.02] transition-colors group">
              <div className="flex items-center gap-2 text-white/40 group-hover:text-white/60">
                <Mic2 className="w-4 h-4" />
                <span className="text-sm">Select audio file...</span>
              </div>
              <Plus className="w-4 h-4 text-white/20 group-hover:text-white/40" />
            </div>
          </div>
        )}

      </div>

      <div className="p-5 border-t border-white/5 bg-[#0A0A0B]">
        <button className="w-full h-10 bg-[#007AFF] hover:bg-[#0066D6] text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,122,255,0.2)] transition-all hover:shadow-[0_0_25px_rgba(0,122,255,0.4)] hover:-translate-y-0.5 active:translate-y-0">
          <Sparkles className="w-4 h-4" />
          <span>Generate ({details.cost} Credits)</span>
        </button>
      </div>
    </div>
  );
}
