import { ConceptBox, NeedBox, PromptBlock, SectionHeader, Step, TipBox } from "./shared";
import { C } from "./tokens";

// ─── Section 1: Colors Performance ───────────────────────────────────────────

export function TutorialColors() {
  const wideAnglePrompt = `Place the subject (man in yellow jacket) into a minimalist studio performance scene. Full-body side profile pose, arms slightly extended forward as if performing. Use the exact suspended vintage studio microphone from the reference — identical shape, size, material, cable — hanging from ceiling at chest level. Keep microphone photorealistic to reference. Environment is a seamless hot pink cyclorama studio — background and floor are one continuous hot pink color, no visible edges or corners. Soft even glossy lighting with smooth gradient. Subject stands on a circular performance platform matching the hot pink tone, slightly elevated with subtle shadow and faint reflective sheen. Preserve exact facial likeness, beard, skin tone, hairstyle, body proportions. Outfit identical: yellow jacket, black shorts, white socks, black shoes, all accessories. Cinematic studio lighting, gentle floor shadow, rim light separation, ultra-realistic skin texture, natural pores, sharp clothing detail, high-end music video aesthetic, 4K photoreal quality.`;

  const closeUpPrompt = `Place the subject (man in yellow jacket) into a studio performance scene. Medium close-up from chest up. Subject turned slightly to side but mostly facing camera — approximately 30-45° angled pose, majority of face visible (both eyes, nose bridge mostly facing camera, slight cheek contour). Use the exact suspended vintage studio microphone from reference — identical design, metallic finish, hanging cable — positioned in front at mouth level with same spacing as reference. Environment is a seamless continuous super hot pink cyclorama background filling entire frame top to bottom, no visible floor line, corners, or edges. Preserve exact facial likeness, beard, hairstyle, skin tone, proportions from yellow jacket reference. Outfit identical: yellow jacket, black shorts, accessories unchanged. Pose natural and expressive as if mid-performance, hands slightly raised or gesturing. Soft even studio lighting, gentle shadows, subtle rim light separation, ultra-realistic skin texture with natural pores, sharp clothing detail, shallow depth of field but subject fully crisp, high-end music video aesthetic, 4K photoreal quality.`;

  return (
    <div className="page-break" style={{
      background: C.bg, padding: "50px 56px",
      minHeight: "100vh", boxSizing: "border-box",
    }}>
      <SectionHeader num="01" title="Colors Performance" />

      <ConceptBox>
        A multi-angle performance video inspired by the iconic Colors Show format — bold single-color
        background, hanging vintage microphone, cinematic lighting — all generated with Aurora and
        brought to life with your own cell phone performance footage. One phone. One idea. Full video.
      </ConceptBox>

      <NeedBox items={[
        "A photo of yourself to use as the subject reference",
        "2 reference screenshots from any Colors-style performance (one wide/full-body, one medium close-up)",
        "A cell phone to record your performance",
        "Your song/audio ready to perform to",
        "An aurora.studio account",
      ]} />

      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: "0.10em",
        textTransform: "uppercase", color: C.accent, marginBottom: 16,
      }}>
        ⚡ Step-by-Step
      </div>

      <Step num={1} title="Find Your Reference Images">
        Screenshot or save two angles from any Colors-style performance — one wide/full-body shot and
        one medium close-up. These set the composition reference for your Aurora-generated images.
      </Step>

      <Step num={2} title="Open aurora.studio → Colors Studio → Color Photoshoot">
        Navigate to <strong>Colors Studio</strong> and choose{" "}
        <strong style={{ color: C.accent }}>Color Photoshoot</strong> — powered by the Aurora
        Identity model. Set aspect ratio to <strong>9:16</strong>.
      </Step>

      <Step num={3} title="Upload Reference Images">
        Upload two images: your Colors reference screenshot <strong>+</strong> a photo of yourself.
        Aurora uses both to place you into the scene with your exact likeness.
      </Step>

      <Step num={4} title="Generate — Wide Angle (Full Body)">
        Paste the prompt below and hit Generate:
        <PromptBlock label="Wide Angle Prompt" prompt={wideAnglePrompt} />
        <TipBox>
          Customize by changing "hot pink" to any color you want — red, blue, green, orange. Update the
          outfit description to match what you're actually wearing. The scene, lighting, and microphone
          logic stay the same.
        </TipBox>
      </Step>

      <Step num={5} title="Generate — Close-Up Angle">
        Same process, new angle. Upload the close-up reference + your photo, then use this prompt:
        <PromptBlock label="Close-Up Prompt" prompt={closeUpPrompt} />
      </Step>

      <Step num={6} title="Record Your Performance">
        Using your cell phone, record yourself performing your song from the exact two angles matching
        the images you generated. Match the pose and framing as closely as possible.
        <TipBox>
          You don't need a studio or fancy setup. Make sure your body angle and framing match the
          generated images — Aurora handles the rest. Perform with energy; the motion transfer picks
          up on every movement.
        </TipBox>
      </Step>

      <Step num={7} title="Animate with Motion">
        Go to <strong>aurora.studio → Motion</strong>. For each angle:
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Upload the Aurora-generated image as the source</li>
          <li>Upload your cell phone performance video as the motion reference</li>
          <li>Add a short prompt to guide the motion (e.g., <em>"man performing and singing expressively"</em>)</li>
          <li>Hit Generate and let Aurora bring the image to life</li>
        </ul>
      </Step>

      <Step num={8} title="Edit & Export">
        Once both angles are generated, combine them in any video editor (CapCut, Premiere, or the
        Aurora editor). Cut between the wide and close-up angles to match the energy of your
        performance. Add your song audio — done.
        <TipBox variant="secret">
          The magic is in matching your cell phone performance angles to the Aurora-generated images.
          The closer the match, the better the motion transfer. Take a few attempts if needed — it's
          worth it.
        </TipBox>
      </Step>

      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px 20px", marginTop: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.accent, marginBottom: 10 }}>
          ⚡ Customize It
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.75, color: C.text }}>
          This guide uses a hot pink Colors theme, but you can make it any vibe:
        </div>
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, lineHeight: 1.9, fontSize: 13.5, color: C.text }}>
          <li><strong>Change the color:</strong> Replace "hot pink" with any color in the prompts</li>
          <li><strong>Change the outfit:</strong> Update the outfit description to match what you're wearing</li>
          <li><strong>Change the set:</strong> Swap "cyclorama studio" for outdoor scenes, concert stages, etc.</li>
          <li><strong>Add props:</strong> Add guitar, piano, DJ setup — describe them in the prompt</li>
        </ul>
      </div>
    </div>
  );
}
