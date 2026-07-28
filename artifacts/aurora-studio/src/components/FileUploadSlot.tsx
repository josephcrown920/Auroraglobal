import { useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Upload, X, CheckCircle, Loader2, AlertCircle } from "lucide-react";

interface FileUploadSlotProps {
  /** Label shown above the slot */
  label: string;
  /** Accepted MIME types, e.g. "video/*" or "audio/*,video/*" */
  accept: string;
  /** Icon shown in the empty state */
  icon: React.ReactNode;
  /** Accent colour class for the icon and border highlight */
  accentClass?: string;
  /** Called when the upload succeeds with the serving URL */
  onUploaded: (objectPath: string) => void;
  /** Called when the slot is cleared */
  onCleared: () => void;
  /** Optional hint shown below the drop zone */
  hint?: string;
  /** Max file size in bytes (client-side check, default 500 MB) */
  maxBytes?: number;
}

const MAX_DEFAULT = 500 * 1024 * 1024;

export default function FileUploadSlot({
  label,
  accept,
  icon,
  accentClass = "text-[#007AFF]",
  onUploaded,
  onCleared,
  hint,
  maxBytes = MAX_DEFAULT,
}: FileUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const { uploadFile, isUploading, progress, error: uploadError } = useUpload({
    onSuccess: (response) => {
      onUploaded(response.objectPath);
    },
  });

  const handleFile = async (file: File) => {
    setClientError(null);

    if (file.size > maxBytes) {
      setClientError(
        `File is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`
      );
      return;
    }

    const accepted = accept
      .split(",")
      .map((a) => a.trim())
      .some((pattern) => {
        if (pattern.endsWith("/*")) {
          return file.type.startsWith(pattern.slice(0, -1));
        }
        return file.type === pattern;
      });

    if (!accepted) {
      setClientError(`File type "${file.type}" is not accepted here.`);
      return;
    }

    setFileName(file.name);
    await uploadFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const clear = () => {
    setFileName(null);
    setClientError(null);
    onCleared();
  };

  const error = clientError || uploadError?.message;
  const isDone = !isUploading && fileName && !error;

  return (
    <div className="space-y-2">
      <label className={`text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2`}>
        <span className={accentClass}>{icon}</span>
        {label}
      </label>

      {isDone ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#1A1A1A] border border-[#2a2a2a] rounded-xl">
          <CheckCircle size={16} className="text-[#34C759] shrink-0" />
          <span className="text-sm text-[#cccccc] truncate flex-1">{fileName}</span>
          <button
            onClick={clear}
            className="text-[#666666] hover:text-white transition-colors"
            title="Remove file"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div
          className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer
            ${error ? "border-[#FF3B30]/50 bg-[#FF3B30]/5" : "border-[#333333] bg-[#0d0d0d] hover:border-[#555555] hover:bg-[#111111]"}`}
          onClick={() => !isUploading && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="flex flex-col items-center justify-center gap-2 py-5 px-4">
            {isUploading ? (
              <>
                <Loader2 size={20} className="animate-spin text-[#666666]" />
                <span className="text-xs text-[#666666]">
                  Uploading{progress > 0 ? ` ${progress}%` : "…"}
                </span>
              </>
            ) : error ? (
              <>
                <AlertCircle size={20} className="text-[#FF3B30]" />
                <span className="text-xs text-[#FF3B30] text-center leading-snug">{error}</span>
                <span className="text-[10px] text-[#666666]">Click to try again</span>
              </>
            ) : (
              <>
                <Upload size={18} className="text-[#555555]" />
                <span className="text-xs text-[#666666]">
                  Click or drag &amp; drop to upload
                </span>
                {hint && (
                  <span className="text-[10px] text-[#444444]">{hint}</span>
                )}
              </>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="sr-only"
            onChange={handleInputChange}
            disabled={isUploading}
          />
        </div>
      )}
    </div>
  );
}
