import React, { useState } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Mic2, 
  Film, 
  Smartphone, 
  ArrowUp, 
  Settings, 
  Paperclip, 
  PlayCircle, 
  Plus
} from 'lucide-react';

export function Agent() {
  const [prompt, setPrompt] = useState("");

  const tools = [
    { name: "Colors", icon: <ImageIcon size={18} />, credits: 2, desc: "Photos" },
    { name: "Motion", icon: <Video size={18} />, credits: 10, desc: "Cinematic" },
    { name: "Lip Sync", icon: <Mic2 size={18} />, credits: 8, desc: "Synced video" },
    { name: "Music Video", icon: <Film size={18} />, credits: 12, desc: "Production" },
    { name: "TikTok UGC", icon: <Smartphone size={18} />, credits: 6, desc: "Campaign" }
  ];

  const gallery = [
    { id: 1, title: "Neon Nights Tour Promo", type: "Colors", image: "/__mockup/images/agent-gallery-1.jpg", time: "2 hours ago" },
    { id: 2, title: "Warehouse Live Session", type: "Music Video", image: "/__mockup/images/agent-gallery-2.jpg", time: "Yesterday" },
    { id: 3, title: "Cyberpunk Single Teaser", type: "Lip Sync", image: "/__mockup/images/agent-gallery-3.jpg", time: "3 days ago" },
    { id: 4, title: "Urban Dance Challenge", type: "TikTok UGC", image: "/__mockup/images/agent-gallery-4.jpg", time: "1 week ago" }
  ];

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0A] text-white flex flex-col font-sans selection:bg-[#007AFF] selection:text-white overflow-x-hidden">
      {/* Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-5 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#007AFF] to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(0,122,255,0.3)]">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white/95">Aurora</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 transition-colors px-3 py-1.5 rounded-full cursor-pointer border border-white/5">
            <Sparkles size={14} className="text-[#007AFF]" />
            <span className="font-semibold text-sm text-white/90">250</span>
          </div>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors border border-white/5 text-white/60 hover:text-white">
            <Settings size={18} />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-500 to-[#007AFF] p-0.5 cursor-pointer ml-1 shadow-lg">
            <div className="w-full h-full bg-gradient-to-br from-[#1E1E1E] to-[#2A2A2A] rounded-full flex items-center justify-center text-xs font-bold text-white border border-[#0A0A0A]">
              AR
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center w-full max-w-5xl mx-auto px-6 pt-16 pb-32">
        
        {/* Welcome Section */}
        <div className="w-full text-center mb-10 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-semibold mb-4 tracking-tight text-white">
            What are we creating today?
          </h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Describe your vision in detail, or select a format to get started.
          </p>
        </div>

        {/* Input Area */}
        <div className="w-full max-w-3xl relative mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[#007AFF]/20 via-purple-500/20 to-[#007AFF]/20 blur-3xl rounded-3xl opacity-60"></div>
          
          <div className="relative bg-[#141414]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-2 shadow-2xl flex flex-col transition-all focus-within:border-white/25 focus-within:bg-[#1A1A1A] focus-within:shadow-[0_0_40px_rgba(0,122,255,0.1)]">
            <textarea 
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g. A cinematic 4K slow-motion sequence of a dancer under neon rain, moody cyberpunk lighting..."
              className="w-full bg-transparent border-none outline-none resize-none p-6 text-lg placeholder:text-white/30 text-white min-h-[140px] focus:ring-0 leading-relaxed"
            />
            
            <div className="flex items-center justify-between px-4 pb-3 pt-2">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors rounded-full border border-transparent hover:border-white/5">
                  <Paperclip size={16} />
                  <span>Attach reference</span>
                </button>
              </div>
              <button 
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  prompt.length > 0 
                    ? 'bg-[#007AFF] text-white shadow-[0_0_20px_rgba(0,122,255,0.4)] hover:bg-blue-500 hover:scale-105' 
                    : 'bg-white/5 text-white/30 cursor-not-allowed border border-white/5'
                }`}
              >
                <ArrowUp size={22} className={prompt.length > 0 ? "opacity-100" : "opacity-50"} />
              </button>
            </div>
          </div>
        </div>

        {/* Formats / Tools */}
        <div className="w-full max-w-4xl mb-24 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
          <div className="flex items-center gap-4 mb-5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-widest">Suggested Formats</h3>
            <div className="h-px bg-gradient-to-r from-white/10 to-transparent flex-1"></div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {tools.map((tool, i) => (
              <button 
                key={tool.name}
                onClick={() => setPrompt(prev => prev ? prev + ` [Format: ${tool.name}]` : `Generate a ${tool.name.toLowerCase()} `)}
                className="group flex flex-col items-start gap-4 bg-[#141414] hover:bg-[#1E1E1E] border border-white/5 hover:border-white/15 p-5 rounded-2xl transition-all duration-300 relative overflow-hidden"
              >
                {/* Subtle hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#007AFF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/50 group-hover:text-[#007AFF] group-hover:bg-[#007AFF]/10 transition-colors">
                    {tool.icon}
                  </div>
                  <div className="flex items-center gap-1 bg-[#0A0A0A] px-2.5 py-1 rounded-full border border-white/5 group-hover:border-[#007AFF]/20 transition-colors">
                    <Sparkles size={10} className="text-[#007AFF]" />
                    <span className="text-[11px] font-mono font-medium text-white/80">{tool.credits}</span>
                  </div>
                </div>
                
                <div className="text-left mt-2">
                  <div className="font-semibold text-[15px] text-white/90 group-hover:text-white">{tool.name}</div>
                  <div className="text-xs text-white/40 mt-1">{tool.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Gallery */}
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-10 duration-700 delay-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] text-white/70 font-medium">4</span>
            </div>
            <button className="text-sm font-medium text-[#007AFF] hover:text-blue-400 transition-colors flex items-center gap-1">
              View gallery
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* New Project Card */}
            <div className="group cursor-pointer flex flex-col justify-center items-center gap-3 rounded-2xl p-4 border-2 border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 transition-all aspect-[4/5]">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white transition-colors">
                <Plus size={24} />
              </div>
              <span className="text-sm font-medium text-white/40 group-hover:text-white/80">New Project</span>
            </div>

            {/* Gallery Items */}
            {gallery.map(item => (
              <div key={item.id} className="group cursor-pointer flex flex-col gap-3">
                <div className="aspect-[4/5] relative rounded-2xl overflow-hidden bg-[#141414] border border-white/5">
                  <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/20 to-transparent opacity-80 transition-opacity" />
                  
                  {item.type !== "Colors" && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-90 group-hover:scale-100 duration-300">
                      <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-xl">
                        <PlayCircle size={28} className="ml-1 opacity-80" />
                      </div>
                    </div>
                  )}

                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider text-white/90 border border-white/10 shadow-sm">
                    {item.type}
                  </div>
                </div>
                <div className="px-1.5">
                  <h3 className="font-medium text-white/90 truncate text-[14px] group-hover:text-white transition-colors">{item.title}</h3>
                  <p className="text-xs text-white/40 mt-1">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
