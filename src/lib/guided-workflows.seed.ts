import type { GuidedWorkflowContent } from "./guided-workflows.schema";

/**
 * Default Guided Workflow content — distilled from the creator prompt guides
 * the owner supplied (Sniply Studio / @therealwavman prompt packs, InVideo
 * Agent One tutorials, Freepik guides, Realism Formula, Character Sheet
 * prompt shares). Prompt language is kept faithful to the source guides —
 * the technical photography phrasing (ARRI, bokeh, film grain…) is what makes
 * the outputs look cinematic, so it is intentionally not paraphrased.
 *
 * These rows are seeded/upserted by slug via the admin "Restore defaults"
 * action and the one-off seed script. Admins can edit or unpublish any of
 * them afterwards — user edits are preserved unless defaults are restored.
 */
export const DEFAULT_GUIDED_WORKFLOWS: GuidedWorkflowContent[] = [
  // ── 1. Phone Lip Sync Performance ─────────────────────────────────────────
  {
    slug: "phone-lipsync-performance",
    title: "Phone Lip Sync Performance",
    tagline: "Look like someone caught you performing on their phone",
    description:
      "Record a simple performance of yourself, then have AI place a phone with a green screen in front of your face — held by someone else's hand. Animate it, then motion-track your real lip sync footage onto the phone in CapCut. The result looks like viral candid phone footage from an incredible location.",
    category: "performance",
    icon: "📱",
    sourceCredit: "@therealwavman",
    isPublished: true,
    sortOrder: 10,
    steps: [
      {
        id: "record-source",
        title: "Record your source video",
        kind: "instruction",
        description:
          "Film yourself performing / lip syncing your song at any location — a phone camera works perfectly. Dress for the scene: whatever you wear carries over to the AI output. Then take a screenshot of yourself from the video (this becomes your identity reference) and pick a location image (gas station, rooftop, concert backstage — think visually striking).",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [
          "Whatever you're wearing in the source video is exactly what appears in the AI output.",
          "The more unique your location reference, the more viral the result.",
          "Record ONE performance, then swap different location images to generate multiple scenes.",
        ],
        variants: [],
      },
      {
        id: "green-screen-image",
        title: "Generate the green-screen phone image",
        kind: "image",
        description:
          "Upload your screenshot (you) and the location image. The AI adds a phone with a bright green chroma screen held in front of your mouth — the green screen is your compositing target for CapCut later.",
        promptTemplate:
          "Use the first image as the exact base frame. Do not change the environment, pose, lighting, or camera angle. Keep [YOUR DESCRIPTION]'s identity, expression, and ultra-realistic skin texture the same. Add a realistic modern smartphone held [POSITION] directly in front of [HIS/HER] mouth with a bright green chroma screen. Include [HAND DESCRIPTION] entering from the side holding the phone. Match scale, perspective, reflections, and contact shadows so the phone and hand blend naturally with the [YOUR SCENE] lighting.",
        placeholders: [
          { key: "YOUR DESCRIPTION", label: "Describe yourself", example: "man in camo hoodie, arms crossed, eyes closed" },
          { key: "POSITION", label: "Phone position", example: "horizontally" },
          { key: "HIS/HER", label: "his / her", example: "his" },
          { key: "HAND DESCRIPTION", label: "Whose hand holds the phone", example: "a woman's hand with tattoos and a metallic watch" },
          { key: "YOUR SCENE", label: "Scene / lighting", example: "nighttime gas station" },
        ],
        referenceSlots: [
          { key: "face", label: "You (screenshot from your video)", description: "Locks in your exact appearance, outfit, and features.", required: true },
          { key: "location", label: "Location image", description: "The environment you want to be placed in.", required: false },
        ],
        usesPreviousResult: false,
        tips: [
          "The more specific your description, the better the result — tell the AI exactly what to keep and what to add.",
          "Too much control? Try the simple version instead: \"put a girl holding a phone in front of his mouth\".",
        ],
        variants: [
          { label: "Simple version", prompt: "put a girl holding a phone in front of his mouth" },
        ],
      },
      {
        id: "animate-hand",
        title: "Animate the hand entering the frame",
        kind: "video",
        description:
          "Animate your generated image: the hand with the green-screen phone travels naturally into place in front of your mouth while everything else stays locked.",
        promptTemplate:
          "Start with the first frame as the exact base: [YOUR PERSON AND POSE] at [YOUR LOCATION], background unchanged. Maintain identical lighting, camera angle, depth of field, and ultra-realistic skin texture. From the [SIDE] of frame, animate [HAND DESCRIPTION] smoothly moving into the scene while holding a modern smartphone horizontally with a bright green screen. The hand should travel naturally toward the face and stop with the phone positioned directly in front of the mouth, matching perspective, scale, and lighting reflections. Ensure realistic motion easing, subtle wrist rotation, natural finger grip, and correct contact shadows. No change to body pose or expression; only the hand and phone animate into place.",
        placeholders: [
          { key: "YOUR PERSON AND POSE", label: "You + your pose", example: "man seated in chair, arms crossed, eyes closed" },
          { key: "YOUR LOCATION", label: "Location", example: "nighttime gas station" },
          { key: "SIDE", label: "Which side the hand enters from", example: "right side" },
          { key: "HAND DESCRIPTION", label: "Hand description", example: "a woman's hand with visible tattoos and a metallic watch" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["Vertical 9:16 works best for Reels/TikTok."],
        variants: [],
      },
      {
        id: "capcut-tracking",
        title: "Motion-track your lip sync in CapCut",
        kind: "instruction",
        description:
          "Import the generated video into CapCut. Use motion tracking on the green phone screen to lock your real lip-sync footage to the phone. This is the finishing touch that sells the illusion.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [
          "The AI-generated green screen gives you a clean compositing target.",
          "Without tracking you still have a great clip — with it, you have a viral video.",
        ],
        variants: [],
      },
    ],
  },

  // ── 2. Colors-Style Performance ───────────────────────────────────────────
  {
    slug: "colors-style-performance",
    title: "Colors-Style Performance Video",
    tagline: "Bold single-color set, hanging vintage mic, two angles",
    description:
      "Create a professional Colors-inspired performance video with just your phone: generate a wide and a close-up angle of yourself on a seamless single-color cyclorama with the iconic hanging mic, record your real performance from the same two angles, then bring the images to life with Motion Control.",
    category: "performance",
    icon: "🎤",
    sourceCredit: "Sniply Studio",
    isPublished: true,
    sortOrder: 20,
    steps: [
      {
        id: "gather-refs",
        title: "Find your reference images",
        kind: "instruction",
        description:
          "Screenshot two angles from any Colors Show performance — one wide/full-body shot and one medium close-up. These set the composition for your AI images. Also grab a clear photo of yourself as the subject reference.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: ["Aurora's Colors Studio can also generate these sets for you — check the Colors tool."],
        toolLink: { label: "Open Colors Studio", to: "/colors" },
        variants: [],
      },
      {
        id: "wide-angle",
        title: "Generate the wide angle (full body)",
        kind: "image",
        description: "Upload your Colors wide reference + your photo, then generate.",
        promptTemplate:
          "Place the subject ([SUBJECT DESCRIPTION]) into a minimalist studio performance scene. Full-body side profile pose, arms slightly extended forward as if performing. Use the exact suspended vintage studio microphone from the reference — identical shape, size, material, cable — hanging from ceiling at chest level. Keep microphone photorealistic to reference. Environment is a seamless [COLOR] cyclorama studio — background and floor are one continuous [COLOR] color, no visible edges or corners. Soft even glossy lighting with smooth gradient. Subject stands on a circular performance platform matching the [COLOR] tone, slightly elevated with subtle shadow and faint reflective sheen. Preserve exact facial likeness, beard, skin tone, hairstyle, body proportions. Outfit identical: [OUTFIT DESCRIPTION]. Cinematic studio lighting, gentle floor shadow, rim light separation, ultra-realistic skin texture, natural pores, sharp clothing detail, high-end music video aesthetic, 4K photoreal quality.",
        placeholders: [
          { key: "SUBJECT DESCRIPTION", label: "Subject", example: "man in yellow jacket" },
          { key: "COLOR", label: "Set color", example: "hot pink" },
          { key: "OUTFIT DESCRIPTION", label: "Outfit", example: "yellow jacket, black shorts, white socks, black shoes, all accessories" },
        ],
        referenceSlots: [
          { key: "wide-ref", label: "Colors wide-angle reference", description: "Screenshot of a wide/full-body Colors shot.", required: true },
          { key: "you", label: "Photo of you", description: "Subject/identity reference.", required: true },
        ],
        usesPreviousResult: false,
        tips: ["Change the color to any vibe — red, blue, green, orange. Make it yours."],
        variants: [],
      },
      {
        id: "close-up",
        title: "Generate the close-up angle",
        kind: "image",
        description: "Same process, new prompt — upload the close-up reference + your photo.",
        promptTemplate:
          "Place the subject ([SUBJECT DESCRIPTION]) into a studio performance scene. Medium close-up from chest up. Subject turned slightly to side but mostly facing camera — approximately 30-45° angled pose, majority of face visible (both eyes, nose bridge mostly facing camera, slight cheek contour). Use the exact suspended vintage studio microphone from reference — identical design, metallic finish, hanging cable — positioned in front at mouth level with same spacing as reference. Environment is a seamless continuous [COLOR] cyclorama background filling entire frame top to bottom, no visible floor line, corners, or edges. Preserve exact facial likeness, beard, hairstyle, skin tone, proportions from reference. Outfit identical: [OUTFIT DESCRIPTION]. Pose natural and expressive as if mid-performance, hands slightly raised or gesturing. Soft even studio lighting, gentle shadows, subtle rim light separation, ultra-realistic skin texture with natural pores, sharp clothing detail, shallow depth of field but subject fully crisp, high-end music video aesthetic, 4K photoreal quality.",
        placeholders: [
          { key: "SUBJECT DESCRIPTION", label: "Subject", example: "man in yellow jacket" },
          { key: "COLOR", label: "Set color", example: "super hot pink" },
          { key: "OUTFIT DESCRIPTION", label: "Outfit", example: "yellow jacket, black shorts, accessories unchanged" },
        ],
        referenceSlots: [
          { key: "closeup-ref", label: "Colors close-up reference", description: "Screenshot of a medium close-up Colors shot.", required: true },
          { key: "you", label: "Photo of you", description: "Subject/identity reference.", required: true },
        ],
        usesPreviousResult: false,
        tips: [],
        variants: [],
      },
      {
        id: "record-performance",
        title: "Record your performance",
        kind: "instruction",
        description:
          "Using your phone, record yourself performing your song from the exact same two angles as the generated images. Match the pose and framing as closely as possible.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [
          "No studio needed — just match your body angle and framing to the generated images.",
          "Perform with energy — the motion transfer picks up on your movement.",
        ],
        variants: [],
      },
      {
        id: "motion-control",
        title: "Animate with Motion Control",
        kind: "motion",
        description:
          "For each angle: upload the AI image as the source, your phone performance video as the motion reference, and a short context prompt. Generate — the AI brings your image to life with your real movements.",
        promptTemplate: "man performing and singing expressively",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["The closer your recorded angles match the generated images, the better the motion transfer."],
        toolLink: { label: "Open Motion Control", to: "/motion" },
        variants: [],
      },
      {
        id: "edit-export",
        title: "Edit & export",
        kind: "instruction",
        description:
          "Combine both angles in any editor (CapCut, Premiere…). Cut between the wide and close-up to match the energy of your performance, add your song audio, export.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [],
        variants: [],
      },
    ],
  },

  // ── 3. Luxury Car Music Video ─────────────────────────────────────────────
  {
    slug: "luxury-car-music-video",
    title: "Luxury Car Music Video",
    tagline: "Put yourself in a Maybach without leaving your couch",
    description:
      "Generate a photorealistic image of yourself inside a luxury car interior — Maybach, Rolls, Bentley, even a private jet — then record yourself performing in the same seated position and use Motion Control to animate the scene with your real movements.",
    category: "music-video",
    icon: "🚘",
    sourceCredit: "@therealwavman",
    isPublished: true,
    sortOrder: 30,
    steps: [
      {
        id: "gather-refs",
        title: "Gather your 3 reference images",
        kind: "instruction",
        description:
          "Image 1 — composition: a photo showing the exact camera angle you want (someone sitting in a car seen through the window). Image 2 — the luxury interior you want (starlight ceiling, quilted leather, ambient LEDs). Image 3 — a clear photo of yourself; your outfit carries over.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [
          "Night scenes hit harder — ambient LEDs and starlight ceilings create natural contrast.",
          "Dress for the scene when you take your identity photo.",
        ],
        variants: [],
      },
      {
        id: "scene-image",
        title: "Generate the luxury car scene",
        kind: "image",
        description:
          "Upload composition + interior + identity references and generate. Re-run until your face looks accurate and the interior matches.",
        promptTemplate:
          "Use Image 1 as the composition reference, Image 2 as the luxury [VEHICLE TYPE] interior reference, and Image 3 as the identity reference for the person. Replace the person in Image 1 with the [MAN/WOMAN] from Image 3 while preserving their exact facial identity — same facial structure, skin tone, [FACIAL FEATURES], and proportions. The face must match the identity reference one-to-one without altering facial features. They are seated naturally in the [SEAT POSITION] of the vehicle, viewed through [CAMERA ANGLE], maintaining the same camera angle and framing as Image 1. They must be wearing the same [YOUR OUTFIT DESCRIPTION] from Image 3, [POSTURE]. Transform the vehicle interior so it matches the ultra-luxury [VEHICLE TYPE] interior from Image 2: [INTERIOR DETAILS]. Cinematography should look like it was captured on an ARRI Alexa 35 cinema camera with a Cooke anamorphic cinema lens. Lighting should feel cinematic and natural, with subtle reflections on the car window glass and soft luxury interior lighting illuminating the subject. Depth of field should be very shallow, creating creamy optical bokeh in the background, with the luxury ambient lights and starlight ceiling softly blooming into cinematic light circles. Focus should be tack sharp on the subject's face, while the interior lights blur smoothly in the background with natural lens bokeh characteristics. Ultra-photorealistic skin rendering: visible pores, natural skin texture, subtle imperfections, realistic light falloff across the face. Luxury editorial photography aesthetic, high-end automotive lifestyle shot, natural reflections in glass, cinematic contrast, filmic highlight roll-off. 8K photorealism, ARRI Alexa cinematic color science, shallow depth of field, natural lens bokeh, subtle film grain, realistic optical lens imperfections.",
        placeholders: [
          { key: "VEHICLE TYPE", label: "Vehicle", example: "Mercedes-Maybach" },
          { key: "MAN/WOMAN", label: "man / woman", example: "man" },
          { key: "FACIAL FEATURES", label: "Your facial features", example: "beard, lips, eye shape" },
          { key: "SEAT POSITION", label: "Seat", example: "backseat" },
          { key: "CAMERA ANGLE", label: "Viewed through…", example: "the slightly lowered car window" },
          { key: "YOUR OUTFIT DESCRIPTION", label: "Outfit", example: "pink designer hoodie and matching sweatpants" },
          { key: "POSTURE", label: "Posture", example: "relaxed posture with hands resting naturally" },
          { key: "INTERIOR DETAILS", label: "Interior details", example: "white quilted leather executive seats, luxury center console, ambient LED lighting, fiber-optic starlight headliner ceiling" },
        ],
        referenceSlots: [
          { key: "composition", label: "Composition reference", description: "The exact camera angle and framing you want.", required: true },
          { key: "interior", label: "Luxury interior reference", description: "Sets the vibe — starlight ceiling, quilted leather…", required: true },
          { key: "identity", label: "Your identity photo", description: "Locks your face, skin tone, outfit, style.", required: true },
        ],
        usesPreviousResult: false,
        tips: [
          "The ARRI + Cooke trick: naming real cinema cameras and lenses triggers cinematic color science and realistic lens character.",
          "One identity photo, many cars — re-run with different interiors: Maybach, Rolls, Lambo, private jet.",
        ],
        variants: [],
      },
      {
        id: "record-motion",
        title: "Record your motion reference video",
        kind: "instruction",
        description:
          "Study the generated image, then film yourself performing in the same seated position — couch, chair, car seat, whatever works. Keep your body within frame the same way it appears in the AI image.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [
          "Position matching is critical — the closer the match, the better the Motion Control lock.",
          "Your background and outfit in this video don't matter — only position and movement.",
        ],
        variants: [],
      },
      {
        id: "motion-control",
        title: "Motion Control with a context prompt",
        kind: "motion",
        description:
          "Upload the AI scene as the source image and your recording as the motion source. The context prompt is crucial — it tells the AI you're INSIDE a car so hands don't morph through the window.",
        promptTemplate: "A [MAN/WOMAN] [ACTION] inside of a [VEHICLE]",
        placeholders: [
          { key: "MAN/WOMAN", label: "man / woman", example: "man" },
          { key: "ACTION", label: "Action", example: "rapping" },
          { key: "VEHICLE", label: "Vehicle", example: "car" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [
          "Keep the context prompt simple — it just needs to know the person is inside a vehicle.",
          "Keep movements contained within the window/seat area.",
        ],
        toolLink: { label: "Open Motion Control", to: "/motion" },
        variants: [],
      },
      {
        id: "final",
        title: "Add your track",
        kind: "instruction",
        description: "Layer your song over the final video, sync the performance, post everywhere.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [],
        variants: [],
      },
    ],
  },

  // ── 4. Five-Reference Music Video ─────────────────────────────────────────
  {
    slug: "one-scene-every-angle",
    title: "One Scene, Every Angle",
    tagline: "Build a full music video scene from 5 references",
    description:
      "Gather 5 reference images — your selfie, outfit, location, pose and a car/prop — and composite them into one hyper-real cinematic base scene. Then re-shoot that scene from new camera angles with one-line prompts, and animate every angle with your original phone recording via Motion Control.",
    category: "music-video",
    icon: "🎬",
    sourceCredit: "@therealwavman",
    isPublished: true,
    sortOrder: 40,
    steps: [
      {
        id: "gather",
        title: "Record + gather your 5 references",
        kind: "instruction",
        description:
          "Record a simple performance video on your phone (anywhere — the background gets replaced). Then gather: 1) a clear selfie, 2) your outfit (flat lay or photo), 3) the location, 4) a pose/staging reference, 5) a car or prop.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: ["Each image tells the AI a different piece of your scene."],
        variants: [],
      },
      {
        id: "base-scene",
        title: "Generate the base scene",
        kind: "image",
        description:
          "Upload all 5 references and run the master compositing prompt. Swap the bracketed parts for YOUR scene — keep every technical photography term as-is.",
        promptTemplate:
          "Create a hyper-realistic composite image using the five provided reference images, using the [MAN/WOMAN] from the uploaded close-up selfie as the primary identity source, preserving their exact facial features, skin tone, complexion, [FACIAL FEATURES], hairstyle, eye detail, and overall likeness with absolute accuracy, replacing the person in the pose staging reference image with this subject while keeping the same pose, body positioning, framing, perspective, and camera angle exactly as in that reference, dressing the subject in the exact outfit from the outfit reference image consisting of the [OUTFIT DESCRIPTION] with accurate colors, fabric textures, proportions, and fit, placing the subject outdoors in front of the [LOCATION] from the location reference image as the main background environment, and additionally incorporating the [CAR/PROP] from the prop reference image positioned behind the subject in the scene in the same relative placement, angle, scale, and visual prominence as shown in the staging reference image, ensuring it looks naturally placed behind the subject as part of the environment, including a vintage hanging microphone suspended directly in front of the subject at mouth level staged identically to the reference image, applying true cinematic shallow depth of field so that the subject, microphone, and foreground remain in razor-sharp focus while both the [LOCATION] and the [CAR/PROP] in the background are softly blurred with natural optical bokeh and realistic lens falloff rather than artificial blur, matching the visual style of imagery shot on an ARRI Alexa cinema camera with a high-quality prime lens, using filmic color science, natural highlight roll-off, accurate dynamic range, professional golden-hour outdoor lighting, and cinematic realism, while implementing advanced skin realism by enhancing all facial imperfections with high-accuracy micro-detail including authentic pores, subtle texture variation, fine lines, micro-creases, natural asymmetry, faint scars, freckles, vellus hairs, and true surface irregularities, strengthening realistic material response such as matte versus oily zones, natural specularity, and micro-shadows without introducing smoothing, softening, or plastic artifacts, correcting only elements that appear broken or AI-distorted while fully preserving the subject's identity and keeping the original color grading exactly as it is, enhancing the eyes with high-fidelity micro-detail including crisp iris texture, natural radial patterns, subtle chromatic variation, accurate subsurface light response, refined eyelids, lashes, and tear ducts with true anatomical detail and natural moisture reflections, maintaining realistic skin translucency, authentic beard stubble detail, and natural lip texture, avoiding any beauty filters or artificial perfection, and producing a final result that is ultra-photorealistic with seamless blending between subject, prop, and environment, accurate proportions and perspective, true optical depth, professional cinematic quality, 4K resolution, and absolutely no text, logos, or visual artifacts.",
        placeholders: [
          { key: "MAN/WOMAN", label: "man / woman", example: "man" },
          { key: "FACIAL FEATURES", label: "Your facial features", example: "beard texture" },
          { key: "OUTFIT DESCRIPTION", label: "Outfit", example: "camo Supreme hoodie, olive green pants, and white Adidas sneakers" },
          { key: "LOCATION", label: "Location", example: "Learning Center building" },
          { key: "CAR/PROP", label: "Car / prop", example: "luxury white car" },
        ],
        referenceSlots: [
          { key: "selfie", label: "Your selfie", description: "Clear face shot — identity source.", required: true },
          { key: "outfit", label: "Outfit reference", description: "The clothes you want to wear.", required: true },
          { key: "location", label: "Location reference", description: "Where you want to be.", required: true },
          { key: "pose", label: "Pose / staging reference", description: "Controls the shot — pose, angle, staging.", required: false },
          { key: "prop", label: "Car / prop reference", description: "Makes the scene feel real.", required: false },
        ],
        usesPreviousResult: false,
        tips: [
          "Don't change the technical photography terms (ARRI Alexa, bokeh, skin realism…) — that's what makes it cinematic.",
          "Only swap the parts that describe YOUR specific scene.",
        ],
        variants: [],
      },
      {
        id: "angles",
        title: "Re-shoot the scene from new angles",
        kind: "image",
        description:
          "Upload your base scene as the only reference and use short one-line prompts to get new camera angles. Generate 3-5 different angles.",
        promptTemplate: "super close up, from the side front angle of the [MAN/WOMAN], keep bokeh depth of field",
        placeholders: [{ key: "MAN/WOMAN", label: "man / woman", example: "man" }],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["One prompt = unlimited shots. That's how you get a full music video from AI."],
        variants: [
          { label: "Wide shot", prompt: "wide shot from behind the subject, showing full environment, keep cinematic depth of field" },
          { label: "Low angle", prompt: "low angle looking up at the subject, dramatic perspective, keep bokeh depth of field" },
          { label: "Close-up face", prompt: "extreme close-up on the face, eyes looking into camera, shallow depth of field" },
          { label: "Over shoulder", prompt: "over the shoulder shot from behind, looking at the scene ahead, cinematic bokeh" },
          { label: "Dutch angle", prompt: "tilted dutch angle, dynamic composition, dramatic cinematic lighting" },
        ],
      },
      {
        id: "animate",
        title: "Animate every angle",
        kind: "motion",
        description:
          "Motion Control: upload each generated angle as the source image and your original phone recording as the control video. Do this for each angle, edit them together, and you have a full multi-shot music video.",
        promptTemplate: "[MAN/WOMAN] performing and singing expressively",
        placeholders: [{ key: "MAN/WOMAN", label: "man / woman", example: "man" }],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["All from one phone recording and some reference images."],
        toolLink: { label: "Open Motion Control", to: "/motion" },
        variants: [],
      },
    ],
  },

  // ── 5. Collage Music Video ────────────────────────────────────────────────
  {
    slug: "collage-music-video",
    title: "AI Collage Music Video",
    tagline: "High-fashion multi-panel video from one headshot",
    description:
      "Generate a library of consistent AI images from just a headshot and an outfit reference — full body, vehicle scenes, close-ups, multiple angles, even a featured model. Animate a few (lip sync, dolly zoom, dance), then assemble rounded-corner panels in CapCut into a cinematic collage video.",
    category: "music-video",
    icon: "🧩",
    sourceCredit: "Sniply Studio",
    isPublished: true,
    sortOrder: 50,
    steps: [
      {
        id: "base-full-body",
        title: "Base full-body studio shot",
        kind: "image",
        description: "Upload two references — a clear headshot and an outfit photo — and generate your base image.",
        promptTemplate:
          "Place the subject from image 1 standing fully upright in a professional studio with a seamless infinite white background. Preserve his exact facial features, skin tone, hairstyle, beard shape, and body proportions with high skin realism and natural texture. Dress him in the exact outfit from image 2: [DESCRIBE THE OUTFIT IN DETAIL]. Ensure the clothing fits naturally on his body with realistic fabric folds and weight. Use soft studio lighting, subtle ground shadow under the feet, centered full-body composition, ultra-realistic editorial fashion photography style, 85mm lens, sharp focus, high detail.",
        placeholders: [
          { key: "DESCRIBE THE OUTFIT IN DETAIL", label: "Outfit detail", example: "red gingham flannel shirt, wide-leg dark jeans, white sneakers, silver chain" },
        ],
        referenceSlots: [
          { key: "face", label: "Headshot", description: "Clear face photo — locks identity.", required: true },
          { key: "outfit", label: "Outfit reference", description: "Outfit inspiration photo.", required: true },
        ],
        usesPreviousResult: false,
        tips: [
          "Be extremely specific about the outfit: patterns, colors, fit, accessories, shoes. More detail = better match.",
        ],
        variants: [],
      },
      {
        id: "vehicle-scene",
        title: "Scene variation: subject + vehicle/prop",
        kind: "image",
        description: "Use your base shot as image 1 and a vehicle/prop photo as image 2.",
        promptTemplate:
          "Use image 1 as the identity and outfit reference, and image 2 as the vehicle reference. Take the subject from image 1 and place them leaning in a relaxed way on the front-left side of the exact same [VEHICLE DESCRIPTION] from image 2. Match the vehicle one-to-one. Preserve the subject's exact facial features, skin tone, hairstyle, beard shape, and body proportions with high skin realism and natural texture, keeping the exact same outfit from image 1 without alteration. Set the scene inside a professional studio with a seamless infinite white background, soft studio lighting, realistic reflections on the vehicle paint and rims, subtle ground shadow, ultra-realistic editorial fashion photography style, 85mm lens, sharp focus, high detail.",
        placeholders: [
          { key: "VEHICLE DESCRIPTION", label: "Vehicle", example: "black Mercedes-Maybach GLS" },
        ],
        referenceSlots: [
          { key: "vehicle", label: "Vehicle / prop reference", description: "Your dream car, bike, or any prop.", required: true },
        ],
        usesPreviousResult: true,
        tips: [],
        variants: [],
      },
      {
        id: "close-up",
        title: "Close-up detail shot",
        kind: "image",
        description: "This gives you the cinematic eye and mouth panels for the collage.",
        promptTemplate:
          "Tight close-up portrait from chest up, man in [OUTFIT DESCRIPTION], gold chain and accessories visible, [PROP/VEHICLE] blurred in background, soft studio rim lighting, editorial fashion photography, bokeh, 85mm lens, cinematic color grading with warm tones",
        placeholders: [
          { key: "OUTFIT DESCRIPTION", label: "Outfit", example: "red gingham shirt" },
          { key: "PROP/VEHICLE", label: "Prop / vehicle", example: "black Maybach" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [],
        variants: [],
      },
      {
        id: "angles",
        title: "Generate multiple angles",
        kind: "image",
        description: "Create 4-6 different angles from the same scene for variety in your collage.",
        promptTemplate:
          "Cinematic low-angle shot of a man leaning against a [VEHICLE] in a white studio, camera tilted upward from ground level, dramatic lighting from the left, shallow depth of field on the vehicle's front grille, fashion editorial style, 35mm anamorphic lens flare, moody contrast",
        placeholders: [{ key: "VEHICLE", label: "Vehicle", example: "black Maybach GLS" }],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [],
        variants: [
          { label: "Wide three-quarter rear", prompt: "Wide cinematic shot from the rear three-quarter angle of a [VEHICLE] with [WHEEL DETAILS], man standing at the front corner, white seamless backdrop, symmetrical composition, high-end automotive advertisement style, cool desaturated tones, IMAX resolution feel" },
          { label: "Side profile silhouette", prompt: "Cinematic side profile shot, man silhouetted against bright white background standing next to a [VEHICLE], strong backlight creating rim light on both the person and vehicle contours, minimal shadows, stark contrast, monochromatic mood, 24mm wide-angle lens perspective" },
          { label: "Overhead bird's-eye", prompt: "Top-down bird's-eye view of a [VEHICLE] on a white studio floor, man standing beside the driver-side door looking up at camera, graphic composition, clean geometric lines, luxury automotive campaign, high-fashion editorial, crisp studio lighting, drone perspective" },
          { label: "Dutch angle detail", prompt: "Dutch angle low shot focused on [DETAIL], man's legs visible in frame, [OUTFIT DETAILS], gritty cinematic texture, shallow depth of field, tungsten warm highlights on chrome trim, street-luxury aesthetic, 50mm prime lens" },
        ],
      },
      {
        id: "featured-model",
        title: "Add a featured model (optional)",
        kind: "image",
        description:
          "Want a second person? Use a face reference (e.g. from Pinterest) as image 1 and your generated outfit photo as image 2 — the AI dresses them in a coordinated outfit, same palette, same vibe.",
        promptTemplate:
          "Use image 1 as the identity reference for the featured model and image 2 as the outfit/style reference. Generate a full-body studio shot of the model in a coordinated outfit matching the color palette and aesthetic of image 2, adapted to their body type. Seamless infinite white background, soft studio lighting, subtle ground shadow, ultra-realistic editorial fashion photography style, 85mm lens, sharp focus, high detail.",
        placeholders: [],
        referenceSlots: [
          { key: "model-face", label: "Featured model face reference", description: "Any clear headshot.", required: true },
        ],
        usesPreviousResult: true,
        tips: ["Same fabric patterns, complementary colors — like a real styled photoshoot."],
        variants: [],
      },
      {
        id: "lipsync",
        title: "Lip sync the close-up",
        kind: "lipsync",
        description:
          "Upload your close-up image (chest-up works best) and your song audio. One lip sync gives you TWO collage panels: crop to the mouth for the lip-sync panel, crop to the eyes for the eyes panel.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["One generation, two clips!"],
        toolLink: { label: "Open Lip Sync", to: "/lipsync" },
        variants: [],
      },
      {
        id: "dolly-zoom",
        title: "Dolly zoom animation",
        kind: "video",
        description: "Use your close-up image with a cinematic motion prompt for subtle, editorial movement.",
        promptTemplate:
          "Tight chest-up framing of man in [OUTFIT DESCRIPTION], standing in front of [BACKGROUND] in white studio. Very slow dolly-in, fabric texture catches light, gold chain sways imperceptibly with a breath, [BACKGROUND] soft in background bokeh, intimate fashion editorial film, almost still, warm tones",
        placeholders: [
          { key: "OUTFIT DESCRIPTION", label: "Outfit", example: "red gingham shirt" },
          { key: "BACKGROUND", label: "Background element", example: "black Maybach" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [],
        variants: [],
      },
      {
        id: "dance",
        title: "Motion Control dance",
        kind: "motion",
        description:
          "Make your model dance: upload the generated full-body image as the reference and a TikTok/Instagram dance video as the motion reference. Face and outfit stay intact.",
        promptTemplate: "model dancing energetically in a white studio",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [],
        toolLink: { label: "Open Motion Control", to: "/motion" },
        variants: [],
      },
      {
        id: "capcut",
        title: "Assemble the collage in CapCut",
        kind: "instruction",
        description:
          "New 9:16 project (1080×1920), light gray or black background. For each clip: drag to its own track → Mask → Rectangle → Round corners 50% → resize to its panel shape (wide letterbox for eyes, square for full body) → position on canvas. Stack all tracks so panels play simultaneously, leave small gaps for the background. Add your song, cut to the beat, export 1080×1920 30fps.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [
          "Each clip goes on its own separate track.",
          "Layout idea: eyes letterbox on top, full body + featured model side by side, second eyes strip, lip-sync letterbox at the bottom.",
        ],
        variants: [],
      },
    ],
  },

  // ── 6. AI Artist Creation ─────────────────────────────────────────────────
  {
    slug: "create-your-ai-artist",
    title: "Create Your Own AI Artist",
    tagline: "Base character → de-AI realism → concepts → animation",
    description:
      "Build a complete AI artist from scratch in 4 steps: generate the foundational look, remove the 'AI look' with realistic skin texture, build 10-15 concept shots across locations and angles, then animate the best ones. Great for a whole roster of artists across music styles.",
    category: "character",
    icon: "🧑‍🎤",
    sourceCredit: "Sniply Studio",
    isPublished: true,
    sortOrder: 60,
    steps: [
      {
        id: "base-character",
        title: "Create your base character",
        kind: "image",
        description:
          "Generate 4-8 variations. Try different expressions (neutral, smiling, confident) and angles (front, 3/4, side profile). Pick the one with clear features, good lighting, realistic skin.",
        promptTemplate:
          "A photo realistic picture of a [ARTIST DESCRIPTION], professional photography, studio lighting, high quality, 8k resolution, detailed facial features, modern style",
        placeholders: [
          { key: "ARTIST DESCRIPTION", label: "Your artist", example: "black male artist wearing streetwear, 90s hip hop aesthetic" },
        ],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [
          "For different looks add \"wearing streetwear\" or \"in formal attire\"; for vibes add \"moody lighting\" or \"bright and energetic\".",
          "Avoid distorted features, blurry details, unnatural proportions.",
        ],
        variants: [],
      },
      {
        id: "de-ai",
        title: "De-AI processing",
        kind: "image",
        description:
          "Remove the 'AI look' by adding realistic skin texture, pores, and imperfections. Use your chosen character image as the reference. Generate 2-3 versions and compare.",
        promptTemplate:
          "Enhance with: natural skin texture, visible pores, subtle blemishes, realistic lighting, film grain, professional photography quality, remove artificial smoothness, add human imperfections",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [
          "The goal is a professional photoshoot look, not a 3D render — subtle is better than extreme.",
          "Not realistic enough? Add \"macro photography skin detail\".",
          "Save both the original and processed versions.",
        ],
        variants: [],
      },
      {
        id: "concepts",
        title: "Build your visual concepts & shots",
        kind: "image",
        description:
          "Define the vibe (urban? luxury? underground?), then create 10-15 shots across locations and angles — wide, medium, close-up, over-the-shoulder, low angle for power. Always use your character image as the reference to stay consistent.",
        promptTemplate:
          "[YOUR AI ARTIST] standing in urban city street at night, neon lights, cinematic photography, moody atmosphere, street style fashion, professional music video aesthetic",
        placeholders: [
          { key: "YOUR AI ARTIST", label: "Artist descriptor", example: "the artist from the reference image" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [
          "Storyboard before generating; think about how shots transition.",
          "Consider your music genre's visual language.",
        ],
        variants: [
          { label: "Luxury / high-end", prompt: "[YOUR AI ARTIST] in luxury penthouse, floor to ceiling windows, city skyline background, golden hour lighting, high fashion, editorial photography style" },
          { label: "Performance / stage", prompt: "[YOUR AI ARTIST] on concert stage, dramatic stage lighting, smoke effects, crowd in background, energetic performance, professional concert photography" },
          { label: "Intimate / studio", prompt: "[YOUR AI ARTIST] in recording studio, dim warm lighting, sitting at mixing board, creative atmosphere, behind the scenes vibe" },
        ],
      },
      {
        id: "animate",
        title: "Animate your shots",
        kind: "video",
        description:
          "Bring your best stills to life. Start with subtle animations — they look more realistic. Keep clips short (3-8s) for social media.",
        promptTemplate:
          "Subtle head movement, natural breathing, slight body sway, maintain facial features, smooth realistic motion, cinematic camera movement",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["Generate 2-3 versions of important shots."],
        variants: [
          { label: "Performance", prompt: "Artist performing energetically, natural gestures, confident movements" },
          { label: "Walking", prompt: "Slow confident walk towards camera, smooth motion" },
          { label: "Atmospheric", prompt: "Gentle camera push in, subject looking around, ambient movement" },
        ],
      },
      {
        id: "edit",
        title: "Put it all together",
        kind: "instruction",
        description:
          "Group clips by scene, arrange in story order, add your music, apply consistent color grading, add transitions. Export: Reels/TikTok 1080×1920 30fps; YouTube 1920×1080.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [
          "Content ideas: full music video, visualizer, promo clips, album artwork, lyric videos, tour visuals.",
          "Always disclose that your artist is AI-generated and check platform policies.",
        ],
        variants: [],
      },
    ],
  },

  // ── 7. Realism Formula ────────────────────────────────────────────────────
  {
    slug: "realism-formula-macro-skin",
    title: "The Realism Formula: Macro Skin",
    tagline: "Uncomfortably real macro shots — pores, texture, imperfections",
    description:
      "A master prompt system for extreme macro skin realism — ears, forehead, lips, neck tattoos, eyes, even a bandaged finger. Every shot reads like a dermatological study shot by a cinematographer. Use these as b-roll inserts to sell the realism of an AI artist.",
    category: "realism",
    icon: "🔬",
    sourceCredit: "Realism Formula",
    isPublished: true,
    sortOrder: 70,
    steps: [
      {
        id: "master",
        title: "The master macro prompt",
        kind: "image",
        description:
          "Tweak the highlighted attributes — body part, skin tone, imperfections — and generate. The preset variants below are ready-made shots from the same system.",
        promptTemplate:
          "Extreme macro photograph of [BODY PART]. [SKIN TONE] skin. Photorealistic, shot on medium format film. Raking side-top light at 45 degrees reveals every pore as a 3D crater with its own micro-shadow. Shallow depth of field — critical sharpness in the center, gentle optical falloff at edges. Visible: individual pore openings with depth, vellus peach fuzz catching sidelight, natural sebum sheen (uneven, concentrated on convex surfaces), subsurface color variation (veins, capillary flush, melanin gradients), micro-wrinkles between major features. [IMPERFECTION] rendered with full physical accuracy — casting micro-shadow, distinct texture from surrounding skin. Skin fills 85% of frame. Fine organic film grain throughout. Zero digital sharpening — all sharpness is optical. Lifted blacks — shadow detail preserved inside every pore. Soft highlight rolloff — specular sheen never clips. No makeup, no retouching, no smoothing, no filters. The skin must look uncomfortably real — a dermatological study shot by a cinematographer.",
        placeholders: [
          { key: "BODY PART", label: "Body part", example: "ear / cheek / forehead / knuckles / neck / collarbone" },
          { key: "SKIN TONE", label: "Skin tone", example: "deep brown-black / warm medium brown / olive-tan / pale with pink undertones" },
          { key: "IMPERFECTION", label: "Imperfection", example: "raised mole 4mm / healed scar 15mm / freckle cluster / none" },
        ],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [
          "Avoid: airbrushed, smooth skin, uniform tone, beauty lighting, ring light, porcelain, digital sharpening halos, CGI, plastic, flat lighting.",
          "For an extra pass, upscale 2x with low creativity and the prompt \"Add micro pores, micro hairs and sharp skin texture.\"",
        ],
        variants: [
          { label: "Ear + diamond stud", prompt: "Extreme macro photograph of right ear with round diamond stud earring. Warm medium brown skin. Full ear in profile filling frame — helix, antihelix, tragus, concha, and earlobe all visible, round brilliant-cut diamond stud earring in platinum four-prong setting on earlobe catching light, buzz cut stubble visible at hairline above ear, goatee stubble on jawline below and in front of ear, sage-green blurred background. Photorealistic, shot on medium format film. Raking side-top light at 45 degrees reveals every pore as a 3D crater with its own micro-shadow. Shallow depth of field — critical sharpness in the center, gentle optical falloff at edges. Visible: individual pore openings with depth, vellus peach fuzz catching sidelight, natural sebum sheen (uneven, concentrated on convex surfaces), subsurface color variation (veins, capillary flush, melanin gradients), micro-wrinkles between major features. Round brilliant-cut diamond stud in platinum setting on earlobe rendered with full physical accuracy — casting micro-shadow, distinct texture from surrounding skin. Skin fills 85% of frame. Fine organic film grain throughout. Zero digital sharpening — all sharpness is optical. Lifted blacks — shadow detail preserved inside every pore. Soft highlight rolloff — specular sheen never clips. No makeup, no retouching, no smoothing, no filters. The skin must look uncomfortably real — a dermatological study shot by a cinematographer." },
          { label: "Forehead wrinkles", prompt: "Extreme macro photograph of forehead from hairline to eyebrows. Warm medium brown skin. Full forehead filling frame with 3-4 deep horizontal wrinkle lines, short buzz cut stubble visible at top hairline edge, thick black eyebrow tops visible at bottom of frame, dense visible pores across entire surface. Photorealistic, shot on medium format film. Raking side-top light at 45 degrees reveals every pore as a 3D crater with its own micro-shadow. Shallow depth of field — critical sharpness in the center, gentle optical falloff at edges. Visible: individual pore openings with depth, vellus peach fuzz catching sidelight, natural sebum sheen (uneven, concentrated on convex surfaces), subsurface color variation (veins, capillary flush, melanin gradients), micro-wrinkles between major features. Deep horizontal forehead wrinkles 3-4 lines rendered with full physical accuracy — casting micro-shadow, distinct texture from surrounding skin. Skin fills 85% of frame. Fine organic film grain throughout. Zero digital sharpening — all sharpness is optical. Lifted blacks — shadow detail preserved inside every pore. Soft highlight rolloff — specular sheen never clips. No makeup, no retouching, no smoothing, no filters. The skin must look uncomfortably real — a dermatological study shot by a cinematographer." },
          { label: "Lips + chin", prompt: "Extreme macro photograph of lips and chin area. Pale beige with pink undertones skin. Closed lips filling upper portion of frame with visible vertical lip texture lines, pink-beige natural lip color, chin below with subtle cleft shadow, fine vellus peach fuzz visible on chin and around mouth, muted sage-green color cast over entire image. Photorealistic, shot on medium format film. Raking side-top light at 45 degrees reveals every pore as a 3D crater with its own micro-shadow. Shallow depth of field — critical sharpness in the center, gentle optical falloff at edges. Visible: individual pore openings with depth, vellus peach fuzz catching sidelight, natural sebum sheen (uneven, concentrated on convex surfaces), subsurface color variation (veins, capillary flush, melanin gradients), micro-wrinkles between major features. Vertical lip lines on both lips rendered with full physical accuracy — casting micro-shadow, distinct texture from surrounding skin. Skin fills 85% of frame. Fine organic film grain throughout. Zero digital sharpening — all sharpness is optical. Lifted blacks — shadow detail preserved inside every pore. Soft highlight rolloff — specular sheen never clips. No makeup, no retouching, no smoothing, no filters. The skin must look uncomfortably real — a dermatological study shot by a cinematographer." },
          { label: "Neck tattoo", prompt: "Extreme macro photograph of neck and throat with tattoo. Deep brown-black skin. Front of neck filling frame, black ink tattoo reading [TATTOO TEXT] in capital serif letters across lower throat, Adam's apple visible at top, tan/beige button-up shirt collar with metal button visible at bottom edge, chin shadow at top of frame, visible pores and fine stubble across neck surface. Photorealistic, shot on medium format film. Raking side-top light at 45 degrees reveals every pore as a 3D crater with its own micro-shadow. Shallow depth of field — critical sharpness in the center, gentle optical falloff at edges. Visible: individual pore openings with depth, vellus peach fuzz catching sidelight, natural sebum sheen (uneven, concentrated on convex surfaces), subsurface color variation (veins, capillary flush, melanin gradients), micro-wrinkles between major features. Black ink tattoo across lower neck rendered with full physical accuracy — casting micro-shadow, distinct texture from surrounding skin. Skin fills 85% of frame. Fine organic film grain throughout. Zero digital sharpening — all sharpness is optical. Lifted blacks — shadow detail preserved inside every pore. Soft highlight rolloff — specular sheen never clips. No makeup, no retouching, no smoothing, no filters. The skin must look uncomfortably real — a dermatological study shot by a cinematographer." },
          { label: "Single eye", prompt: "Extreme macro photograph of single eye extreme close-up. Deep brown-black with olive-green color cast skin. Single eye filling frame, dark brown iris with visible radial fibers and light reflection, white sclera with subtle cream tone, short natural eyelashes, smooth eyelid with fine crease, surrounding orbital skin with visible pore texture. Photorealistic, shot on medium format film. Raking side-top light at 45 degrees reveals every pore as a 3D crater with its own micro-shadow. Shallow depth of field — critical sharpness in the center, gentle optical falloff at edges. Visible: individual pore openings with depth, vellus peach fuzz catching sidelight, natural sebum sheen (uneven, concentrated on convex surfaces), subsurface color variation (veins, capillary flush, melanin gradients), micro-wrinkles between major features. Fine under-eye texture rendered with full physical accuracy — casting micro-shadow, distinct texture from surrounding skin. Skin fills 85% of frame. Fine organic film grain throughout. Zero digital sharpening — all sharpness is optical. Lifted blacks — shadow detail preserved inside every pore. Soft highlight rolloff — specular sheen never clips. No makeup, no retouching, no smoothing, no filters. The skin must look uncomfortably real — a dermatological study shot by a cinematographer." },
          { label: "Bandaged pinky", prompt: "Extreme macro photograph of pinky finger wrapped in fabric bandaid. Deep brown-black skin. Small pinky finger with woven beige/tan fabric bandaid wrapped around the middle section, white gauze pad visible in center of bandaid, finger emerging from powder-blue fabric sleeve. Photorealistic, shot on medium format film. Raking side-top light at 45 degrees reveals every pore as a 3D crater with its own micro-shadow. Shallow depth of field — critical sharpness in the center, gentle optical falloff at edges. Visible: individual pore openings with depth, vellus peach fuzz catching sidelight, natural sebum sheen (uneven, concentrated on convex surfaces), subsurface color variation (veins, capillary flush, melanin gradients), micro-wrinkles between major features. Woven fabric bandaid wrapped around finger rendered with full physical accuracy — casting micro-shadow, distinct texture from surrounding skin. Skin fills 85% of frame. Fine organic film grain throughout. Zero digital sharpening — all sharpness is optical. Lifted blacks — shadow detail preserved inside every pore. Soft highlight rolloff — specular sheen never clips. No makeup, no retouching, no smoothing, no filters. The skin must look uncomfortably real — a dermatological study shot by a cinematographer." },
        ],
      },
      {
        id: "animate",
        title: "Animate your macro shots",
        kind: "video",
        description: "Once you have your shots, animate them with subtle motion for texture-rich b-roll.",
        promptTemplate:
          "Extreme macro skin shot, subtle natural micro-movement, breathing, light shifting across pores, film grain, cinematic realism, no camera movement",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [],
        variants: [],
      },
    ],
  },

  // ── 8. Static Subject, Morphing Background ────────────────────────────────
  {
    slug: "morphing-background",
    title: "Static Subject, Morphing Background",
    tagline: "You stay frozen while the world transforms behind you",
    description:
      "The trending effect where the camera and subject stay perfectly locked while the environment seamlessly transforms behind them. Build a character sheet, lock your spatial position, generate environment variations, then animate each background with micro-motions.",
    category: "effects",
    icon: "🌀",
    sourceCredit: "InVideo Agent One guide",
    isPublished: true,
    sortOrder: 80,
    steps: [
      {
        id: "character-sheet",
        title: "Build your character sheet",
        kind: "image",
        description:
          "Upload a few clear photos of yourself and generate a multi-angle character sheet with identical facial geometry, clothing and lighting.",
        promptTemplate:
          "Create a full character sheet of the person in the reference images wearing [OUTFIT DESCRIPTION]: multi-angle consistent views (front, 3/4, side), identical facial structure, clothing style, and lighting conditions across every angle, neutral studio background, photorealistic, high detail.",
        placeholders: [
          { key: "OUTFIT DESCRIPTION", label: "Outfit", example: "black hoodie, cargo pants, white sneakers" },
        ],
        referenceSlots: [
          { key: "you", label: "Your reference photos", description: "A few clear source photos of you or your subject.", required: true },
        ],
        usesPreviousResult: false,
        tips: [],
        variants: [],
      },
      {
        id: "lock-position",
        title: "Lock the spatial position",
        kind: "image",
        description:
          "Establish the static point where your character stands in the frame — this locks framing, focal distance and orientation so perspective never jitters between backgrounds.",
        promptTemplate:
          "Place the character from the reference in [LOCATION DESCRIPTION], standing in a fixed centered position, full body visible, static camera framing, consistent focal length and orientation, photorealistic, cinematic lighting.",
        placeholders: [
          { key: "LOCATION DESCRIPTION", label: "Base location", example: "an empty urban street at dusk" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [],
        variants: [],
      },
      {
        id: "variations",
        title: "Generate environment variations",
        kind: "image",
        description:
          "Queue multiple environments behind your locked subject — keep the character, pose, framing and camera identical; only the background changes.",
        promptTemplate:
          "Keep the character, pose, framing, camera angle and lighting on the subject EXACTLY identical to the reference image. Change only the environment behind them to: [NEW ENVIRONMENT]. Photorealistic, seamless integration, consistent perspective and ground plane.",
        placeholders: [
          { key: "NEW ENVIRONMENT", label: "New environment", example: "post-apocalyptic alleyway with fires, smoke, and street debris" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["Generate 3-6 variations for a satisfying morph sequence."],
        variants: [
          { label: "Luxury studio", prompt: "Keep the character, pose, framing, camera angle and lighting on the subject EXACTLY identical to the reference image. Change only the environment behind them to: a hyper-clean studio setup with an exotic red luxury vehicle. Photorealistic, seamless integration, consistent perspective and ground plane." },
          { label: "Stylized art block", prompt: "Keep the character, pose, framing, camera angle and lighting on the subject EXACTLY identical to the reference image. Change only the environment behind them to: a stylized artistic set with a dynamic horse element in the backdrop. Photorealistic, seamless integration, consistent perspective and ground plane." },
        ],
      },
      {
        id: "animate",
        title: "Animate each background",
        kind: "video",
        description:
          "Animate your favorite variations: the background gets micro-motions (smoke, flames, spinning rims) while the subject stays flawlessly locked.",
        promptTemplate:
          "Subject remains perfectly still and locked in place, camera completely static. Only the background environment animates with subtle micro-motions: [BACKGROUND MOTION]. Seamless, realistic, cinematic.",
        placeholders: [
          { key: "BACKGROUND MOTION", label: "Background motion", example: "drifting smoke, flame ripples, flickering light" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [],
        variants: [],
      },
      {
        id: "edit",
        title: "The editing sauce",
        kind: "instruction",
        description:
          "Overlay the clips in your editor so the eye-line and body stay perfectly registered frame-to-frame. Slice each background transition exactly on heavy beats, and add a distinct SFX for each shift — sub drops, whooshes, camera shutters, explosive snaps.",
        promptTemplate: "",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [],
        variants: [],
      },
    ],
  },

  // ── 9. Agent-style Scene Building (16mm film look) ───────────────────────
  {
    slug: "complete-scene-16mm",
    title: "Build a Complete Scene (16mm Film Look)",
    tagline: "From one paragraph to a fully produced shot list",
    description:
      "Don't overthink the brief — one paragraph is enough. Describe your concept, cast, vehicle and location, let AI expand it into a production breakdown, then generate each shot with deep-focus 16mm film prompts. The example: a man and a chimpanzee rob a bank in the Albuquerque desert.",
    category: "music-video",
    icon: "🎞️",
    sourceCredit: "Triv / Agent One guide",
    isPublished: true,
    sortOrder: 90,
    steps: [
      {
        id: "brief",
        title: "Write the one-paragraph brief",
        kind: "text",
        description:
          "Send one plain paragraph to Aurora's Agent — concept, vehicle, cast, location. It comes back with a scene-by-scene shot list, camera angles, character behavior, and color direction.",
        promptTemplate:
          "Create a complete production breakdown for this concept: [YOUR CONCEPT]. Cast: [CAST]. Vehicle/props: [PROPS]. Location: [LOCATION]. Return a scene-by-scene shot list with camera angles, character behavior descriptions, location detail, and color direction for each sequence.",
        placeholders: [
          { key: "YOUR CONCEPT", label: "Concept", example: "a man and a chimpanzee rob a bank in the Albuquerque desert" },
          { key: "CAST", label: "Cast", example: "TRIV and his chimpanzee sidekick" },
          { key: "PROPS", label: "Vehicle / props", example: "red Ferrari Testarossa" },
          { key: "LOCATION", label: "Location", example: "flat New Mexico desert, a bank, a dive bar" },
        ],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: ["It will give you angles you hadn't thought of — ground-level POVs, mirror shots, environmental storytelling."],
        toolLink: { label: "Open Aurora Agent", to: "/agent" },
        variants: [],
      },
      {
        id: "hero-shot",
        title: "Generate the hero shot",
        kind: "image",
        description:
          "Generate each shot from your breakdown. The example prompts below show the exact 16mm-film language that makes these look shot on real film — deep focus, handheld drift, organic grain.",
        promptTemplate:
          "[SHOT DESCRIPTION]. Hard natural midday sun, dust in the air. Shot on 16mm film. 14mm lens, f/8.0. Everything in deep focus, all sharp. Handheld, slight drift. Visible film grain, natural and organic. No digital sharpening, no bloom, no lens flare.",
        placeholders: [
          { key: "SHOT DESCRIPTION", label: "Shot description", example: "A man steps out of a red Ferrari Testarossa, driver door swung open, one leg on the ground…" },
        ],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: ["Keep the film-stock language (16mm, deep focus, grain, no bloom) byte-identical across every shot for a consistent look."],
        variants: [
          { label: "Outside the bank (example)", prompt: "A man steps out of a red Ferrari Testarossa, driver door swung open, one leg already on the ground. White ribbed sleeveless tank top, straight blue jeans, tall brown leather cowboy boots. Black duffel bag in hand. A chimpanzee climbs out simultaneously from the other side, tactical backpack strapped to its back, automatic rifle in hand. Behind them: a small single-story stucco bank building, sun-bleached beige walls, no signage, flat cracked asphalt parking lot, American flag on a pole, flat Albuquerque desert stretching wide, red mesa formations under a pale blue sky. Hard natural midday sun, dust in the air. Shot on 16mm film. 14mm lens, f/8.0. Everything in deep focus, all sharp. Handheld, slight drift. Visible film grain, natural and organic. No digital sharpening, no bloom, no lens flare." },
          { label: "The wanted poster (example)", prompt: "Medium shot. A weathered wooden electricity pole stands in the left foreground, close to the camera, dominating the left half of the frame. Stapled to the pole facing the camera is a wanted poster — large, printed on yellowed paper, edges curling, sun-bleached. The poster reads \"WANTED\" across the top in bold block letters. Below it two images side by side — the man on the left, the chimpanzee on the right. A reward amount printed below. The poster is slightly crooked, stapled at the top corners, flapping slightly in the desert wind. The pole itself is old — cracked wood, a few old staples and torn paper scraps from previous postings. The right half of the frame opens up to the flat two-lane Albuquerque desert road stretching back into the distance — yellow center line, cracked asphalt, sparse scrub on the shoulders, red mesa formations in the far distance, pale blue sky above. Hard natural midday sun casting a sharp shadow from the pole across the dirt shoulder. The poster catches the direct sunlight — warm, bleached, real. Shot on 16mm film. 14mm lens, f/8.0. The pole and the wanted poster sharp in the foreground, the desert road sharp behind to the right. Handheld, slight drift. Visible film grain, natural and organic. No digital sharpening, no bloom, no lens flare." },
          { label: "The dive bar (example)", prompt: "A man and a chimpanzee sit side by side in a worn leather booth inside a dark dive bar. The man wears a white ribbed sleeveless tank top, straight blue jeans, tall brown leather cowboy boots. He has a whiskey glass in hand, leaning back in the booth, laughing — head tilted, completely relaxed, totally at ease. The chimpanzee sits right beside him, its own drink on the table in front of it, also animated — mouth open, vocalizing, rocking slightly with energy, the way a chimp does when it is excited and happy. Black coarse fur, bare dark facial skin, compact muscular build. They are mid-conversation, mid-laugh, like two guys celebrating after a long day. The black duffel bag sits on the table between them, unzipped, fat stacks of banded cash visible spilling out. The bar around them: dark wood paneling, sticky vinyl booths, old framed photos on the walls, a glowing beer neon sign casting warm red light across the scene, dim pendant lights above, a half-empty bottle of whiskey on the table, beer glasses, ashtrays. The whole space is dark, warm, amber-toned. Nobody else in the bar is paying attention. Shot on 16mm film. 14mm lens, f/8.0. Everything in deep focus — both figures, the duffel bag, the neon sign, the bar interior, all sharp. Handheld, slight drift. Visible film grain, natural and organic. No digital sharpening, no bloom, no lens flare." },
        ],
      },
      {
        id: "animate",
        title: "Animate the shots",
        kind: "video",
        description: "Animate your favorite stills — keep motion natural and restrained to preserve the film look.",
        promptTemplate:
          "Subtle natural movement, characters breathing and shifting weight, ambient motion in the environment (dust, wind, flags). Handheld 16mm film feel with slight drift, organic grain, no digital sharpening.",
        placeholders: [],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: [],
        variants: [],
      },
    ],
  },

  // ── 10. Storyboard → 15s Film ─────────────────────────────────────────────
  {
    slug: "storyboard-15s-film",
    title: "15-Second Film from One Image",
    tagline: "Image → storyboard → prompt → video, all connected",
    description:
      "Go from a single key visual to a complete 15-second cinematic film. Create your key image, break it into a storyboard, turn the storyboard into a structured timestamped video prompt, then generate the final video. Swap the key visual and you have a whole new film in minutes.",
    category: "music-video",
    icon: "📋",
    sourceCredit: "Freepik Spaces guide",
    isPublished: true,
    sortOrder: 100,
    steps: [
      {
        id: "key-visual",
        title: "Create your key visual",
        kind: "image",
        description:
          "Everything begins with one image. Generate a few variations — the one you pick defines the visual tone of the whole film.",
        promptTemplate:
          "analog photography. no framings or text. close-up to the subject's face. subject is [SUBJECT DESCRIPTION]. [STYLING DETAILS]. setting is [SETTING]. background out of focus. diffused lighting. subject gazing off camera.",
        placeholders: [
          { key: "SUBJECT DESCRIPTION", label: "Subject", example: "a young woman with black hair and golden jeweled hairclips" },
          { key: "STYLING DETAILS", label: "Styling", example: "bleached brows, subtle freckles, wearing a red tracksuit jacket" },
          { key: "SETTING", label: "Setting", example: "a city" },
        ],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [],
        variants: [],
      },
      {
        id: "storyboard",
        title: "Write your storyboard",
        kind: "text",
        description:
          "Break your visual into a numbered sequence of scenes — each one a moment, setting, or framing that builds the narrative. This becomes your shot list.",
        promptTemplate:
          "Based on the key visual, write a storyboard of [NUMBER OF SCENES] scenes for a short fashion film. The vibe: [VIBE]. Each scene is one line: shot type + what happens. Example format: \"1. Frontal shot. sitting on a bus stop, human-sized stuffed animal around her. 2. Close-up. about to bite a sandwich, jewels on her teeth. 3. Aerial shot. walking down the street…\"",
        placeholders: [
          { key: "NUMBER OF SCENES", label: "Scene count", example: "6" },
          { key: "VIBE", label: "Vibe", example: "playful, surreal — surrounded by human-size pastel stuffed animals" },
        ],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: ["Generate a few storyboard variations and pick the one that tells the best story."],
        toolLink: { label: "Open Aurora Agent", to: "/agent" },
        variants: [],
      },
      {
        id: "video-prompt",
        title: "Build the timestamped video prompt",
        kind: "text",
        description: "Turn your storyboard into a structured video prompt with timestamps.",
        promptTemplate:
          "Based on this fashion film storyboard, create a video prompt for a 15-second video. Dynamic cuts, smooth transitions, cinematic camera movements. The vibe is [VIBE]. No background music, coherent SFX. High quality. Use timestamps. Be sure to include every scene in the storyboard in order. Use this prompt structure: [Scene Setting] [Visual Style] [Lighting] [Key Textures] [Type of Video] [Sound Design] then \"0–Xs —\" lines for each scene. Storyboard: [STORYBOARD]",
        placeholders: [
          { key: "VIBE", label: "Vibe", example: "playful" },
          { key: "STORYBOARD", label: "Paste your storyboard", example: "1. Frontal shot… 2. Close-up…" },
        ],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: [],
        toolLink: { label: "Open Aurora Agent", to: "/agent" },
        variants: [],
      },
      {
        id: "generate-video",
        title: "Generate the film",
        kind: "video",
        description:
          "Use your key visual as the start frame and paste the structured, timestamped prompt. Longer durations work best for storyboard films — a consistent character, setting and tone across every cut.",
        promptTemplate: "[PASTE YOUR TIMESTAMPED VIDEO PROMPT]",
        placeholders: [
          { key: "PASTE YOUR TIMESTAMPED VIDEO PROMPT", label: "Timestamped prompt", example: "[Scene Setting] a city in daylight… 0–3s — she crosses the sidewalk…" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["Save this workflow and reuse it — swap the key visual, adjust the storyboard, and you have a new film in minutes."],
        variants: [],
      },
    ],
  },

  // ── 11. Character Scene Pack ──────────────────────────────────────────────
  {
    slug: "character-scene-pack",
    title: "Character Scene Pack",
    tagline: "One character sheet, six cinematic scenes",
    description:
      "Build your character once, then keep them across every scene: werewolf transformation, floating popcorn in an old cinema, a time-freeze on a city street, an arthouse fight, an office chase, and a surreal multi-world music video. Add your character sheet as reference, pick a scene, paste the full prompt.",
    category: "effects",
    icon: "🎭",
    sourceCredit: "Prompt Share — Character Sheet",
    isPublished: true,
    sortOrder: 110,
    steps: [
      {
        id: "sheet",
        title: "Generate your character sheet",
        kind: "image",
        description: "Create a multi-angle character sheet — it becomes the identity reference for every scene.",
        promptTemplate:
          "Full character sheet of [CHARACTER DESCRIPTION]: multi-angle consistent views (front, 3/4, side, back), identical facial structure and outfit across all angles, neutral background, photorealistic, high detail, consistent lighting.",
        placeholders: [
          { key: "CHARACTER DESCRIPTION", label: "Your character", example: "a young Black male athlete wearing a magenta American football uniform" },
        ],
        referenceSlots: [
          { key: "you", label: "Optional identity photos", description: "Add photos to base the character on yourself.", required: false },
        ],
        usesPreviousResult: false,
        tips: [],
        variants: [],
      },
      {
        id: "scene",
        title: "Pick a scene and generate",
        kind: "video",
        description:
          "Use your character sheet as the reference image, pick a scene prompt below, adapt the subject line to your character, and generate.",
        promptTemplate:
          "ultra cinematic werewolf transformation scene on an empty American football field, intense, dramatic, high realism, no music, only environmental sound. subject: [YOUR CHARACTER], alone on the field. environment: – empty football stadium at night, stadium lights casting strong highlights and deep shadows – subtle wind, quiet and eerie atmosphere. scene progression: opening – wide shot: he stands alone in the middle of the field – calm, slightly tense atmosphere. first signs – medium close-up: he feels something wrong in his body – subtle discomfort, breathing becomes heavier. pain onset – he grabs his arm or chest – body starts to tense, muscles contracting – he drops to his knees, struggling. transformation begins – he starts screaming in pain – muscles visibly expanding and shifting under the skin – bones subtly restructuring (non-graphic, cinematic). physical change – hands begin to elongate and change shape – posture becomes more animalistic – face partially transforms (suggested through shadow and movement, not graphic). intensification – camera moves dynamically around him – strong lighting flickers, emphasizing transformation – his scream transitions into a more primal sound. final moment – he rises partially transformed, breathing heavily – silhouette suggests a werewolf-like figure. visual style: – ultra cinematic, high contrast, dramatic lighting – cold tones with strong highlights from stadium lights – heavy shadows to keep transformation suggestive and aesthetic. effects: – subtle body deformation (non-graphic) – motion blur, light flicker, slight camera shake. sound design: – no music – wind, distant stadium ambience – breathing, bones shifting (subtle), painful scream evolving into a growl. camera: – mix of close-ups, handheld shots, and wide cinematic angles – dynamic movement during transformation. mood: – intense, painful, raw, cinematic, dramatic. ultra realistic, film-level quality",
        placeholders: [
          { key: "YOUR CHARACTER", label: "Your character", example: "a young Black male athlete wearing a magenta American football uniform (no helmet)" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["Same character, new scene — push it again with a different variant."],
        variants: [
          { label: "Gravity (floating cinema)", prompt: "ultra cinematic surreal cinema scene, elegant and atmospheric, superhero movie style realism, no music, only environmental sound. subject: [YOUR CHARACTER] sitting alone in an empty vintage movie theater. environment: – beautiful old cinema, classic architecture, velvet seats, warm textures, slightly worn but elegant – only light source is the movie screen, flickering light illuminating the space – dust particles visible in the air, soft haze. scene progression: opening shot – wide shot of the empty cinema, character sitting alone in the middle row – soft screen light flickering across the room. quiet moment – close-up: character holding a bucket of popcorn – ambient silence, subtle projector sound. trigger moment – a few popcorn pieces slowly start to lift from the bucket – floating gently in the air, unnatural but smooth motion. reaction – character notices, confused expression – looks around, then back at the floating popcorn. escalation – more popcorn begins to levitate and drift, spreading through the air – slow-motion floating particles, orbiting softly around him. full surreal moment – the character's body begins to lift slowly from the seat – he floats upward, slightly rotating – expression shifts to surprise and subtle fear. peak shot – wide cinematic frame: character suspended mid-air in the theater – popcorn floating all around like particles – light from the screen creating dramatic highlights and shadows. visual style: – ultra cinematic lighting, strong contrast, deep shadows – soft glow from the screen, flickering light patterns – warm tones mixed with subtle cool shadows. effects: – slow motion, floating particles, dust, popcorn pieces – slight lens flares, film grain, soft diffusion. camera: – slow, smooth cinematic movements – wide establishing shots + intimate close-ups. mood: – mysterious, elegant, surreal, immersive, visually aesthetic" },
          { label: "Time-freeze (city street)", prompt: "ultra cinematic time-freeze sequence triggered by music pause, dynamic, stylized realism, no music in final output, only environmental sound. subject: [YOUR CHARACTER], casual athletic look. environment: – urban street in daylight, people walking, cars moving, natural city life – realistic lighting and textures. scene progression: opening (real-time) – medium shot: she walks through the street with headphones, holding her phone – subtle indication she is listening to music (head nod, rhythm in steps) – the surrounding world in motion: pedestrians, traffic, movement everywhere. focus moment – close-up of her hand holding the phone – thumb moves toward the pause button. trigger (key moment) – she taps pause – exact instant → everything around her freezes mid-motion. freeze effect detail – people stop mid-step, frozen in unnatural poses – hair, clothing, and objects suspended – a moving object (like a cup or bag) frozen mid-air. contrast – she keeps walking normally through the frozen world – only her movement continues. interaction moment – she casually approaches a frozen person holding a smoothie – takes it from their hand – drinks from it while continuing to move. visual style – strong contrast between dynamic subject vs completely static environment – natural daylight, slightly stylized. effects: – instant time-freeze transition at button press – frozen particles, suspended motion – subtle motion blur only on her. sound design: – no music – ambient city sounds → abruptly cut or drop into silence at pause moment – subtle wind or movement sound as she moves. camera: – smooth tracking shots – close-ups for trigger moment – wide shots to emphasize frozen world. mood: – surreal, playful, cinematic, visually striking. ultra realistic, cinematic quality" },
          { label: "Fight (arthouse parking lot)", prompt: "cinematic action scene with arthouse sensibility, grounded realism + slow, poetic tension, no music, only environmental sound. subject: [YOUR CHARACTER], facing a tall, very muscular blond man, both serious and focused. environment: – empty parking lot at night, concrete textures, minimal architecture – cold, natural lighting from street lamps – wet ground reflecting light, subtle fog or mist. mood: – tense, minimal, introspective but violent, long pauses between bursts of action. scene progression: opening – wide static shot of both characters facing each other in silence – ambient sound: distant traffic, wind, faint hum of lights. build-up – slow close-ups: hands tightening, subtle breathing, eye contact – long takes, minimal camera movement. fight begins – sudden, sharp burst of movement – martial arts-style combat, precise and grounded – no exaggerated choreography, realistic impacts. dynamic sequence – mix of slow, observational shots and sudden fast movements – bodies colliding, slipping on wet ground, heavy breathing – camera stays mostly restrained, occasionally handheld for impact. visual style – naturalistic lighting, deep shadows, muted colors – minimal stylization, but highly aesthetic framing – long takes mixed with selective cuts. climax – tension builds, both exhausted – sudden punch from the blond man. final shot – extreme close-up in slow motion of the punch hitting the protagonist's face – skin deformation, sweat particles, subtle droplets in the air – time slows dramatically. sound design: – no music – punches, footsteps, breathing, fabric movement – ambient night sounds (wind, distant cars, electric hum). camera: – mostly static or slow controlled movement – occasional handheld during impact – intimate close-ups + wide minimal compositions. color palette: – desaturated tones, cold lighting, realistic colors. mood: – raw, emotional, heavy, cinematic, grounded realism. ultra realistic, film-level quality" },
          { label: "Chase (office parkour)", prompt: "ultra cinematic chase sequence inside a corporate office, high tension, stylized realism, thriller-inspired aesthetic, no music, only environmental sound. subject: [YOUR CHARACTER], composed but determined. environment: – minimalist corporate office, clean geometry, glass walls, repetitive cubicles – cold lighting, slightly green/neutral tones – reflective surfaces, polished floors. antagonists: – multiple figures in full-body magenta teddy bear costumes, surreal and unsettling – carrying weapons, moving in coordinated, controlled manner. scene progression: opening – calm office environment, subtle ambient noise (computers, air conditioning) – character working or walking through the office. intrusion – sudden entrance of masked figures in magenta teddy suits – glass doors opening aggressively, tension rises instantly. realization + escape – close-up: character notices them, shifts to alert expression – immediately starts running. parkour sequence – jumping over desks, sliding across surfaces – knocking objects aside, dynamic movement – camera tracking fast, low angles, handheld energy. vertical escape – running into stairwell – fast climbing, using railings, skipping steps, wall-assisted movement – pursuers following closely. rooftop transition – door bursts open → rooftop at night or sunset – strong wind, city skyline visible. climax jump – sprints and jumps from one building to another – slow motion mid-air, dramatic lighting, tension peak. visual style: – ultra cinematic, high contrast lighting – clean, geometric framing inside office – motion blur, subtle lens flares, light reflections – mix of cold tones (office) and warmer tones (rooftop). effects: – dynamic camera shake during chase – slow motion for key jumps – slight stylization. sound design: – no music – footsteps, breathing, objects crashing – distant city sounds, wind on rooftop. camera: – fast tracking shots, handheld feel during action – low angles for movement – wide cinematic shots on rooftop. mood: – tense, surreal, high-adrenaline, visually striking. ultra realistic, cinematic quality" },
          { label: "Music video (multi-world)", prompt: "hyper dynamic music video-style visual, surreal transitions, ultra cinematic, high energy. subject: [YOUR CHARACTER], rapping with strong attitude and presence. composition: a multi-layered or collage-style frame that captures different moments in one image, as if frozen from a fast-paced music video. main scene: – night urban street, wet asphalt, neon reflections – character in the center rapping intensely – dancers around him performing choreography, all dressed in white, dynamic poses. transition effect 1: – dramatic fast zoom into his mouth, distorted perspective, motion blur, stretched geometry. second scene emerging: – jungle environment, lush greenery, humid atmosphere – dancers now dressed in magenta, continuing choreography. transition effect 2: – another aggressive zoom distortion, tunnel-like effect, warped visuals. third scene emerging: – desert landscape, minimal, harsh light – dancers dressed in black, strong silhouettes, powerful poses. style: – very dynamic composition, layered or fragmented transitions within one frame – surreal blending of environments (city / jungle / desert coexisting visually). effects: – heavy motion blur, zoom distortion, chromatic aberration – light streaks, glow, grain, slight glitch feeling – depth layering and warped perspective. color palette: – strong contrast between neon night tones, lush greens, and desert neutrals – accents of white, magenta, and black outfits. mood: – energetic, chaotic, stylish, experimental, music video energy. camera feel: – wide lens distortion (24mm), extreme zoom effect simulation. ultra high resolution, no watermark" },
        ],
      },
    ],
  },

  // ── 12. Head Animations ───────────────────────────────────────────────────
  {
    slug: "caricature-head-animations",
    title: "Caricature Head Animations",
    tagline: "Grotesque hyperreal floating heads, exaggerated to the max",
    description:
      "The underground art-toy look: generate a levitating, heavily caricatured head with ultra-hyperrealistic skin on a clean background, then animate it with wildly exaggerated facial animation — manic laughter, swinging earrings, trembling cheeks — while every texture stays photoreal.",
    category: "effects",
    icon: "🗿",
    sourceCredit: "Freepik AI Suite guide",
    isPublished: true,
    sortOrder: 120,
    steps: [
      {
        id: "head-png",
        title: "Generate the caricature head",
        kind: "image",
        description:
          "A floating head, no body or neck, isolated on a clean solid background. Exaggerated anatomy + hyperreal skin is the whole trick.",
        promptTemplate:
          "A levitating [CHARACTER DESCRIPTION] head, no body or neck, isolated on a [BACKGROUND COLOR] background. Strongly exaggerated, caricatured facial anatomy with ultra-hyperrealistic skin textures. [FEATURE EXAGGERATIONS]. Intense expression, eyes locked to camera. [DETAILS — TATTOOS, PIERCINGS, HAIR]. Ultra-hyperrealistic skin: visible pores, micro-wrinkles, oil, blemishes, peach fuzz, uneven pigmentation. No cracks, no seams. Hard studio lighting, high contrast, shadows emphasizing pores and anatomy. Underground art-toy aesthetic, grotesque but refined, post-human street culture energy. Ultra-high resolution, PBR, subsurface scattering, sharp macro detail — like a photographed physical sculpture.",
        placeholders: [
          { key: "CHARACTER DESCRIPTION", label: "Character", example: "Black male" },
          { key: "BACKGROUND COLOR", label: "Background", example: "pure white" },
          { key: "FEATURE EXAGGERATIONS", label: "Exaggerated features", example: "Oversized light blue eyes with visible veins, small flattened nose, extremely thick sculptural lips, large asymmetrical ears" },
          { key: "DETAILS — TATTOOS, PIERCINGS, HAIR", label: "Details", example: "Face tattoos under eyes and on temples, multiple ear piercings, red braided hair with visible scalp and frizz" },
        ],
        referenceSlots: [],
        usesPreviousResult: false,
        tips: ["Aggressive, dominant proportions that feel confrontational read best."],
        variants: [],
      },
      {
        id: "animate",
        title: "Animate the head",
        kind: "video",
        description:
          "Exaggerated, cartoon-like facial animation with fully realistic textures — the contrast is the effect. Camera stays completely static.",
        promptTemplate:
          "A floating hyperrealistic head on a clean neutral background. The character is clearly [EMOTION/ACTION] in an exaggerated, manic way. The expression is unmistakable: the mouth opens wide repeatedly, corners of the lips stretch unnaturally, teeth fully visible, cheeks lift and tremble, and the jaw shakes with each burst. Eyes widen, eyebrows bouncing sharply in rhythm. The head makes small, sharp movements, causing the earrings and piercings to visibly sway, bounce, and slightly swing with inertia. Facial muscles contract intensely, wrinkles deepen, skin stretches realistically. Movements are highly exaggerated and cartoon-like, while skin, eyes, teeth, metal, and hair remain ultra-realistic. The head stays floating and centered. Camera remains completely static, focus entirely on expressive facial animation and secondary motion.",
        placeholders: [
          { key: "EMOTION/ACTION", label: "Emotion / action", example: "laughing" },
        ],
        referenceSlots: [],
        usesPreviousResult: true,
        tips: ["Secondary motion sells it — earrings swinging naturally with head movement."],
        variants: [],
      },
    ],
  },
];
