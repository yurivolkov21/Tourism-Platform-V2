import { Card, CardDescription, CardHeader, CardTitle } from '@tourism/ui/components/card';
import { ArrowRightIcon } from 'lucide-react';
import Image from 'next/image';
import { Reveal } from '@/components/motion/reveal';
import { JOURNAL_POSTS } from '@/mocks/journal';

// Định dạng "Oct 2, 2026" — build-time nên ổn định, không lệch múi giờ client.
const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function JournalPreview() {
  return (
    <section id="journal" className="mx-auto w-full max-w-(--container-content) px-6 py-20">
      <Reveal className="mb-8 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-primary">
            From the journal
          </p>
          <h2 className="font-heading text-3xl font-semibold text-balance">Notes from the road</h2>
        </div>
        <a
          href="#journal"
          className="ml-auto flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Read the journal
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </a>
      </Reveal>
      <div className="grid gap-6 md:grid-cols-3">
        {JOURNAL_POSTS.map((post, i) => (
          <Reveal key={post.slug} delay={i * 0.1}>
            <Card className="group h-full pt-0">
              <Image
                src={post.image}
                alt=""
                width={800}
                height={450}
                sizes="(max-width: 768px) 100vw, 33vw"
                className="aspect-(--aspect-hero) w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <CardHeader>
                <CardDescription>
                  {dateFmt.format(new Date(post.date))} · {post.readMinutes} min read
                </CardDescription>
                <CardTitle className="text-lg">{post.title}</CardTitle>
                <CardDescription>{post.excerpt}</CardDescription>
              </CardHeader>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
