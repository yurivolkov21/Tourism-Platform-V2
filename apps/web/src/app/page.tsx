import { CtaBand } from '@/components/home/cta-band';
import { FeaturedTours } from '@/components/home/featured-tours';
import { Hero } from '@/components/home/hero';
import { JournalPreview } from '@/components/home/journal-preview';
import { RegionsStrip } from '@/components/home/regions-strip';
import { Stats } from '@/components/home/stats';
import { Testimonials } from '@/components/home/testimonials';
import { WhyUs } from '@/components/home/why-us';
import { MotionProvider } from '@/components/motion/reveal';

// Trang Home tĩnh (static-first) — dữ liệu mock, thứ tự section theo spec
// docs/specs/2026-07-23-home-page-design.md.
export default function HomePage() {
  return (
    <MotionProvider>
      <Hero />
      <FeaturedTours />
      <RegionsStrip />
      <WhyUs />
      <Stats />
      <Testimonials />
      <JournalPreview />
      <CtaBand />
    </MotionProvider>
  );
}
