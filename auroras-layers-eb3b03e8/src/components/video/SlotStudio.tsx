import { useRef, useState, type ReactNode } from "react";

export type SlotDef = {
  key: string;
  label: string;
  icon: ReactNode;
  kind: "image" | "text";
  placeholder?: string;
};

type Values = Record<string, string>;

/**
 * Krea-style tool panel: model selector row, big titled tool, then large
 * side-by-side input slots and a Generate action — rendered in Aurora's
 * purple/magenta brand system instead of neutral grey.
 */
export function SlotStudio({
  id,
  tool,
  icon,
  models,
  slots,
  hint,
  onGenerate,
}: {
  id: string;
  tool: string;
  icon: ReactNode;
  models: readonly { id: string; label: string; available: boolean }[];
  slots: SlotDef[];
  hint: string;
  onGenerate: (values: Values, model: string) => void;
}) {
  const first = models.find((m) => m.available) ?? models[0]!;
  const [model, setModel] = useState(first.id);
  const [values, setValues] = useState<Values>({});
  const [previews, setPreviews] = useState<Values>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const ready = slots.every((s) => (values[s.key] ?? "").trim().length > 0);

  function pick(slot: SlotDef, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setValues((v) => ({ ...v, [slot.key]: url }));
      setPreviews((p) => ({ ...p, [slot.key]: url }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div id={id} className="relative overflow-hidden rounded-3xl border border-border bg-card/60 p-5 sm:p-8">
      <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-[image:var(--gradient-aurora)] opacity-20 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <span className="font-[family-name:var(--font-mono-ui)] text-[0.7rem] tracking-[0.25em] text-muted-foreground uppercase">
          Model
        </span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-sm font-bold outline-none focus:border-primary"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id} disabled={!m.available}>
              {m.label}
              {m.available ? "" : " · connector required"}
            </option>
          ))}
        </select>
      </div>

      <div className="relative mt-10 flex items-center justify-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[image:var(--gradient-aurora)] text-2xl">
          {icon}
        </span>
        <h3 className="headline text-[clamp(2rem,6vw,3.4rem)]">{tool}</h3>
      </div>

      <div className="relative mt-10 grid gap-4 rounded-3xl border border-border bg-background/40 p-4 lg:grid-cols-[1fr_auto_1.4fr_auto] lg:items-stretch">
        {slots.map((slot, i) => (
          <div key={slot.key} className="contents">
            {i > 0 ? (
              <span className="hidden items-center justify-center text-xl text-muted-foreground lg:flex">+</span>
            ) : null}
            <div className="min-h-44 rounded-2xl border border-border bg-secondary/40 p-4 transition-colors hover:border-primary">
              {slot.kind === "image" ? (
                <button
                  type="button"
                  onClick={() => fileRefs.current[slot.key]?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-3"
                >
                  {previews[slot.key] ? (
                    <img
                      src={previews[slot.key]}
                      alt={slot.label}
                      className="h-32 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <>
                      <span className="text-3xl">{slot.icon}</span>
                      <span className="text-lg font-bold">{slot.label}</span>
                    </>
                  )}
                  <input
                    ref={(el) => {
                      fileRefs.current[slot.key] = el;
                    }}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) pick(slot, f);
                    }}
                  />
                </button>
              ) : (
                <label className="flex h-full w-full flex-col gap-3">
                  <span className="flex items-center gap-2 text-lg font-bold">
                    <span className="text-2xl">{slot.icon}</span>
                    {slot.label}
                  </span>
                  <textarea
                    value={values[slot.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [slot.key]: e.target.value }))}
                    placeholder={slot.placeholder}
                    className="min-h-24 flex-1 resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </label>
              )}
            </div>
          </div>
        ))}

        <div className="flex flex-col justify-center gap-2 lg:pl-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => onGenerate(values, model)}
            className="btn-aurora rounded-full px-6 py-3 text-[0.7rem] font-bold tracking-widest uppercase disabled:opacity-40"
          >
            ✦ Generate
          </button>
        </div>
      </div>

      <p className="relative mt-4 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
