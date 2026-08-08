// Seed shot deck for the Directors Board.
// Reference images are stripped — seed shots start without images so the
// board is blank and users generate their own frames via the Inspector.

export type ShotVariant = {
  image: string | null;
  frame: string;
  wardrobe: string;
  label: string;
};

export type Shot = {
  id: string;
  title: string;
  type: string;
  image: string | null;
  alt: string;
  frame: string;
  wardrobe: string;
  mood: string;
  note: string;
  variants: ShotVariant[];
};

const v = (frame: string, wardrobe: string, label: string): ShotVariant => ({
  image: null,
  label,
  frame,
  wardrobe,
});

export const shots: Shot[] = [
  {
    id: "01",
    title: "Miami Convertible",
    type: "motion opener",
    image: null,
    alt: "Artist cruising in a convertible along a neon-lit Miami boulevard at night.",
    frame: "Tracking side shot, low angle",
    wardrobe: "White linen open shirt, gold chain, black shades",
    mood: "Cinematic, luxurious, opener energy",
    note: "Lead with this as the title card or first verse — sets the visual world immediately.",
    variants: [
      v("Tracking side shot, low angle", "White linen open shirt, gold chain, black shades", "Original"),
      v("Hood-mounted front angle", "Cream shearling, red-tinted sunglasses", "Front mount"),
    ],
  },
  {
    id: "02",
    title: "Blue Neon Studio",
    type: "performance hero",
    image: null,
    alt: "Artist performing in a blue neon-drenched studio with smoke and hard shadows.",
    frame: "Medium close-up, 45° angle",
    wardrobe: "Black mesh top, silver jewellery, chain",
    mood: "Moody, electric, focused",
    note: "Strong recurring performance angle — cut back here on every chorus.",
    variants: [
      v("Medium close-up, 45° angle", "Black mesh top, silver jewellery, chain", "Original"),
      v("Full-body wide, centred", "Electric-blue satin tracksuit, white sneakers", "Full body"),
    ],
  },
  {
    id: "03",
    title: "Red Lens Close-Up",
    type: "beauty detail",
    image: null,
    alt: "Tight portrait of the artist wearing sculpted red sunglasses under moody blue and red lighting.",
    frame: "Extreme close-up",
    wardrobe: "Signature shades, pendant, dark performance tee",
    mood: "Intense, iconic, intimate",
    note: "Cut this on punchlines for a signature face card moment.",
    variants: [
      v("Extreme close-up", "Signature shades, pendant, dark performance tee", "Original"),
      v("Macro side profile on ear + jawline", "Satin black shirt, silver cross pendant", "Side macro"),
    ],
  },
  {
    id: "04",
    title: "Rooftop Sunrise",
    type: "anthem frame",
    image: null,
    alt: "Artist in a glossy red puffer jacket standing on a wet rooftop with the skyline behind at sunrise.",
    frame: "Wide hero silhouette",
    wardrobe: "Red puffer, black tee, hood up",
    mood: "Triumphant, reflective, cinematic",
    note: "Great for the hook or first chorus with lens flares and skyline movement.",
    variants: [
      v("Wide hero silhouette", "Red puffer, black tee, hood up", "Original"),
      v("Low angle from behind toward sunrise", "Cream shearling over burgundy hoodie, cargo pants", "Behind into sun"),
    ],
  },
  {
    id: "05",
    title: "Taxi Crosswalk",
    type: "fashion walk",
    image: null,
    alt: "Artist crossing a city street in a yellow puffer jacket with taxis blurring around.",
    frame: "Center walk-in wide",
    wardrobe: "Yellow puffer, black tee, red shades",
    mood: "Fast, urban, designer energy",
    note: "Use subtle speed ramps so the traffic moves faster than the subject.",
    variants: [
      v("Center walk-in wide", "Yellow puffer, black tee, red shades", "Original"),
      v("Overhead top-down look", "Orange varsity jacket, cargo shorts, chunky white sneakers", "Top-down overhead"),
    ],
  },
  {
    id: "06",
    title: "Subway Silence",
    type: "back view mood",
    image: null,
    alt: "Artist seen from behind in a glossy blue puffer jacket on an empty foggy subway platform.",
    frame: "Symmetrical back shot",
    wardrobe: "Blue puffer, hood up",
    mood: "Alone, icy, suspenseful",
    note: "Ideal for the bridge or a beat switch before the next sequence hits.",
    variants: [
      v("Symmetrical back shot", "Blue puffer, hood up", "Original"),
      v("Camera dolly side profile walking", "Charcoal wool trench, black turtleneck, silver chain", "Side dolly"),
    ],
  },
  {
    id: "07",
    title: "Courtside Dusk",
    type: "product hero",
    image: null,
    alt: "Artist seated on a basketball court at dusk with statement sneakers large in the foreground.",
    frame: "Low sneaker-led angle",
    wardrobe: "Black hoodie, statement sneakers, chain",
    mood: "Sport-luxury, grounded, aspirational",
    note: "This frame sells the sneaker story without losing the artist identity.",
    variants: [
      v("Low sneaker-led angle", "Black hoodie, statement sneakers, chain", "Original"),
      v("High wide showing full court", "White basketball jersey, red mesh shorts, red high-tops", "Full court wide"),
    ],
  },
  {
    id: "08",
    title: "Pink Mic Attack",
    type: "performance close-up",
    image: null,
    alt: "Artist singing into a vintage microphone against a hot pink backdrop.",
    frame: "Aggressive tight performance",
    wardrobe: "Black graphic tee, rings, signature shades",
    mood: "Loud, playful, front-facing",
    note: "Strong option for ad-libs, hooks, or lyric typography overlays.",
    variants: [
      v("Aggressive tight performance", "Black graphic tee, rings, signature shades", "Original"),
      v("Full-body wide low angle", "Hot pink satin tracksuit, gold chain, white sneakers", "Full-body wide"),
    ],
  },
  {
    id: "09",
    title: "Back Alley Smoke",
    type: "street noir",
    image: null,
    alt: "Artist standing in a graffiti-lined alley wearing a leather jacket with steam rising nearby.",
    frame: "High angle wide",
    wardrobe: "Leather jacket, brown denim, wheat boots",
    mood: "Gritty, nocturnal, cinematic",
    note: "This plays like a story beat between glamour scenes.",
    variants: [
      v("High angle wide", "Leather jacket, brown denim, wheat boots", "Original"),
      v("Low dutch angle", "Black hooded parka, distressed jeans, combat boots", "Low dutch"),
    ],
  },
  {
    id: "10",
    title: "Walkout to Chaos",
    type: "finale moment",
    image: null,
    alt: "Artist walking toward camera through a crowd with phone lights and purple lasers in the background.",
    frame: "Runway-style crowd push",
    wardrobe: "Purple track jacket, washed jeans, red-purple kicks",
    mood: "Victory lap, concert heat, star power",
    note: "Use this as the closing ascent shot or the last chorus payoff.",
    variants: [
      v("Runway-style crowd push", "Purple track jacket, washed jeans, red-purple kicks", "Original"),
      v("Behind the artist, looking into crowd", "Shimmering silver bomber, black leather pants, white sneakers", "Over-shoulder into crowd"),
    ],
  },
];
