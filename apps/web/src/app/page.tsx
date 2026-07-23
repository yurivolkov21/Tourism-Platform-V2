import { CallToAction } from '@/components/home/call-to-action';
import { Contact } from '@/components/home/contact';
import { Gallery } from '@/components/home/gallery';
import { Hero } from '@/components/home/hero';
import { Stats } from '@/components/home/stats';
import { Testimonials } from '@/components/home/testimonials';
import { WhyChooseUs } from '@/components/home/why-choose-us';

// Trang Home tĩnh (static-first, mock data) — convert nguyên bố cục template
// Estate sang chuẩn dự án (review vòng 1, điều chỉnh #2 của user).
export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Gallery />
      <WhyChooseUs />
      <Testimonials />
      <CallToAction />
      <Contact />
    </>
  );
}
