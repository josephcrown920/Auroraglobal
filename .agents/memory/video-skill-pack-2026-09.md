---
name: Aurora video skill routing pack
description: Routing rules derived from the supplied HeyGen and Chengfeng video skills for the Aurora video-agent family.
---

# Video Skill Routing

## HeyGen Avatar
Establish persistent face/voice identity. When a request creates an identity and asks for a presenter video, avatar setup runs first.

## HeyGen Video
Create new presenter-led videos. Not for avatar setup or translation of an existing video.

## HeyGen Translate
Translate/dub an existing source video while preserving presenter identity, voice and lip-sync. Not for creating a new video from scratch.

## Chengfeng 剪口播
Transcribe → detect mistakes/silence/repetition → review → user confirmation → cut → retranscribe the cut → AI-correct subtitles. Final subtitles must be based on the post-cut video.

## Chengfeng 口播成片
Storyboard → timeline preview → configured aspect ratio/animation → final MP4 → ffprobe/keyframe QA.

## Ian Xiaohei SVG Motion
Build semantic SVG + GSAP motion from a cognitive anchor and physical metaphor. Do not auto-vectorize raster images into path soup.

## Chengfeng 自进化
Integrate reusable corrections into the relevant methodology section; feedback logs are event records, not the place to dump new rules.

## Aurora routing policy
Preserve project memory and identity locks across skill boundaries. Chain workflows where required. Keep unrelated skills out of video routing.

Source: user-supplied `skills-master` and `chengfeng-videocut-skills` packs.
