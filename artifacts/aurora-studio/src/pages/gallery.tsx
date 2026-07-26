import React, { useState } from "react";
import { useGetGallery, useToggleFavorite, useDeleteGalleryItem, GalleryItemType } from "@workspace/api-client-react";
import { Heart, Download, Trash2, Loader2, Image as ImageIcon, Video, Mic, Music, Smartphone, AlertTriangle, Library } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetGalleryQueryKey, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function GalleryPage() {
  const [filterType, setFilterType] = useState<GalleryItemType | 'all'>('all');
  const [filterFavorites, setFilterFavorites] = useState(false);
  
  const queryClient = useQueryClient();
  const toggleFavMutation = useToggleFavorite();
  const deleteMutation = useDeleteGalleryItem();

  const { data: gallery, isLoading } = useGetGallery({
    type: filterType === 'all' ? undefined : filterType,
    favorited: filterFavorites ? true : undefined,
    limit: 50,
  }, { 
    query: {
      queryKey: getGetGalleryQueryKey({ type: filterType === 'all' ? undefined : filterType, favorited: filterFavorites ? true : undefined, limit: 50 })
    }
  });

  const handleToggleFavorite = (id: string, isFavorited: boolean) => {
    toggleFavMutation.mutate({ id, data: { favorited: !isFavorited } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetGalleryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      }
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this item? This cannot be undone.")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          toast.success("Item deleted");
          queryClient.invalidateQueries({ queryKey: getGetGalleryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        }
      });
    }
  };

  const getTypeIcon = (type: GalleryItemType) => {
    switch (type) {
      case 'photo': return <ImageIcon size={14} className="text-secondary" />;
      case 'video': return <Video size={14} className="text-primary" />;
      case 'lipsync': return <Mic size={14} className="text-accent" />;
      case 'music_video': return <Music size={14} className="text-cyan-500" />;
      case 'ugc': return <Smartphone size={14} className="text-pink-500" />;
      default: return null;
    }
  };

  const getTypeColor = (type: GalleryItemType) => {
    switch (type) {
      case 'photo': return 'border-secondary/30 text-secondary bg-secondary/10';
      case 'video': return 'border-primary/30 text-primary bg-primary/10';
      case 'lipsync': return 'border-accent/30 text-accent bg-accent/10';
      case 'music_video': return 'border-cyan-500/30 text-cyan-500 bg-cyan-500/10';
      case 'ugc': return 'border-pink-500/30 text-pink-500 bg-pink-500/10';
      default: return 'border-border text-white bg-card';
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full h-full flex flex-col">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 shrink-0">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-tight">My Gallery</h1>
          <p className="text-muted-foreground mt-1">All your generated masterpieces in one place.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setFilterFavorites(!filterFavorites)}
            className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-colors border ${filterFavorites ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-card border-border text-muted-foreground hover:text-white'}`}
          >
            <Heart size={16} className={filterFavorites ? "fill-current" : ""} /> Favorites
          </button>
          
          <select 
            className="px-4 py-2 rounded-full text-sm font-medium bg-card border border-border text-white focus:outline-none focus:ring-1 focus:ring-primary"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
          >
            <option value="all">All Types</option>
            <option value="photo">Photos</option>
            <option value="video">Videos</option>
            <option value="lipsync">Lip Syncs</option>
            <option value="music_video">Music Videos</option>
            <option value="ugc">UGC Ads</option>
          </select>
        </div>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      ) : gallery?.items && gallery.items.length > 0 ? (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6 pb-20">
          {gallery.items.map((item, i) => (
            <div 
              key={item.id} 
              className="break-inside-avoid relative group rounded-2xl overflow-hidden bg-card border border-border animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${(i % 10) * 100}ms` }}
            >
              {item.status === 'processing' || item.status === 'queued' ? (
                <div className="aspect-square bg-muted flex flex-col items-center justify-center p-6 text-center">
                  <Loader2 className="animate-spin text-primary mb-4" size={32} />
                  <span className="text-sm font-medium text-white capitalize">{item.status}...</span>
                  <span className="text-xs text-muted-foreground mt-1">This takes a minute.</span>
                </div>
              ) : item.status === 'failed' ? (
                <div className="aspect-square bg-destructive/10 flex flex-col items-center justify-center p-6 text-center border border-destructive/20">
                  <AlertTriangle className="text-destructive mb-4" size={32} />
                  <span className="text-sm font-medium text-white">Generation Failed</span>
                </div>
              ) : (
                <div className="relative">
                  {item.type === 'video' || item.type === 'lipsync' || item.type === 'music_video' || item.type === 'ugc' ? (
                    <video 
                      src={item.outputUrl || ''} 
                      poster={item.thumbnailUrl || ''}
                      className="w-full h-auto object-cover"
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img 
                      src={item.outputUrl || ''} 
                      alt={item.prompt || 'Generated'} 
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  )}
                  
                  {/* Overlay Controls */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 pointer-events-none">
                    <div className="flex justify-between items-start pointer-events-auto">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getTypeColor(item.type)} backdrop-blur-md`}>
                        {getTypeIcon(item.type)} {item.type.replace('_', ' ')}
                      </div>
                      <button 
                        onClick={() => handleToggleFavorite(item.id, !!item.isFavorited)}
                        className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:text-red-500 transition-colors"
                      >
                        <Heart size={18} className={item.isFavorited ? "fill-red-500 text-red-500" : ""} />
                      </button>
                    </div>
                    
                    <div className="pointer-events-auto">
                      {item.prompt && (
                        <p className="text-sm text-white/90 line-clamp-2 mb-3 drop-shadow-md">
                          "{item.prompt}"
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/60 font-mono">{format(new Date(item.createdAt), 'MMM d, yyyy')}</span>
                        <div className="flex gap-2">
                          {item.outputUrl && (
                            <a 
                              href={item.outputUrl} 
                              download
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 bg-white/10 hover:bg-primary backdrop-blur-md rounded-full text-white transition-colors"
                            >
                              <Download size={16} />
                            </a>
                          )}
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-2 bg-white/10 hover:bg-destructive backdrop-blur-md rounded-full text-white transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50">
          <Library size={80} className="mb-6 text-muted-foreground" />
          <h3 className="text-2xl font-serif font-bold text-white mb-2">No generations found</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            {filterType !== 'all' || filterFavorites 
              ? "Try changing your filters to see more results." 
              : "Your gallery is empty. Head to the studio to create something new."}
          </p>
        </div>
      )}
    </div>
  );
}
