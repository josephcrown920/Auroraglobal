import { ConceptBox, CustomizeTable, NeedBox, PromptBlock, SectionHeader, Step, TipBox } from "./shared";
import { C } from "./tokens";

// ─── Section 2: Motion Control ────────────────────────────────────────────────

export function TutorialMotion() {
  const baseScenePrompt = `Create a hyper-realistic composite image using the five provided reference images, using the man from the uploaded close-up selfie as the primary identity source, preserving his exact facial features, skin tone, complexion, beard texture, hairstyle, eye detail, and overall likeness with absolute accuracy, replacing the person in the microphone staging reference image with this subject while keeping the same pose, body positioning, framing, perspective, and camera angle exactly as in that reference, dressing the subject in the exact outfit from the outfit reference image consisting of the camo Supreme hoodie, olive green pants, and white Adidas sneakers with accurate colors, fabric textures, proportions, and fit, placing the subject outdoors in front of the Learning Center building from the building reference image as the main background environment, and additionally incorporating the luxury white car from the car reference image positioned behind the subject in the scene in the same relative placement, angle, scale, and visual prominence as the car shown in the microphone staging reference image, ensuring the vehicle looks naturally parked behind the subject as part of the environment, including a vintage hanging microphone suspended directly in front of the subject at mouth level staged identically to the reference image, applying true cinematic shallow depth of field so that the subject, microphone, and foreground remain in razor-sharp focus while both the Learning Center building and the car in the background are softly blurred with natural optical bokeh and realistic lens falloff rather than artificial blur, matching the visual style of imagery shot on an ARRI Alexa cinema camera with a high-quality prime lens, using filmic color science, natural highlight roll-off, accurate dynamic range, professional golden-hour outdoor lighting, and cinematic realism, while implementing advanced skin realism by enhancing all facial imperfections with high-accuracy micro-detail including authentic pores, subtle texture variation, fine lines, micro-creases, natural asymmetry, faint scars, freckles, vellus hairs, and true surface irregularities, strengthening realistic material response such as matte versus oily zones, natural specularity, and micro-shadows without introducing smoothing, softening, or plastic artifacts, correcting only elements that appear broken or AI-distorted while fully preserving the subject's identity and keeping the original color grading exactly as it is, enhancing the eyes with high-fidelity micro-detail including crisp iris texture, natural radial patterns, subtle chromatic variation, accurate subsurface light response, refined eyelids, lashes, and tear ducts with true anatomical detail and natural moisture reflections, maintaining realistic skin translucency, authentic beard stubble detail, and natural lip texture, avoiding any beauty filters or artificial perfection, and producing a final result that is ultra-photorealistic with seamless blending between subject, car, and environment, accurate proportions and perspective, true optical depth, professional cinematic quality, 4K resolution, and absolutely no text, logos, or visual artifacts.`;

  const reAnglePrompts: { label: string; prompt: string }[] = [
    { label: "Side Profile", prompt: "super close up, from the side front angle of the man, keep bokeh depth of field" },
    { label: "Wide Shot", prompt: "wide shot from behind the subject, showing full environment, keep cinematic depth of field" },
    { label: "Low Angle", prompt: "low angle looking up at the subject, dramatic perspective, keep bokeh depth of field" },
    { label: "Close-Up Face", prompt: "extreme close-up on the face, eyes looking into camera, shallow depth of field" },
    { label: "Over Shoulder", prompt: "over the shoulder shot from behind, looking at the scene ahead, cinematic bokeh" },
    { label: "Dutch Angle", prompt: "tilted dutch angle, dynamic composition, dramatic cinematic lighting" },
  ];

  const customizeRows = [
    { field: "Outfit", example: "camo Supreme hoodie, olive green pants, and white Adidas sneakers", yours: "Your outfit (e.g. black leather jacket, ripped jeans, and Jordan 4s)" },
    { field: "Location", example: "Learning Center building", yours: "Your spot (e.g. graffiti warehouse, downtown skyline, recording studio)" },
    { field: "Car / Prop", example: "luxury white car", yours: "Your flex (e.g. matte black Hellcat, vintage Cadillac, motorcycle)" },
    { field: "Pose ref", example: "microphone staging reference image", yours: "Keep as-is OR describe your pose (leaning against the car, sitting on steps)" },
    { field: "Gender", example: "the man", yours: "Change to \"the woman\" if needed" },
    { field: "Face detail", example: "beard texture", yours: "Adjust for your features — remove if no beard, add \"braids\" if applicable" },
  ];

  return (
    <div className="page-break" style={{
      background: C.bg, padding: "50px 56px",
      minHeight: "100vh", boxSizing: "border-box",
    }}>
      <SectionHeader num="02" title="Motion Control" />

      <ConceptBox>
        Record a simple performance video anywhere on your phone. Gather 5 reference images. Aurora
        builds a full AI scene — then you shoot it from multiple angles using re-angle prompts.
        Aurora Motion animates each angle with your real performance. Edit together for a
        full music video. One phone recording. Unlimited shots.
      </ConceptBox>

      <NeedBox items={[
        "Image 1 — Your Selfie: clear face shot for Aurora to match your exact features and skin tone",
        "Image 2 — Your Outfit: flat lay or photo of the clothes you want to wear",
        "Image 3 — Your Location: building, street, studio — whatever fits your vibe",
        "Image 4 — Pose Reference: a photo showing the pose, camera angle, and staging you want",
        "Image 5 — Car or Prop: a car, bike, or prop you want in the background",
      ]} />

      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: "0.10em",
        textTransform: "uppercase", color: C.accent, marginBottom: 16,
      }}>
        ⚡ Step-by-Step
      </div>

      <Step num={1} title="Record Your Performance">
        Film yourself performing your song anywhere — your room, a parking lot, outside. Your phone
        camera is perfect. This recording is your motion reference for every angle you'll generate.
      </Step>

      <Step num={2} title="Gather Your 5 Reference Images">
        Collect: a close-up selfie, the outfit you want to wear, your chosen location, a pose/staging
        reference, and a car or prop for the background.
      </Step>

      <Step num={3} title="Open aurora.studio → Studio → Image">
        Navigate to the Studio section. Select the <strong>Image</strong> tab. Choose the{" "}
        <strong style={{ color: C.accent }}>Aurora Identity</strong> model. Upload all <strong>5</strong> reference images.
      </Step>

      <Step num={4} title="Generate Your Base Scene">
        Paste the base scene prompt below — swap the highlighted parts for your own details (see the
        Customize table at the bottom of this section):
        <PromptBlock label="Base Scene Prompt — Customize the highlighted parts, keep all technical terms" prompt={baseScenePrompt} />
        <TipBox variant="warning">
          Don't change the technical photography terms (ARRI Alexa, bokeh, skin realism, etc.) — those
          are what make the output look cinematic. Only swap the parts that describe YOUR specific
          scene: outfit, location, car, and pose.
        </TipBox>
      </Step>

      <Step num={5} title="Generate Different Camera Angles">
        Upload your base scene result as the reference image, then use these short re-angle prompts
        one at a time to create 3–5 additional shots from the same scene:
        {reAnglePrompts.map(({ label, prompt }) => (
          <PromptBlock key={label} label={label} prompt={prompt} />
        ))}
        <TipBox>
          Generate 3–5 different angles. You now have a full multi-shot music video — all from one
          scene and one phone recording.
        </TipBox>
      </Step>

      <Step num={6} title="Animate Each Angle with Motion">
        Go to <strong>aurora.studio → Motion</strong>. For each angle:
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Upload your Aurora-generated image as the Source Image</li>
          <li>Upload your original phone recording as the Control Video</li>
          <li>Choose your resolution and hit Generate</li>
        </ul>
      </Step>

      <Step num={7} title="Repeat for Every Angle">
        Do this for each angle you generated. Every shot uses the same phone recording — Aurora
        adapts the motion to each different angle automatically.
      </Step>

      <Step num={8} title="Edit Together">
        Cut all your animated angles together in CapCut, Premiere, or any editor. Add your song
        audio. You now have a full multi-shot music video created from one phone recording and
        some reference images.
      </Step>

      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px 20px", marginTop: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.accent, marginBottom: 12 }}>
          Customize Your Scene
        </div>
        <CustomizeTable rows={customizeRows} />
      </div>
    </div>
  );
}
