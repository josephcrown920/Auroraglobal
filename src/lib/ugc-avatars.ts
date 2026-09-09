import avatarMaya from "@/assets/ugc/maya.jpg.asset.json";
import avatarLuna from "@/assets/ugc/luna.jpg.asset.json";
import avatarAva from "@/assets/ugc/ava.jpg.asset.json";
import avatarRio from "@/assets/ugc/rio.jpg.asset.json";
import avatarScarlet from "@/assets/ugc/scarlet.jpg.asset.json";
import avatarNova from "@/assets/ugc/nova.jpg.asset.json";
import realCarHold from "@/assets/ugc/ugc-car-product-hold.webp.asset.json";
import realStreet from "@/assets/ugc/ugc-street-coffee.jpeg.asset.json";

export const UGC_AVATARS = [
  { id: "maya", name: "Maya", vibe: "Soft-glam beauty reviewer", img: avatarMaya.url },
  { id: "luna", name: "Luna", vibe: "Clean-girl skincare lead", img: avatarLuna.url },
  { id: "ava", name: "Ava", vibe: "Bold lip, red-dress energy", img: avatarAva.url },
  { id: "rio", name: "Rio", vibe: "Cool-tone editorial", img: avatarRio.url },
  { id: "scarlet", name: "Scarlet", vibe: "Red-hair freckled it-girl", img: avatarScarlet.url },
  { id: "nova", name: "Nova", vibe: "Glossy fitness creator", img: avatarNova.url },
  { id: "emma", name: "Emma", vibe: "Car-selfie product reviewer", img: realCarHold.url },
  { id: "sasha", name: "Sasha", vibe: "Street-style coffee run", img: realStreet.url },
] as const;

export type UgcAvatar = (typeof UGC_AVATARS)[number];