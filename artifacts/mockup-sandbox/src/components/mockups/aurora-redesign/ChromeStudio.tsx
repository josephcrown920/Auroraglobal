import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  MonitorPlay, 
  Image as ImageIcon, 
  FolderHeart, 
  Settings,
  Aperture,
  Video,
  Mic,
  Film,
  Smartphone,
  ChevronRight,
  Upload,
  User,
  Music
} from 'lucide-react';

const tools = [
  { id: 'Colors', icon: Aperture, label: 'Colors', cost: '2', desc: 'Performance photos' },
  { id: 'Motion', icon: Video, label: 'Motion', cost: '10', desc: 'Cinematic videos' },
  { id: 'Lip Sync', icon: Mic, label: 'Lip Sync', cost: '8', desc: 'Synced video' },
  { id: 'Music Video', icon: Film, label: 'Music Video', cost: '12', desc: 'Full production' },
  { id: 'TikTok30 UGC', icon: Smartphone, label: 'TikTok30 UGC', cost: '6', desc: 'Campaign batch' },
];

const projects = [
  { name: "Neon Stage Session", tool: "Colors", date: "2 hours ago", img: "/__mockup/images/chrome-neon-stage.jpg" },
  { name: "Warehouse Live", tool: "Motion", date: "5 hours ago", img: "/__mockup/images/chrome-warehouse-live.jpg" },
  { name: "Cyberpunk Single", tool: "Music Video", date: "Yesterday", img: "/__mockup/images/chrome-cyberpunk-single.jpg" },
  { name: "Urban Promo", tool: "TikTok30 UGC", date: "Oct 24", img: "/__mockup/images/chrome-urban-promo.jpg" },
  { name: "Tour Opener", tool: "Colors", date: "Oct 22", img: "/__mockup/images/chrome-tour-opener.jpg" },
];

const IconButton = ({ icon: Icon, tooltip, active = false }: { icon: any, tooltip: string, active?: boolean }) => (
  <div className="relative group flex justify-center w-full">
    <button className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
      active 
        ? 'bg-white/10 text-[#E8E8E8] shadow-[0_0_15px_rgba(255,255,255,0.05)] chrome-border' 
        : 'text-[#666680] hover:text-[#E8E8E8] hover:bg-white/5'
    }`}>
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
    </button>
    <div className="absolute left-[120%] bg-[#0C0C0E] chrome-border px-3 py-1.5 rounded-md text-xs font-medium text-[#E8E8E8] opacity-0 translate-x-[-10px] pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all z-50 whitespace-nowrap shadow-xl">
      {tooltip}
    </div>
  </div>
);

const ToolButton = ({ tool, active, onClick }: { tool: any, active: boolean, onClick: () => void }) => {
  const Icon = tool.icon;
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all relative overflow-hidden group ${
        active ? 'bg-[#007AFF]/20 text-[#007AFF]' : 'hover:bg-white/[0.04] text-[#666680] hover:text-[#E8E8E8]'
      }`}
    >
      {active && (
        <motion.div 
          layoutId="activeToolGlow"
          className="absolute inset-0 rounded-full border border-[#007AFF]/50 shadow-[0_0_20px_rgba(0,122,255,0.2)] pointer-events-none" 
        />
      )}
      <Icon size={16} className={`flex-shrink-0 ${active ? 'text-[#007AFF]' : ''}`} />
      <span>{tool.label}</span>
      <div className="flex items-center gap-0.5 opacity-70 ml-1">
        <span className="text-[10px] leading-none font-sans">✦</span>
        <span className="text-xs leading-none tabular-nums">{tool.cost}</span>
      </div>
    </button>
  );
};

const ProjectCard = ({ name, tool, date, img }: any) => (
  <div className="relative group w-full p-2.5 glass-panel chrome-border rounded-xl flex gap-3 items-center cursor-pointer hover:bg-white/[0.06] transition-colors duration-300">
    <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#0C0C0E] relative chrome-border">
      <img src={img} alt={name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500 scale-100 group-hover:scale-105" />
    </div>
    <div className="flex flex-col flex-1 min-w-0 justify-center">
      <h3 className="text-sm font-medium text-[#E8E8E8] truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-[#666680] transition-all">
        {name}
      </h3>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] uppercase tracking-wider text-[#007AFF] font-bold bg-[#007AFF]/15 px-1.5 py-0.5 rounded-sm leading-none">
          {tool}
        </span>
        <span className="text-[10px] text-[#666680] truncate font-medium">{date}</span>
      </div>
    </div>
  </div>
);

export default function ChromeStudio() {
  const [activeToolId, setActiveToolId] = useState('Colors');

  return (
    <div className="flex h-screen w-full bg-[#0C0C0E] text-[#E8E8E8] font-['DM_Sans'] overflow-hidden selection:bg-[#007AFF]/30">
      <style dangerouslySetInnerHTML={{__html: `
        .chrome-border {
          position: relative;
        }
        .chrome-border::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.08) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 10;
        }
        .glass-panel {
          background: rgba(20, 20, 24, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
        }
        .dot-grid {
          background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 24px 24px;
        }
        .chrome-shimmer {
          position: relative;
          overflow: hidden;
        }
        .chrome-shimmer::after {
          content: '';
          position: absolute;
          top: 0;
          left: -150%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          transform: skewX(-20deg);
          transition: all 0.7s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .chrome-shimmer:hover::after {
          left: 150%;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />

      {/* Left Rail */}
      <div className="w-[64px] h-full glass-panel flex flex-col items-center py-5 justify-between z-30 flex-shrink-0 border-r border-[#ffffff0a]">
        <div className="flex flex-col items-center gap-8 w-full">
          {/* Logo Mark */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#007AFF] to-[#0044FF] flex items-center justify-center text-white font-bold text-xl chrome-shimmer cursor-pointer shadow-[0_0_20px_rgba(0,122,255,0.3)] chrome-border">
            A
          </div>
          {/* Tools */}
          <div className="flex flex-col gap-3 w-full px-2">
            <IconButton icon={LayoutDashboard} tooltip="Dashboard" />
            <IconButton icon={MonitorPlay} tooltip="Studio" active />
            <IconButton icon={ImageIcon} tooltip="Gallery" />
            <IconButton icon={FolderHeart} tooltip="Assets" />
          </div>
        </div>
        <div className="flex flex-col gap-5 items-center w-full px-2">
          <IconButton icon={Settings} tooltip="Settings" />
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-gray-800 to-gray-600 chrome-border cursor-pointer flex items-center justify-center hover:scale-105 transition-transform">
            <User size={18} className="text-[#E8E8E8]/70" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative min-w-0">
        
        {/* Top Header */}
        <header className="h-[64px] w-full glass-panel flex items-center justify-between px-8 z-30 flex-shrink-0 border-b border-[#ffffff0a]">
          <div className="flex items-center gap-2 text-sm text-[#666680] font-medium">
            <span className="hover:text-[#E8E8E8] cursor-pointer transition-colors">Workspace</span>
            <ChevronRight size={14} className="opacity-50" />
            <span className="text-[#E8E8E8]">Untitled Project</span>
          </div>
          
          {/* Center Credit Badge */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-1.5 rounded-full glass-panel chrome-border text-sm font-semibold shadow-lg">
            <span className="text-[#007AFF] text-base leading-none">✦</span>
            <span className="tabular-nums tracking-wide text-[#E8E8E8]">250</span>
          </div>

          {/* Export Button */}
          <button className="bg-[#E8E8E8] hover:bg-white text-[#0C0C0E] px-5 py-2 rounded-full text-sm font-bold chrome-shimmer transition-colors">
            Export Project
          </button>
        </header>

        {/* Stage Area */}
        <div className="flex-1 flex w-full relative overflow-hidden">
          
          {/* Center Canvas */}
          <main className="flex-1 h-full dot-grid flex flex-col items-center justify-center p-8 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-[#0C0C0E]/50 via-transparent to-[#0C0C0E]/80 pointer-events-none" />
            
            <div className="flex flex-col w-full max-w-3xl items-center gap-10 z-10 -mt-12">
                <div className="text-center space-y-2">
                  <h1 className="text-4xl font-light tracking-tight text-white/90">Select a format to begin</h1>
                  <p className="text-[#666680] text-sm font-medium">Choose a tool to configure your generation</p>
                </div>
                
                {/* Horizontal Toolbar */}
                <div className="flex items-center gap-1 p-1.5 glass-panel chrome-border rounded-full shadow-2xl backdrop-blur-3xl bg-black/40">
                  {tools.map(t => (
                    <ToolButton 
                      key={t.id} 
                      tool={t} 
                      active={activeToolId === t.id} 
                      onClick={() => setActiveToolId(t.id)} 
                    />
                  ))}
                </div>

                {/* Active Form Panel */}
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={activeToolId}
                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="w-full glass-panel chrome-border rounded-3xl p-8 flex flex-col gap-6 shadow-2xl backdrop-blur-3xl bg-black/60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[#007AFF]">
                        {React.createElement(tools.find(t => t.id === activeToolId)?.icon || Aperture, { size: 24 })}
                        <h2 className="text-xl font-medium text-[#E8E8E8]">{activeToolId}</h2>
                      </div>
                      <span className="text-[#666680] text-sm bg-white/5 px-3 py-1 rounded-full">
                        {tools.find(t => t.id === activeToolId)?.desc}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] text-[#666680] uppercase tracking-[0.15em] font-bold">Prompt</label>
                      <textarea 
                        className="w-full bg-[#0C0C0E]/50 chrome-border rounded-xl p-4 text-[#E8E8E8] text-sm placeholder-[#666680] outline-none focus:ring-1 focus:ring-[#007AFF]/50 resize-none h-28 transition-all"
                        placeholder="Describe your vision in cinematic detail..."
                      />
                    </div>
                    
                    <div className="flex gap-4">
                      <div className="flex-1 flex flex-col gap-2">
                        <label className="text-[11px] text-[#666680] uppercase tracking-[0.15em] font-bold">Reference Input</label>
                        <div className="w-full h-24 bg-[#0C0C0E]/30 chrome-border rounded-xl border border-dashed border-[#ffffff15] flex flex-col items-center justify-center cursor-pointer hover:border-[#E8E8E8]/40 hover:bg-[#ffffff05] transition-all group">
                          <Upload size={18} className="text-[#666680] group-hover:text-[#E8E8E8] mb-1.5 transition-colors" />
                          <span className="text-[#666680] text-xs font-medium group-hover:text-[#E8E8E8] transition-colors">Upload Image</span>
                        </div>
                      </div>
                      
                      {(activeToolId === 'Lip Sync' || activeToolId === 'Music Video') && (
                        <motion.div 
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          className="flex-1 flex flex-col gap-2 overflow-hidden"
                        >
                          <label className="text-[11px] text-[#666680] uppercase tracking-[0.15em] font-bold whitespace-nowrap">Audio Track</label>
                          <div className="w-full h-24 bg-[#0C0C0E]/30 chrome-border rounded-xl border border-dashed border-[#ffffff15] flex flex-col items-center justify-center cursor-pointer hover:border-[#E8E8E8]/40 hover:bg-[#ffffff05] transition-all group min-w-[200px]">
                            <Music size={18} className="text-[#666680] group-hover:text-[#E8E8E8] mb-1.5 transition-colors" />
                            <span className="text-[#666680] text-xs font-medium group-hover:text-[#E8E8E8] transition-colors">Upload Audio</span>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    <div className="pt-2 flex justify-between items-center border-t border-[#ffffff0a] mt-2">
                      <div className="text-xs text-[#666680] font-medium">
                        Cost: <span className="text-[#007AFF]">✦ {tools.find(t => t.id === activeToolId)?.cost}</span>
                      </div>
                      <button className="bg-gradient-to-r from-[#007AFF] to-[#0055FF] hover:from-[#0066D6] hover:to-[#0044CC] text-white px-8 py-3 rounded-xl font-bold chrome-shimmer transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,122,255,0.3)] hover:shadow-[0_0_25px_rgba(0,122,255,0.5)]">
                        <span className="text-lg leading-none mt-[-2px]">✧</span> Generate
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
            </div>
          </main>

          {/* Right Panel */}
          <aside className="w-[340px] h-full glass-panel flex flex-col z-20 flex-shrink-0 border-l border-[#ffffff0a] shadow-[-20px_0_40px_rgba(0,0,0,0.3)]">
            <div className="p-6 border-b border-[#ffffff0a] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-[#E8E8E8]">Recent Projects</h2>
              <button className="text-[#666680] hover:text-[#E8E8E8] transition-colors">
                <Settings size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 custom-scrollbar">
              {projects.map(p => (
                <ProjectCard key={p.name} {...p} />
              ))}
              <div className="w-full mt-3 p-4 rounded-xl border border-dashed border-[#ffffff15] bg-[#ffffff02] flex items-center justify-center cursor-pointer hover:border-[#E8E8E8]/40 hover:bg-[#ffffff05] transition-all text-[#666680] hover:text-[#E8E8E8] text-sm font-semibold">
                + New Project
              </div>
            </div>
          </aside>

        </div>

        {/* Bottom Status Bar */}
        <footer className="h-[32px] w-full glass-panel border-t border-[#ffffff0a] flex items-center justify-between px-6 text-[10px] text-[#666680] uppercase tracking-[0.15em] font-bold z-30 flex-shrink-0">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Connected</span>
            <span className="opacity-40">|</span>
            <span className="text-[#E8E8E8]">1920×1080</span>
            <span className="opacity-40">|</span>
            <span>30fps</span>
            <span className="opacity-40">|</span>
            <span className="font-mono tabular-nums text-[#007AFF] tracking-wider text-[11px]">00:00:00:00</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-[#E8E8E8] cursor-pointer transition-colors text-[#E8E8E8]">Fit</span>
            <span className="hover:text-[#E8E8E8] cursor-pointer transition-colors">100%</span>
            <span className="hover:text-[#E8E8E8] cursor-pointer transition-colors">200%</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
