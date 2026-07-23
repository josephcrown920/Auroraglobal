import shot01 from "@/assets/storyboard/shot-01-miami-convertible.jpg.asset.json";
import shot02 from "@/assets/storyboard/shot-02-blue-neon-studio.jpg.asset.json";
import shot03 from "@/assets/storyboard/shot-03-red-blue-portrait.jpg.asset.json";
import shot04 from "@/assets/storyboard/shot-04-red-puffer-rooftop.jpg.asset.json";
import shot05 from "@/assets/storyboard/shot-05-yellow-puffer-street.jpg.asset.json";
import shot06 from "@/assets/storyboard/shot-06-blue-puffer-subway.jpg.asset.json";
import shot07 from "@/assets/storyboard/shot-07-court-sneakers.jpg.asset.json";
import shot08 from "@/assets/storyboard/shot-08-pink-mic-performance.jpg.asset.json";
import shot09 from "@/assets/storyboard/shot-09-alley-leather.jpg.asset.json";
import shot10 from "@/assets/storyboard/shot-10-concert-walkout.jpg.asset.json";

export type Shot = {
  id: string;
  title: string;
  type: string;
  image: string;
  alt: string;
  frame: string;
  wardrobe: string;
  mood: string;
  note: string;
};

export const shots: Shot[] = [
  { id: "01", title: "Ocean Drive Pull-Up", type: "hero opener", image: shot01.url, alt: "Artist leaning out of a red convertible on a neon-lit Miami street in the rain.", frame: "Low rolling side shot", wardrobe: "Pink hoodie, black utility vest, red shades", mood: "Neon, humid, high-status", note: "Use this as the establishing flex shot before the verse lands." },
  { id: "02", title: "Blue Voltage", type: "editorial profile", image: shot02.url, alt: "Artist in a blue neon studio wearing a black leather jacket and layered diamond chains.", frame: "Locked-off profile medium", wardrobe: "Black leather jacket, white tee, heavy chains", mood: "Electric, fashion-forward, cold glow", note: "Perfect for transition bars or a slow intro with animated light flicker." },
  { id: "03", title: "Red Lens Close-Up", type: "beauty detail", image: shot03.url, alt: "Tight portrait of the artist wearing sculpted red sunglasses under moody blue and red lighting.", frame: "Extreme close-up", wardrobe: "Signature shades, pendant, dark performance tee", mood: "Intense, iconic, intimate", note: "Cut this on punchlines for a signature face card moment." },
  { id: "04", title: "Rooftop Sunrise", type: "anthem frame", image: shot04.url, alt: "Artist in a glossy red puffer jacket standing on a wet rooftop with the skyline behind him at sunrise.", frame: "Wide hero silhouette", wardrobe: "Red puffer, black tee, hood up", mood: "Triumphant, reflective, cinematic", note: "Great for the hook or first chorus with lens flares and skyline movement." },
  { id: "05", title: "Taxi Crosswalk", type: "fashion walk", image: shot05.url, alt: "Artist crossing a city street in a yellow puffer jacket with taxis blurring around him.", frame: "Center walk-in wide", wardrobe: "Yellow puffer, black tee, red shades", mood: "Fast, urban, designer energy", note: "Use subtle speed ramps so the traffic moves faster than the subject." },
  { id: "06", title: "Subway Silence", type: "back view mood", image: shot06.url, alt: "Artist seen from behind in a glossy blue puffer jacket on an empty foggy subway platform.", frame: "Symmetrical back shot", wardrobe: "Blue puffer, hood up", mood: "Alone, icy, suspenseful", note: "Ideal for the bridge or a beat switch before the next sequence hits." },
  { id: "07", title: "Courtside Dusk", type: "product hero", image: shot07.url, alt: "Artist seated on a basketball court at dusk with light blue sneakers large in the foreground.", frame: "Low sneaker-led angle", wardrobe: "Black hoodie, statement sneakers, chain", mood: "Sport-luxury, grounded, aspirational", note: "This frame sells the sneaker story without losing the artist identity." },
  { id: "08", title: "Pink Mic Attack", type: "performance close-up", image: shot08.url, alt: "Artist singing into a vintage microphone against a hot pink backdrop.", frame: "Aggressive tight performance", wardrobe: "Black graphic tee, rings, signature shades", mood: "Loud, playful, front-facing", note: "Strong option for ad-libs, hooks, or lyric typography overlays." },
  { id: "09", title: "Back Alley Smoke", type: "street noir", image: shot09.url, alt: "Artist standing in a graffiti-lined alley wearing a leather jacket and boots with steam rising nearby.", frame: "High angle wide", wardrobe: "Leather jacket, brown denim, wheat boots", mood: "Gritty, nocturnal, cinematic", note: "This plays like a story beat between glamour scenes." },
  { id: "10", title: "Walkout to Chaos", type: "finale moment", image: shot10.url, alt: "Artist walking toward camera through a crowd with phone lights and purple lasers in the background.", frame: "Runway-style crowd push", wardrobe: "Purple track jacket, washed jeans, red-purple kicks", mood: "Victory lap, concert heat, star power", note: "Use this as the closing ascent shot or the last chorus payoff." },
];
