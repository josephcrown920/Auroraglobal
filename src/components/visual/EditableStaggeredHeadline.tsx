import { EditableCopy } from "@/components/EditableCopy";
import { useSiteCopyValue } from "@/components/landing/SiteCopyProvider";
import { StaggeredHeadline } from "@/components/visual/StaggeredHeadline";
import { cn } from "@/lib/utils";

export function EditableStaggeredHeadline({
  copyKey,
  fallback,
  className,
}: {
  copyKey: string;
  fallback: string;
  className?: string;
}) {
  const value = useSiteCopyValue(copyKey) ?? fallback;

  return (
    <span className="group relative inline-flex items-baseline gap-1">
      <StaggeredHeadline text={value} className={className} />
      <EditableCopy
        editorOnly
        copyKey={copyKey}
        fallback={fallback}
        previewClassName="text-xl font-semibold leading-tight"
      />
    </span>
  );
}