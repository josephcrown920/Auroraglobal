// Preview clips removed pending better user-supplied footage.
// Component intentionally renders nothing for now — keeps the Motion
// control surface "plain" until the user provides a new reference video.
export function BringItToLifePreview(_props: {
  active?: string;
  onPick: (cameraValue: string) => void;
}) {
  return null;
}
