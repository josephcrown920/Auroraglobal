import { Box, X } from "lucide-react";
import { useState } from "react";
export function Minimap3D({ src, label }: { src: string; label?: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-30 rounded-full border border-white/10 bg-black/80 p-3 text-primary"><Box className="size-4" /></button>;
  return <aside className="fixed bottom-5 right-5 z-30 hidden w-56 rounded-2xl border border-white/10 bg-black/80 p-2 shadow-2xl backdrop-blur md:block"><div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-widest text-white/45"><span>{label ?? "Scene map"}</span><button onClick={() => setOpen(false)}><X className="size-3" /></button></div><div className="aspect-video overflow-hidden rounded-xl"><img src={src} alt="" className="h-full w-full object-cover" /></div></aside>;
}