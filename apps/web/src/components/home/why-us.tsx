import { BadgeDollarSignIcon, CompassIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';

const POINTS = [
  {
    icon: CompassIcon,
    title: 'Local guides only',
    body: 'Every route is led by someone who grew up on it — not read about it.',
  },
  {
    icon: UsersIcon,
    title: 'Small groups',
    body: 'Twelve travelers max. Enough for stories, few enough for silence.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Free cancellation',
    body: 'Plans change. Cancel up to 48 hours before departure, no questions.',
  },
  {
    icon: BadgeDollarSignIcon,
    title: 'Fair pricing',
    body: 'What you pay reaches the people who host you. No hidden fees.',
  },
];

export function WhyUs() {
  return (
    <section className="bg-muted">
      <div className="mx-auto w-full max-w-(--container-content) px-6 py-20">
        <Reveal className="mb-10 flex flex-col gap-1">
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-primary">Why tourism</p>
          <h2 className="font-heading text-3xl font-semibold text-balance">
            Built the way we like to travel
          </h2>
        </Reveal>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08} className="flex flex-col gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-card text-primary shadow-(--shadow-card)">
                <p.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-lg font-semibold">{p.title}</h3>
              <p className="text-sm text-muted-foreground">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
