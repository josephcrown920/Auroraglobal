import { ArrowRight, Loader2, Mail, Sparkles, Zap } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Row } from '../parts';

export function ButtonDemo() {
  return (
    <div className="space-y-6 rounded-xl border bg-card p-6 text-card-foreground">
      <Row label="Core variants">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Destructive</Button>
      </Row>
      <Row label="Aurora variants">
        <Button variant="premium">
          <Sparkles className="size-4" /> Premium
        </Button>
        <Button variant="glass">
          <Zap className="size-4" /> Glass
        </Button>
      </Row>
      <Row label="Sizes">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="xl">X-Large</Button>
        <Button size="pill">Pill</Button>
        <Button size="icon" aria-label="Mail"><Mail /></Button>
      </Row>
      <Row label="With icon">
        <Button><Mail /> Email</Button>
        <Button variant="secondary">Continue <ArrowRight /></Button>
        <Button variant="premium"><Sparkles /> Generate</Button>
      </Row>
      <Row label="States">
        <Button disabled>Disabled</Button>
        <Button disabled><Loader2 className="animate-spin" /> Loading</Button>
        <Button variant="premium" disabled>Premium disabled</Button>
      </Row>
    </div>
  );
}
