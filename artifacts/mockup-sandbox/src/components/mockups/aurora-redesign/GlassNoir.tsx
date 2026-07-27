import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Aperture, 
  Video, 
  Mic2, 
  Film, 
  Smartphone, 
  Sparkles, 
  ArrowRight,
  Settings,
  ChevronRight,
  Play
} from 'lucide-react';

export function GlassNoir() {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  const tools = [
    { id: 'colors', name: 'Colors', desc: 'Performance photos', credits: 2, icon: Aperture, color: 'rgba(0, 122, 255, 0.5)' },
    { id: 'motion', name: 'Motion', desc: 'Cinematic videos', credits: 10, icon: Video, color: 'rgba(168, 85, 247, 0.5)' },
    { id: 'lipsync', name: 'Lip Sync', desc: 'Synced video', credits: 8, icon: Mic2, color: 'rgba(236, 72, 153, 0.5)' },
    { id: 'musicvideo', name: 'Music Video', desc: 'Full production', credits: 12, icon: Film, color: 'rgba(234, 179, 8, 0.5)' },
    { id: 'tiktok30', name: 'TikTok30 UGC', desc: 'Campaign batch', credits: 6, icon: Smartphone, color: 'rgba(34, 197, 94, 0.5)' }
  ];

  const projects = [
    { id: 1, name: 'Neon Stage Session', type: 'Colors', image: '/__mockup/images/neon-stage.jpg', time: '2h ago' },
    { id: 2, name: 'Warehouse Live', type: 'Motion', image: '/__mockup/images/warehouse-live.jpg', time: '5h ago' },
    { id: 3, name: 'Cyberpunk Single', type: 'Music Video', image: '/__mockup/images/cyberpunk-single.jpg', time: '1d ago' },
    { id: 4, name: 'Urban Promo', type: 'TikTok30 UGC', image: '/__mockup/images/urban-promo.jpg', time: '2d ago' },
    { id: 5, name: 'Tour Opener', type: 'Lip Sync', image: '/__mockup/images/tour-opener.jpg', time: '3d ago' }
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-[#F0F0F0] font-['Inter'] relative overflow-hidden flex flex-col">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        
        .glass-panel {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(24px) saturate(1.8);
          -webkit-backdrop-filter: blur(24px) saturate(1.8);
          transition: all 0.3s ease;
        }
        
        .glass-panel:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.14);
        }

        .glass-nav {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(32px) saturate(2);
          -webkit-backdrop-filter: blur(32px) saturate(2);
        }

        .text-glow {
          text-shadow: 0 0 20px rgba(255,255,255,0.3);
        }
        
        .tool-glow {
          position: absolute;
          inset: -20px;
          border-radius: 32px;
          filter: blur(30px);
          opacity: 0;
          transition: opacity 0.4s ease;
          z-index: 0;
          pointer-events: none;
        }
        
        .tool-card:hover .tool-glow {
          opacity: 0.6;
        }
        
        /* Custom scrollbar for projects */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}} />

      {/* Background ambient glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[800px] h-[800px] rounded-full bg-[rgba(0,60,200,0.15)] blur-[120px] pointer-events-none" />

      {/* Top Nav Pill */}
      <header className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6">
        <div className="glass-nav rounded-full px-6 py-3 flex items-center justify-between w-full max-w-5xl shadow-2xl shadow-black/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-semibold tracking-wide text-lg text-glow">AURORA</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(0,122,255,0.1)] border border-[rgba(0,122,255,0.3)]">
              <Sparkles className="w-4 h-4 text-[#007AFF]" />
              <span className="font-medium text-[#007AFF]">250</span>
            </div>
            <button className="text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto pt-32 pb-40 px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 z-10">
        
        {/* Left: Tools Grid (Hero) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="mb-4">
            <h1 className="text-4xl font-semibold mb-2">Create</h1>
            <p className="text-[rgba(255,255,255,0.4)] text-lg">Select a studio tool to begin your session.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Top row: 2 large cards */}
            {tools.slice(0, 2).map((tool) => (
              <motion.div 
                key={tool.id}
                className="tool-card relative group cursor-pointer"
                onHoverStart={() => setHoveredTool(tool.id)}
                onHoverEnd={() => setHoveredTool(null)}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div className="tool-glow" style={{ background: tool.color }} />
                <div className="glass-panel relative z-10 h-48 rounded-3xl p-6 flex flex-col justify-between overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center group-hover:scale-110 group-hover:bg-[rgba(255,255,255,0.1)] transition-all duration-300">
                      <tool.icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="px-3 py-1 rounded-full bg-[rgba(255,255,255,0.05)] text-[11px] font-medium text-[rgba(255,255,255,0.6)] group-hover:text-[#007AFF] group-hover:bg-[rgba(0,122,255,0.1)] transition-colors">
                      {tool.credits} CR
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-medium mb-1">{tool.name}</h3>
                    <p className="text-[rgba(255,255,255,0.4)] text-sm">{tool.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Bottom row: 3 cards */}
            {tools.slice(2, 5).map((tool) => (
              <motion.div 
                key={tool.id}
                className="tool-card relative group cursor-pointer"
                onHoverStart={() => setHoveredTool(tool.id)}
                onHoverEnd={() => setHoveredTool(null)}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <div className="tool-glow" style={{ background: tool.color }} />
                <div className="glass-panel relative z-10 h-44 rounded-3xl p-5 flex flex-col justify-between overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-2xl bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center group-hover:scale-110 group-hover:bg-[rgba(255,255,255,0.1)] transition-all duration-300">
                      <tool.icon className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-[rgba(255,255,255,0.05)] text-[10px] font-medium text-[rgba(255,255,255,0.6)] group-hover:text-[#007AFF] group-hover:bg-[rgba(0,122,255,0.1)] transition-colors">
                      {tool.credits} CR
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[17px] font-medium mb-0.5">{tool.name}</h3>
                    <p className="text-[rgba(255,255,255,0.4)] text-[13px]">{tool.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right: Recent Projects */}
        <div className="lg:col-span-4 flex flex-col">
          <div className="mb-4 flex items-center justify-between mt-14 lg:mt-0">
            <h2 className="text-xl font-medium">Recent Projects</h2>
            <button className="text-sm text-[rgba(255,255,255,0.4)] hover:text-white transition-colors">
              View all
            </button>
          </div>
          
          <div className="glass-panel rounded-3xl p-2 flex-1 overflow-y-auto max-h-[500px]">
            <div className="flex flex-col gap-2">
              {projects.map((project, i) => (
                <div 
                  key={project.id} 
                  className="group relative p-3 rounded-2xl hover:bg-[rgba(255,255,255,0.04)] transition-all cursor-pointer flex items-center gap-4"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden relative flex-shrink-0 bg-black/40">
                    <img 
                      src={project.image} 
                      alt={project.name} 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" 
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white truncate">{project.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-[rgba(255,255,255,0.4)] px-2 py-0.5 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)]">
                        {project.type}
                      </span>
                      <span className="text-[11px] text-[rgba(255,255,255,0.25)]">
                        {project.time}
                      </span>
                    </div>
                  </div>
                  
                  <button className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] transition-all -translate-x-2 group-hover:translate-x-0">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-8 left-0 right-0 z-50 flex justify-center px-6 pointer-events-none">
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', damping: 20 }}
          className="w-full max-w-3xl pointer-events-auto"
        >
          <div className="glass-panel p-2 pl-6 rounded-[2rem] flex items-center shadow-2xl shadow-black/80">
            <input 
              type="text" 
              placeholder="Describe your project..." 
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-[rgba(255,255,255,0.25)] text-[15px]"
            />
            <button className="bg-[#007AFF] hover:bg-[#0066FF] text-white px-6 py-3 rounded-full font-medium text-sm transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(0,122,255,0.3)]">
              Generate
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>

    </div>
  );
}

export default GlassNoir;
