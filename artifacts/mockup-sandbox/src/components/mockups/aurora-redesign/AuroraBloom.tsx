import React from 'react';
import { Camera, Film, Mic, Clapperboard, Smartphone, Sparkles, Home, Layers, Settings, FolderClosed, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const glassClass = "bg-[rgba(15,15,25,0.6)] border border-[rgba(180,180,255,0.12)] backdrop-blur-[20px]";

const tools = [
  { id: 'colors', name: 'Colors', desc: 'High-fidelity performance photos', credits: 2, icon: Camera, color: '#3b82f6' },
  { id: 'motion', name: 'Motion', desc: 'Cinematic video snippets', credits: 10, icon: Film, color: '#a855f7' },
  { id: 'lipsync', name: 'Lip Sync', desc: 'AI audio-synced video performance', credits: 8, icon: Mic, color: '#ec4899' },
  { id: 'musicvideo', name: 'Music Video', desc: 'Full-length track production', credits: 12, icon: Clapperboard, color: '#f59e0b' },
  { id: 'tiktok', name: 'TikTok30 UGC', desc: 'Campaign batch generation', credits: 6, icon: Smartphone, color: '#14b8a6' }
];

const projects = [
  { id: 1, name: "Neon Stage Session", type: "Motion", img: "/__mockup/images/aurora-proj1.jpg" },
  { id: 2, name: "Warehouse Live", type: "Colors", img: "/__mockup/images/aurora-proj2.jpg" },
  { id: 3, name: "Cyberpunk Single", type: "Lip Sync", img: "/__mockup/images/aurora-proj3.jpg" },
  { id: 4, name: "Urban Promo", type: "Music Video", img: "/__mockup/images/aurora-proj4.jpg" },
];

export function AuroraBloom() {
  return (
    <div className="w-full h-[100dvh] bg-[#08080E] flex overflow-hidden font-['Space_Grotesk'] relative text-white selection:bg-[#7B5EA7] selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
        
        @keyframes gradient-text {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-text {
          background: linear-gradient(to right, #7B5EA7, #00C9B1, #7B5EA7);
          background-size: 200% auto;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          animation: gradient-text 4s linear infinite;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
      
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-[#7B5EA7] rounded-full mix-blend-screen filter blur-[120px] opacity-30 pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[700px] h-[700px] bg-[#00C9B1] rounded-full mix-blend-screen filter blur-[120px] opacity-25 pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[20%] w-[900px] h-[900px] bg-[#3b82f6] rounded-full mix-blend-screen filter blur-[140px] opacity-20 pointer-events-none" />
      
      {/* Sidebar */}
      <div className={`w-[72px] h-full flex-shrink-0 flex flex-col items-center py-6 ${glassClass} z-20 border-l-0 border-t-0 border-b-0`}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7B5EA7] to-[#00C9B1] flex items-center justify-center shadow-[0_0_20px_rgba(0,201,177,0.4)] mb-8 cursor-pointer relative group">
          <Sparkles className="w-5 h-5 text-white" />
          <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        
        <nav className="flex flex-col gap-6 flex-1 mt-4">
          <button className="w-12 h-12 flex items-center justify-center rounded-xl bg-[rgba(255,255,255,0.1)] text-white hover:bg-[rgba(255,255,255,0.15)] transition-colors relative group">
            <Home className="w-5 h-5" />
            <div className="absolute left-0 w-1 h-6 bg-[#00C9B1] rounded-r-full shadow-[0_0_10px_rgba(0,201,177,0.8)]" />
          </button>
          <button className="w-12 h-12 flex items-center justify-center rounded-xl text-[rgba(255,255,255,0.5)] hover:text-white transition-colors">
            <FolderClosed className="w-5 h-5" />
          </button>
          <button className="w-12 h-12 flex items-center justify-center rounded-xl text-[rgba(255,255,255,0.5)] hover:text-white transition-colors">
            <Layers className="w-5 h-5" />
          </button>
          <button className="w-12 h-12 flex items-center justify-center rounded-xl text-[rgba(255,255,255,0.5)] hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </nav>

        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 border border-[rgba(255,255,255,0.2)] overflow-hidden cursor-pointer mt-4 hover:ring-2 ring-[#00C9B1] ring-offset-2 ring-offset-[#08080E] transition-all">
          <img src={`https://ui-avatars.com/api/?name=Artist&background=random&color=fff`} className="w-full h-full object-cover" alt="Artist Profile" />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto relative scrollbar-hide z-10 px-8 md:px-12 pb-12 pt-8">
        <div className="max-w-4xl mx-auto w-full">
          
          <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                <span className="text-white">Ready to </span>
                <span className="animate-gradient-text">create?</span>
              </h1>
              <p className="text-[rgba(255,255,255,0.5)] mt-2 text-lg">Select a tool to begin your next masterpiece.</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex items-center gap-4"
            >
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full ${glassClass}`}>
                <Sparkles className="w-4 h-4 text-[#00C9B1]" />
                <span className="text-white font-medium">250</span>
                <span className="text-[rgba(255,255,255,0.5)] text-sm">credits</span>
              </div>
              <button className="bg-gradient-to-r from-[#7B5EA7] to-[#00C9B1] text-white px-6 py-2.5 rounded-full font-medium shadow-[0_0_20px_rgba(0,201,177,0.3)] hover:shadow-[0_0_30px_rgba(0,201,177,0.5)] transition-shadow">
                Top Up
              </button>
            </motion.div>
          </header>

          <div className="flex flex-col gap-4">
            {tools.map((tool, index) => {
              const Icon = tool.icon;
              return (
                <motion.div 
                  key={tool.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + (index * 0.05) }}
                  className={`group flex flex-col md:flex-row md:items-center justify-between p-4 md:p-5 rounded-2xl ${glassClass} hover:bg-[rgba(25,25,40,0.8)] transition-all cursor-pointer overflow-hidden relative gap-4`}
                >
                  {/* Glow overlay */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" 
                    style={{ background: `radial-gradient(circle at center right, ${tool.color}10 0%, transparent 50%)` }} 
                  />
                  
                  <div className="flex items-center gap-5 md:gap-6 relative z-10 flex-1">
                    <div 
                      className="w-14 h-14 shrink-0 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.1)] transition-transform duration-300 group-hover:scale-110"
                      style={{ boxShadow: `0 0 20px ${tool.color}20` }}
                    >
                      <Icon className="w-6 h-6" style={{ color: tool.color }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white tracking-tight">{tool.name}</h3>
                      <p className="text-[rgba(255,255,255,0.5)] mt-0.5 text-sm md:text-base">{tool.desc}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 relative z-10 ml-19 md:ml-0 justify-between md:justify-end">
                    <div className="flex items-center gap-1.5 text-[rgba(255,255,255,0.6)]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="font-medium text-white">{tool.credits}</span>
                    </div>
                    <button className="flex items-center gap-2 bg-[rgba(255,255,255,0.08)] hover:bg-white hover:text-black text-white px-5 py-2.5 rounded-full font-medium transition-colors text-sm md:text-base">
                      Start <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 mb-8 relative z-10"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white tracking-tight">Recent Work</h2>
              <button className="text-[rgba(255,255,255,0.5)] hover:text-white transition-colors text-sm font-medium">
                View All
              </button>
            </div>
            
            <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide -mx-8 px-8 md:mx-0 md:px-0">
              {projects.map((proj, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + (i * 0.1) }}
                  key={proj.id} 
                  className="min-w-[260px] md:min-w-[280px] h-[160px] rounded-2xl overflow-hidden relative group cursor-pointer border border-[rgba(255,255,255,0.08)] shadow-lg"
                >
                  <img src={proj.img} alt={proj.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#08080E] via-[rgba(8,8,14,0.3)] to-transparent opacity-90 group-hover:opacity-70 transition-opacity" />
                  <div className={`absolute bottom-3 left-3 right-3 p-3 rounded-xl ${glassClass} translate-y-2 opacity-90 group-hover:translate-y-0 group-hover:opacity-100 transition-all border-[rgba(255,255,255,0.08)]`}>
                    <div className="text-white font-medium truncate text-sm">{proj.name}</div>
                    <div className="text-[rgba(255,255,255,0.5)] text-xs mt-0.5">{proj.type}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          
        </div>
      </div>
    </div>
  );
}
