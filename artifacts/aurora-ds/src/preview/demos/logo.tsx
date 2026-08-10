import logoUrl from '../../assets/logo.png';

export function LogoPage() {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-4 text-lg font-semibold">Primary mark</h2>
        <div className="flex flex-wrap gap-6">
          {/* On dark */}
          <div className="flex h-32 w-48 items-center justify-center rounded-xl bg-[#07090e] border border-white/10">
            <img src={logoUrl} alt="Aurora logo on dark" className="h-10 object-contain" />
          </div>
          {/* On light */}
          <div className="flex h-32 w-48 items-center justify-center rounded-xl bg-white border border-black/10">
            <img src={logoUrl} alt="Aurora logo on light" className="h-10 object-contain" />
          </div>
          {/* On primary */}
          <div className="flex h-32 w-48 items-center justify-center rounded-xl bg-primary">
            <img src={logoUrl} alt="Aurora logo on primary" className="h-10 object-contain" />
          </div>
        </div>
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold">Sizing</h2>
        <div className="flex flex-wrap items-end gap-6">
          {[24, 32, 40, 56, 72].map(size => (
            <div key={size} className="flex flex-col items-center gap-2">
              <img src={logoUrl} alt={`${size}px`} style={{ height: size }} className="object-contain" />
              <span className="text-xs text-muted-foreground">{size}px</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
