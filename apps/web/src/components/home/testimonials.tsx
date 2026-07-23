import { Avatar, AvatarFallback } from '@tourism/ui/components/avatar';
import { Card, CardContent, CardFooter } from '@tourism/ui/components/card';
import { StarIcon } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { TESTIMONIALS } from '@/mocks/testimonials';

export function Testimonials() {
  return (
    <section className="bg-muted">
      <div className="mx-auto w-full max-w-(--container-content) px-6 py-20">
        <Reveal className="mb-8 flex flex-col gap-1">
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-primary">
            What travelers say
          </p>
          <h2 className="font-heading text-3xl font-semibold text-balance">
            Stories from the road
          </h2>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-3">
                  <span
                    role="img"
                    className="flex items-center gap-0.5"
                    aria-label={`${t.rating} out of 5 stars`}
                  >
                    {Array.from({ length: 5 }, (_, star) => (
                      <StarIcon
                        // biome-ignore lint/suspicious/noArrayIndexKey: dãy sao tĩnh 5 phần tử, không reorder
                        key={star}
                        aria-hidden="true"
                        className={
                          star < Math.round(t.rating)
                            ? 'size-4! fill-rating text-rating'
                            : 'size-4! text-rating-muted'
                        }
                      />
                    ))}
                  </span>
                  <blockquote className="font-heading text-base italic">“{t.quote}”</blockquote>
                </CardContent>
                <CardFooter className="items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{t.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.tour}</span>
                  </span>
                </CardFooter>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
