import { useGetGallery, useToggleFavorite, useDeleteGalleryItem } from "@workspace/api-client-react";
import { Heart, Trash2, Download, Image as ImageIcon, Video, Mic, RefreshCw } from "lucide-react";
import { useState } from "react";
import { queryClient } from "../lib/queryClient";

export default function GalleryPage() {
  const [filter, setFilter] = useState<string>("all");
  const { data: gallery, isLoading } = useGetGallery({ limit: 50 });
  const toggleFav = useToggleFavorite();
  const delItem = useDeleteGalleryItem();

  const filteredItems = gallery?.items.filter(item => {
    if (filter === "all") return true;
    if (filter === "favorites") return item.isFavorited;
    return item.type === filter;
  }) || [];

  const handleToggleFavorite = (id: string, current: boolean) => {
    toggleFav.mutate(
      { id, data: { favorited: !current } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
        }
      }
    );
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      delItem.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/gallery"] });
          }
        }
      );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#333333] pb-6">
        <div>
          <h1 className="text-4xl font-display font-semibold text-white">Gallery</h1>
          <p className="text-[#999999] mt-2">All your generated covers, motion reels, and performance clips.</p>
        </div>
        
        <div className="flex gap-2">
          {['all', 'photo', 'video', 'lipsync', 'favorites'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                filter === f 
                  ? 'bg-white text-[#1A1A1A]' 
                  : 'bg-[#2A2A2A] text-[#999999] border border-[#333333] hover:text-white hover:border-[#555555]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <RefreshCw className="size-6 animate-spin text-brand" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="aurora-card p-16 text-center border-dashed max-w-2xl mx-auto mt-12">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A] flex items-center justify-center mx-auto mb-6">
            <ImageIcon className="text-[#666666]" size={32} />
          </div>
          <h3 className="text-xl font-display font-semibold text-white mb-2">No items found</h3>
          <p className="text-[#999999] text-sm">
            {filter === "all" ? "You haven't generated anything yet." : `No items matching the filter '${filter}'.`}
          </p>
        </div>
      ) : (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          {filteredItems.map(item => (
            <div key={item.id} className="group relative break-inside-avoid aurora-card overflow-hidden">
              <div className="relative">
                {item.thumbnailUrl || item.outputUrl ? (
                  <img 
                    src={item.thumbnailUrl || item.outputUrl || ''} 
                    alt={item.type} 
                    className="w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="w-full aspect-square flex flex-col items-center justify-center bg-[#1A1A1A] p-6 text-center">
                    {item.type === 'photo' ? <ImageIcon className="text-[#666666] mb-3" size={32} /> : 
                     item.type === 'lipsync' ? <Mic className="text-[#666666] mb-3" size={32} /> :
                     <Video className="text-[#666666] mb-3" size={32} />}
                     <span className="text-xs font-mono text-[#666666]">Processing or Unavailable</span>
                  </div>
                )}
                
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-white border border-white/10">
                  {item.type}
                </div>

                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleToggleFavorite(item.id, !!item.isFavorited)}
                    className="p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-black"
                  >
                    <Heart size={14} className={item.isFavorited ? "fill-[#FF3B30] text-[#FF3B30]" : ""} />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white hover:bg-[#FF3B30] hover:border-[#FF3B30]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              
              <div className="p-4 border-t border-[#333333]">
                <p className="text-xs text-[#999999] line-clamp-2 mb-4 leading-relaxed font-mono">
                  {item.prompt || "No prompt provided."}
                </p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-[10px] text-[#666666]">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  {item.outputUrl && (
                    <a 
                      href={item.outputUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs font-medium text-brand hover:text-[#0051D5] flex items-center gap-1"
                    >
                      <Download size={14} /> Source
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
