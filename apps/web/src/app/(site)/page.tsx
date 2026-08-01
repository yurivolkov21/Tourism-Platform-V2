import { CallToAction } from '@/components/home/call-to-action';
import { Contact } from '@/components/home/contact';
import { Gallery } from '@/components/home/gallery';
import { Hero } from '@/components/home/hero';
import { Journal } from '@/components/home/journal';
import { Partners } from '@/components/home/partners';
import { Stats } from '@/components/home/stats';
import { Testimonials } from '@/components/home/testimonials';
import { WhyChooseUs } from '@/components/home/why-choose-us';
import { fetchPosts } from '@/lib/api/posts';
import { settle } from '@/lib/api/resilience';
import { fetchDestinations } from '@/lib/api/tours';

// Home fetch teaser Journal từ API (Task 9) → trang thành ISR, khai tường
// minh thay vì để Next suy ngầm từ revalidate của fetchPosts.
export const revalidate = 300;

// Trang Home tĩnh (static-first, mock data) — convert nguyên bố cục template
// Estate sang chuẩn dự án (review vòng 1, điều chỉnh #2 của user).
export default async function HomePage() {
  // Task 4 (cụm destinations-api): tiles gallery đọc destinations thật, cùng
  // khuôn settle() + truyền props như teaser Journal (Task 9).
  const [postsRes, destinationsRes] = await Promise.all([
    settle(fetchPosts()),
    settle(fetchDestinations()),
  ]);
  return (
    <>
      <Hero />
      {/* Dải trust ngay dưới hero (vị trí gốc của forged): nền tối nối liền
          hero, ngăn với Stats sáng bên dưới bằng border */}
      <Partners />
      <Stats />
      <Gallery destinations={destinationsRes.data ?? []} failed={!destinationsRes.ok} />
      <WhyChooseUs />
      <Testimonials />
      {/* Journal trắng chen giữa Testimonials (muted) và CTA (tối) — nhịp nền
          sáng/tối xen kẽ (review #33) */}
      <Journal posts={postsRes.data ?? []} failed={!postsRes.ok} />
      <CallToAction />
      <Contact />
    </>
  );
}
