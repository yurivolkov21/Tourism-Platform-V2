import { AnimatedCounter } from '@/components/motion/animated-counter';
import { Reveal } from '@/components/motion/reveal';

const STATS: { to: number; decimals?: number; suffix?: string; label: string }[] = [
  { to: 68, label: 'Hand-picked tours' },
  { to: 12400, suffix: '+', label: 'Happy travelers' },
  { to: 140, suffix: '+', label: 'Local guides' },
  { to: 4.9, decimals: 1, suffix: ' ★', label: 'Average rating' },
];

export function Stats() {
  return (
    <section className="mx-auto w-full max-w-(--container-content) px-6 py-20">
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.08} className="flex flex-col items-start gap-1">
            <AnimatedCounter
              to={s.to}
              decimals={s.decimals}
              suffix={s.suffix}
              className="font-heading text-4xl font-semibold tabular-nums"
            />
            <span className="text-sm text-muted-foreground">{s.label}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
