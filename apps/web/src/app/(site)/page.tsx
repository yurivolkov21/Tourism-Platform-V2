import { CallToAction } from '@/components/home/call-to-action';
import { Contact } from '@/components/home/contact';
import { Gallery } from '@/components/home/gallery';
import { Hero } from '@/components/home/hero';
import { Journal } from '@/components/home/journal';
import { Partners } from '@/components/home/partners';
import { Stats } from '@/components/home/stats';
import { Testimonials } from '@/components/home/testimonials';
import { WhyChooseUs } from '@/components/home/why-choose-us';

// Trang Home tĩnh (static-first, mock data) — convert nguyên bố cục template
// Estate sang chuẩn dự án (review vòng 1, điều chỉnh #2 của user).
export default function HomePage() {
  return (
    <>
      <Hero />
      {/* Dải trust ngay dưới hero (vị trí gốc của forged): nền tối nối liền
          hero, ngăn với Stats sáng bên dưới bằng border */}
      <Partners />
      <Stats />
      <Gallery />
      <WhyChooseUs />
      <Testimonials />
      {/* Journal trắng chen giữa Testimonials (muted) và CTA (tối) — nhịp nền
          sáng/tối xen kẽ (review #33) */}
      <Journal />
      <CallToAction />
      <Contact />
    </>
  );
}
