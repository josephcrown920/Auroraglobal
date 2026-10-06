import { cn } from "@/lib/utils";

export function StaggeredHeadline({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={cn("aurora-staggered-headline", className)} aria-label={text}>
      {text.split(/\s+/).map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden="true"
          className="aurora-staggered-word"
          style={{ animationDelay: `${index * 85}ms` }}
        >
          {word}
          {index < text.split(/\s+/).length - 1 ? "\u00a0" : ""}
        </span>
      ))}
    </span>
  );
}