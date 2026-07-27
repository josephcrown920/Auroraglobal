import React from "react";
import { 
  Home, 
  FolderOpen, 
  Settings, 
  Plus, 
  Image as ImageIcon, 
  Clapperboard, 
  Mic, 
  Film, 
  Smartphone,
  ChevronRight,
  Sparkles,
  Search,
  Bell
} from "lucide-react";

const TOOLS = [
  {
    id: "colors",
    name: "Colors",
    desc: "Performance photos",
    credits: 2,
    icon: <ImageIcon className="w-6 h-6" />,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    id: "motion",
    name: "Motion",
    desc: "Cinematic videos",
    credits: 10,
    icon: <Clapperboard className="w-6 h-6" />,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    id: "lipsync",
    name: "Lip Sync",
    desc: "Synced performance videos",
    credits: 8,
    icon: <Mic className="w-6 h-6" />,
    color: "bg-pink-500/10 text-pink-500",
  },
  {
    id: "musicvideo",
    name: "Music Video",
    desc: "Full video production",
    credits: 12,
    icon: <Film className="w-6 h-6" />,
    color: "bg-orange-500/10 text-orange-500",
  },
  {
    id: "tiktok",
    name: "TikTok30 UGC",
    desc: "Campaign batches",
    credits: 6,
    icon: <Smartphone className="w-6 h-6" />,
    color: "bg-green-500/10 text-green-500",
  },
];

const RECENT_PROJECTS = [
  {
    id: 1,
    title: "Neon Stage",
    type: "Colors",
    date: "2 hours ago",
    image: "/__mockup/images/aurora-project-1.jpg",
  },
  {
    id: 2,
    title: "Warehouse Dance",
    type: "Music Video",
    date: "Yesterday",
    image: "/__mockup/images/aurora-project-2.jpg",
  },
  {
    id: 3,
    title: "Urban Street",
    type: "TikTok30 UGC",
    date: "2 days ago",
    image: "/__mockup/images/aurora-project-3.jpg",
  },
  {
    id: 4,
    title: "Close-up Session",
    type: "Lip Sync",
    date: "3 days ago",
    image: "/__mockup/images/aurora-project-4.jpg",
  },
];

export function Hub() {
  return (
    <div className="min-h-screen bg-[#141414] text-white flex font-sans overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        .font-outfit {
          font-family: 'Outfit', sans-serif;
        }
        
        .glass-panel {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
        }
        
        .glass-panel:hover {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>

      {/* Sidebar - Calm and reduced */}
      <aside className="w-20 lg:w-64 border-r border-white/5 flex flex-col justify-between py-8 bg-[#1A1A1A]">
        <div>
          <div className="px-6 mb-12 flex items-center justify-center lg:justify-start">
            <div className="w-8 h-8 rounded-lg bg-[#007AFF] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="ml-3 font-outfit font-semibold tracking-wide text-lg hidden lg:block">AURORA</span>
          </div>
          
          <nav className="flex flex-col gap-2 px-3 lg:px-4">
            <button className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/10 text-white transition-colors group">
              <Home className="w-5 h-5 shrink-0" />
              <span className="font-outfit font-medium hidden lg:block">Home</span>
            </button>
            <button className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white transition-colors group">
              <FolderOpen className="w-5 h-5 shrink-0" />
              <span className="font-outfit font-medium hidden lg:block">Projects</span>
            </button>
            <button className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/50 hover:bg-white/5 hover:text-white transition-colors group">
              <Settings className="w-5 h-5 shrink-0" />
              <span className="font-outfit font-medium hidden lg:block">Settings</span>
            </button>
          </nav>
        </div>

        <div className="px-4">
          <div className="w-full flex items-center justify-center lg:justify-start gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors border border-transparent hover:border-white/5">
            <img 
              src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=transparent" 
              alt="User" 
              className="w-10 h-10 rounded-full bg-white/10 shrink-0"
            />
            <div className="hidden lg:block overflow-hidden">
              <p className="font-outfit font-medium text-sm truncate">Alex Rivera</p>
              <p className="text-xs text-white/40 truncate">Free Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {/* Topbar */}
        <header className="h-20 flex items-center justify-between px-8 lg:px-12 shrink-0 border-b border-white/5 bg-[#141414]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex-1"></div>
          
          <div className="flex items-center gap-6">
            <button className="text-white/50 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-[#007AFF] rounded-full border border-[#141414]"></span>
            </button>
            
            <div className="flex items-center gap-3 bg-white/5 rounded-full p-1 pr-4 border border-white/10">
              <div className="bg-[#007AFF]/20 text-[#007AFF] px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span className="font-outfit font-semibold text-sm">250</span>
              </div>
              <span className="text-sm font-outfit text-white/70">Credits</span>
              <div className="w-px h-4 bg-white/10 mx-1"></div>
              <button className="text-sm font-outfit text-[#007AFF] font-medium hover:text-white transition-colors">
                Add +
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 lg:p-12 max-w-7xl w-full mx-auto pb-24">
          <div className="mb-10">
            <h1 className="text-3xl font-outfit font-semibold mb-2">Create something new</h1>
            <p className="text-white/50 font-outfit text-lg">Select a tool to begin your next project.</p>
          </div>

          {/* Tools Grid - Big Primary Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-16">
            {TOOLS.map((tool) => (
              <button key={tool.id} className="glass-panel p-5 rounded-2xl flex flex-col items-start text-left group transition-all duration-300 hover:-translate-y-1">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${tool.color}`}>
                  {tool.icon}
                </div>
                <h3 className="font-outfit font-medium text-lg mb-1">{tool.name}</h3>
                <p className="text-sm text-white/40 font-outfit mb-6 line-clamp-2">{tool.desc}</p>
                <div className="mt-auto flex items-center justify-between w-full border-t border-white/5 pt-4">
                  <div className="flex items-center gap-1.5 text-xs font-outfit text-white/50 group-hover:text-white/80 transition-colors">
                    <Sparkles className="w-3 h-3 text-[#007AFF]" />
                    <span>{tool.credits} credits</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>

          {/* Recent Projects */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-outfit font-medium">Recent Projects</h2>
            <button className="text-sm font-outfit text-white/50 hover:text-white transition-colors flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {RECENT_PROJECTS.map((project) => (
              <div key={project.id} className="group cursor-pointer">
                <div className="aspect-[4/5] rounded-2xl overflow-hidden bg-white/5 mb-4 relative">
                  <img 
                    src={project.image} 
                    alt={project.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <button className="w-full py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg font-outfit text-sm font-medium transition-colors border border-white/10">
                      Open Project
                    </button>
                  </div>
                  <div className="absolute top-3 left-3 px-2 py-1 bg-black/50 backdrop-blur-md rounded-md border border-white/10 text-xs font-outfit text-white/80">
                    {project.type}
                  </div>
                </div>
                <h3 className="font-outfit font-medium truncate">{project.title}</h3>
                <p className="text-sm text-white/40 font-outfit">{project.date}</p>
              </div>
            ))}
          </div>
          
        </div>
      </main>
    </div>
  );
}
