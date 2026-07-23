import { Button } from '@tourism/ui/components/button';
import { Input } from '@tourism/ui/components/input';
import { Reveal } from '@/components/motion/reveal';

// Khoảnh khắc jade thứ hai của trang — form no-op giai đoạn static-first.
export function CtaBand() {
  return (
    <section className="cta-band text-on-media">
      <div className="mx-auto flex w-full max-w-(--container-content) flex-wrap items-center gap-8 px-6 py-16">
        <Reveal className="flex max-w-xl flex-col gap-2">
          <p className="text-xs font-bold tracking-[0.16em] uppercase opacity-85">
            Plan with a local
          </p>
          <h2 className="font-heading text-3xl font-semibold text-balance">
            Tell us your dates. We’ll draw the route.
          </h2>
          <p className="text-sm opacity-85">
            One email with three itineraries from guides in the region — no spam, no obligation.
          </p>
        </Reveal>
        <Reveal delay={0.1} className="ml-auto">
          <form className="flex flex-wrap gap-2" action="#">
            <Input
              type="email"
              placeholder="you@example.com"
              aria-label="Email"
              className="min-w-64 bg-card text-card-foreground"
            />
            <Button type="button" variant="secondary">
              Send my routes
            </Button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
