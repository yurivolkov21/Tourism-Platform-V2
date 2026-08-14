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
import { siteMediaImage } from '@/lib/api/site-media';
import { fetchDestinations, fetchTours } from '@/lib/api/tours';
import { topDestinations } from '@/lib/regions';
import { REGIONS } from '@/mocks/regions';

// Home fetch teaser Journal từ API (Task 9) → trang thành ISR, khai tường
// minh thay vì để Next suy ngầm từ revalidate của fetchPosts.
export const revalidate = 300;

// Trang Home tĩnh (static-first, mock data) — convert nguyên bố cục template
// Estate sang chuẩn dự án (review vòng 1, điều chỉnh #2 của user).
export default async function HomePage() {
  // Task 4 (cụm destinations-api): tiles gallery đọc destinations thật, cùng
  // khuôn settle() + truyền props như teaser Journal (Task 9).
  // Fix final review (01/08): thêm fetchTours() để Stats có số tour THẬT thay vì
  // "68+" bịa — cùng key cache (TAGS.TOURS) với fetchDestinations/fetchTours ở
  // các trang khác nên đây là dedup Data Cache, không phải một round-trip mới.
  const [postsRes, destinationsRes, toursRes] = await Promise.all([
    settle(fetchPosts()),
    settle(fetchDestinations()),
    settle(fetchTours()),
  ]);

  // Khe brand-chrome: `null` khi chưa có ảnh — SlotImage tự rơi về placeholder.
  const [heroImage, bandImage] = await Promise.all([
    siteMediaImage('home-hero'),
    siteMediaImage('cta-band'),
  ]);
  return (
    <>
      <Hero heroImage={heroImage} />
      {/* Dải trust ngay dưới hero (vị trí gốc của forged): nền tối nối liền
          hero, ngăn với Stats sáng bên dưới bằng border */}
      <Partners />
      <Stats toursCount={toursRes.ok ? toursRes.data.length : null} />
      {/* Fix sau review (31/07): Home giữ ĐÚNG 9 tile như thiết kế đã duyệt — chọn
          9 điểm tourCount cao nhất từ 19 điểm API trả về, /destinations mới đủ 19 */}
      <Gallery
        destinations={topDestinations(REGIONS, destinationsRes.data ?? [], 9)}
        failed={!destinationsRes.ok}
      />
      <WhyChooseUs />
      <Testimonials />
      {/* Journal trắng chen giữa Testimonials (muted) và CTA (tối) — nhịp nền
          sáng/tối xen kẽ (review #33) */}
      <Journal posts={postsRes.data ?? []} failed={!postsRes.ok} />
      <CallToAction bandImage={bandImage} />
      <Contact />
    </>
  );
}
