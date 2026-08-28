import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { Switch } from '../components/ui/switch';
import { tokens } from '../generated/tokens';
import { useTheme } from './theme';

const TYPE_SCALE = [
  { label: 'Display', className: 'text-4xl font-bold tracking-tight' },
  { label: 'Heading', className: 'text-2xl font-semibold' },
  { label: 'Body', className: 'text-base' },
  { label: 'Label', className: 'text-sm font-medium' },
  { label: 'Caption', className: 'text-sm text-muted-foreground' },
] as const;

const SPACING_SCALE = [
  { label: '4', className: 'w-4' },
  { label: '8', className: 'w-8' },
  { label: '12', className: 'w-12' },
  { label: '16', className: 'w-16' },
  { label: '24', className: 'w-24' },
] as const;

function Kicker({ children }: { children: string }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div className="space-y-2">
      <div
        className="h-16 rounded-lg border shadow-sm"
        style={{ background: hex }}
      />
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="font-mono text-xs uppercase text-muted-foreground">
          {hex}
        </p>
      </div>
    </div>
  );
}

/**
 * The hero always renders the dark brand — it is a poster of how Aurora
 * actually ships, regardless of which token set is being audited.
 */
function BrandHero() {
  const dark = tokens.color.dark;
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-primary/25 p-8 text-[#f8f8f8] sm:p-10"
      style={{
        background: `linear-gradient(140deg, ${dark.background} 0%, ${dark.secondary} 55%, #1c1040 100%)`,
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-24 right-[-60px] h-64 w-64 rounded-full opacity-40 blur-[100px]"
          style={{ background: dark.primary }}
        />
        <div
          className="absolute bottom-[-90px] left-[10%] h-56 w-72 rounded-full opacity-25 blur-[110px]"
          style={{ background: '#3b2a8f' }}
        />
      </div>
      <div className="relative z-10 max-w-2xl">
        <p className="font-serif text-lg italic text-[#b07aff]">
          By Artists, for Artists
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Deep navy. Violet light.{' '}
          <span className="bg-gradient-to-r from-[#b07aff] to-[#7c3aed] bg-clip-text text-transparent">
            Glass surfaces.
          </span>
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70">
          Aurora is dark-first: near-black navy backgrounds, one violet accent
          doing all the talking, glass panels floating above ambient glow, and
          Plus Jakarta Sans carrying the words.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="lg">Start creating</Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/20 bg-white/5 text-white backdrop-blur hover:bg-white/10 hover:text-white"
          >
            Browse the gallery
          </Button>
        </div>
        <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
          Free to start · No card needed
        </p>
      </div>
    </section>
  );
}

function PaletteSection() {
  const [theme] = useTheme();
  const palette = tokens.color[theme];
  const roles = [
    { name: 'Primary', hex: palette.primary },
    { name: 'Background', hex: palette.background },
    { name: 'Card', hex: palette.card },
    { name: 'Secondary', hex: palette.secondary },
    { name: 'Accent', hex: palette.accent },
    { name: 'Muted', hex: palette.muted },
    { name: 'Border', hex: palette.border },
    { name: 'Destructive', hex: palette.destructive },
  ];
  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground">
      <div className="flex items-baseline justify-between gap-3">
        <Kicker>Core palette</Kicker>
        <p className="text-xs text-muted-foreground">
          {theme === 'dark' ? 'Dark set — the default' : 'Light set'}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {roles.map((role) => (
          <Swatch key={role.name} name={role.name} hex={role.hex} />
        ))}
      </div>
    </section>
  );
}

function TypographySection() {
  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground">
      <Kicker>Typography</Kicker>
      <div className="mt-4 space-y-5">
        <div>
          <p className="text-3xl font-bold tracking-tight sm:text-4xl">
            Direct Your Visual Identity.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Plus Jakarta Sans · display &amp; UI
          </p>
        </div>
        <div>
          <p className="font-serif text-2xl italic text-primary sm:text-3xl">
            By Artists, for Artists
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cormorant Garamond · editorial accents
          </p>
        </div>
        <div>
          <p className="font-mono text-sm">
            aurora render --scene 04 --preview 720p
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JetBrains Mono · code &amp; telemetry
          </p>
        </div>
        <div className="space-y-2 border-t pt-4">
          <p className="text-base">
            Body — Drop your references, direct the shoot in plain language.
          </p>
          <p className="text-sm font-medium">Label — Workspace name</p>
          <p className="text-sm text-muted-foreground">
            Caption — Renders finish in seconds, not weeks.
          </p>
        </div>
      </div>
    </section>
  );
}

function InUseSection() {
  return (
    <section className="rounded-xl border bg-card p-5 text-card-foreground">
      <Kicker>In use</Kicker>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>New shoot</CardTitle>
          <CardDescription>
            Components composed from the tokens on this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="overview-name">Shoot name</Label>
            <Input id="overview-name" placeholder="Neon rooftop — night" />
          </div>
          <div className="flex items-center gap-2">
            <Switch defaultChecked id="overview-notify" />
            <Label htmlFor="overview-notify">Email me when renders finish</Label>
            <Badge className="ml-auto">New</Badge>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button>Save</Button>
          <Button variant="outline">Cancel</Button>
        </CardFooter>
      </Card>
    </section>
  );
}

/** Demonstrates the glass-morphism surface treatment on ambient navy. */
function GlassSection() {
  const dark = tokens.color.dark;
  return (
    <section
      className="relative overflow-hidden rounded-xl border p-5 sm:p-6"
      style={{
        background: `linear-gradient(120deg, ${dark.background} 10%, ${dark.accent} 90%)`,
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-16 left-1/3 h-48 w-48 rounded-full opacity-30 blur-[90px]"
          style={{ background: dark.primary }}
        />
      </div>
      <div className="relative z-10">
        <h2 className="text-xs font-medium uppercase tracking-wide text-white/50">
          Glass surfaces
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">Floating panel</p>
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              10% white border, 6% white fill, heavy blur — panels float above
              the ambient glow instead of sitting on flat gray.
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm">Render</Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                Preview
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                Scene 04 — night rooftop
              </p>
              <Badge>Rendering</Badge>
            </div>
            <Progress value={82} className="mt-4" />
            <p className="mt-2 font-mono text-xs text-white/50">
              82% · kling-3 · 720p preview
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComponentsSection() {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 text-card-foreground">
      <Kicker>Components</Kicker>
      <div className="flex flex-wrap items-center gap-3">
        <Button>Start creating</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Delete render</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Badge>Badge</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Failed</Badge>
      </div>
    </section>
  );
}

export function OverviewPage() {
  return (
    <div className="space-y-4">
      <BrandHero />
      <PaletteSection />
      <div className="grid gap-4 lg:grid-cols-2">
        <TypographySection />
        <InUseSection />
      </div>
      <GlassSection />
      <ComponentsSection />
    </div>
  );
}

export function ColorsPage() {
  const [theme] = useTheme();
  const palette = tokens.color[theme];
  const groups: Array<{
    title: string;
    blurb: string;
    roles: Array<{ name: string; hex: string }>;
  }> = [
    {
      title: 'Brand',
      blurb:
        'One violet accent carries the whole brand — buttons, focus rings, links, active states.',
      roles: [
        { name: 'Primary', hex: palette.primary },
        { name: 'Ring', hex: palette.ring },
      ],
    },
    {
      title: 'Surfaces',
      blurb: 'Layered navy surfaces, darkest at the page, lighter as content lifts.',
      roles: [
        { name: 'Background', hex: palette.background },
        { name: 'Card', hex: palette.card },
        { name: 'Popover', hex: palette.popover },
        { name: 'Sidebar', hex: palette.sidebar },
      ],
    },
    {
      title: 'Interactive',
      blurb: 'Supporting fills for secondary actions, hovers, and quiet emphasis.',
      roles: [
        { name: 'Secondary', hex: palette.secondary },
        { name: 'Accent', hex: palette.accent },
        { name: 'Muted', hex: palette.muted },
        { name: 'Input', hex: palette.input },
      ],
    },
    {
      title: 'Text & lines',
      blurb: 'Foreground text, quiet text, and hairline borders.',
      roles: [
        { name: 'Foreground', hex: palette.foreground },
        { name: 'Muted foreground', hex: palette.mutedForeground },
        { name: 'Border', hex: palette.border },
      ],
    },
    {
      title: 'Semantic',
      blurb:
        'Reserved status colors — never swept into the brand. Red means danger, not identity.',
      roles: [{ name: 'Destructive', hex: palette.destructive }],
    },
    {
      title: 'Charts',
      blurb: 'Categorical data colors, tuned for the active surface.',
      roles: [
        { name: 'Chart 1', hex: palette.chart1 },
        { name: 'Chart 2', hex: palette.chart2 },
        { name: 'Chart 3', hex: palette.chart3 },
        { name: 'Chart 4', hex: palette.chart4 },
        { name: 'Chart 5', hex: palette.chart5 },
      ],
    },
  ];

  return (
    <div className="space-y-8 rounded-xl border bg-card p-6 text-card-foreground">
      <p className="text-xs text-muted-foreground">
        Showing the {theme} token set — flip the theme from the sidebar to audit
        the other.
      </p>
      {groups.map((group) => (
        <section key={group.title} className="space-y-4">
          <div>
            <h2 className="font-semibold">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.blurb}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {group.roles.map((role) => (
              <Swatch key={role.name} name={role.name} hex={role.hex} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function FontsPage() {
  return (
    <div className="space-y-8 rounded-xl border bg-card p-6 text-card-foreground">
      <section className="space-y-6">
        <div>
          <p className="text-4xl font-bold tracking-tight">
            Direct Your Visual Identity.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Plus Jakarta Sans — the primary UI and display typeface. Bold and
            tight for headlines, regular for everything readable.
          </p>
        </div>
        <div className="border-t pt-6">
          <p className="font-serif text-4xl italic text-primary">
            By Artists, for Artists
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cormorant Garamond — italic editorial accents only: kickers,
            pull-quotes, one line at a time. Never body text.
          </p>
        </div>
        <div className="border-t pt-6">
          <p className="font-mono text-base">
            aurora render --scene 04 --preview 720p
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            JetBrains Mono — code, hex values, render telemetry.
          </p>
        </div>
      </section>

      <section className="space-y-4 border-t pt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Type scale
        </h2>
        {TYPE_SCALE.map((entry) => (
          <div key={entry.label} className="grid gap-2 sm:grid-cols-[88px_1fr]">
            <span className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {entry.label}
            </span>
            <p className={entry.className}>Build products people understand.</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export function LayoutPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">Spacing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The spacing scale, derived from the base spacing token.
        </p>
        <div className="mt-6 space-y-4">
          {SPACING_SCALE.map((space) => (
            <div key={space.label} className="flex items-center gap-4">
              <span className="w-8 text-xs text-muted-foreground">
                {space.label}
              </span>
              <div className={`h-3 rounded-full bg-primary ${space.className}`} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6 text-card-foreground">
        <h2 className="font-semibold">Radius</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Corner treatments derive from the base radius token.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {[
            { label: 'Small', className: 'rounded-sm' },
            { label: 'Medium', className: 'rounded-md' },
            { label: 'Large', className: 'rounded-lg' },
            { label: 'Extra large', className: 'rounded-xl' },
          ].map((radius) => (
            <div
              key={radius.label}
              className={`flex h-24 items-end border bg-muted p-3 ${radius.className}`}
            >
              <span className="text-xs font-medium">{radius.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
