import type { Metadata } from 'next';
import { AboutCtaVideo } from '@/components/about/about-cta-video';
import { AboutGallery } from '@/components/about/about-gallery';
import { AboutHero } from '@/components/about/about-hero';
import { AboutNumbers } from '@/components/about/about-numbers';
import { AboutStory } from '@/components/about/about-story';
import { AboutTeam } from '@/components/about/about-team';
import { AboutTimeline } from '@/components/about/about-timeline';
import { AboutValues } from '@/components/about/about-values';
import { settle } from '@/lib/api/resilience';
import { siteMediaImage } from '@/lib/api/site-media';
import { fetchDestinations, fetchTours } from '@/lib/api/tours';

// Trang About Us (static-first) — dựng TỪNG SECTION theo review của user
// (quy trình: demo section → review → chốt → section kế). Lineup đã chốt
// 7 khối: Hero · Story · Timeline · Numbers · Team · Partners · CTA.
// Hiện có: §1 Hero (forged/Hero) · §2 Story (forged/About) · §3 Timeline
// (prompt2app/build-process — trục tự vẽ theo scroll) · §4 Numbers
// (forged/Stats — lưới hairline + watermark) · §5 Team (ShadcnSpace Team 01,
// chỉ founder) · §6 Partners + §7 CTA (tái dùng Home). ĐỦ 7 khối.
export const metadata: Metadata = {
  title: 'About us — Tourism',
  description: 'Small-group tours across Vietnam, led by people who grew up there.',
};

// SSG→ISR có chủ đích (bước 4 nối API, Task 5 cụm destinations-api): Numbers
// (tổng tour) + Gallery (tour/vùng) giờ đọc tours/destinations THẬT thay vì
// TOURS/DESTINATIONS mock — khai revalidate tường minh, đúng khuôn Home
// (Task 4/9) thay vì để Next suy ngầm.
export const revalidate = 300;

export default async function AboutPage() {
  // settle() không throw (ADR-0016 §4) nên build/ISR không sập khi API hắt
  // hơi — page vẫn render, hai section phụ thuộc tự rẽ nhánh lỗi riêng.
  const [toursRes, destinationsRes] = await Promise.all([
    settle(fetchTours()),
    settle(fetchDestinations()),
  ]);

  // Khe brand-chrome: `null` khi chưa có ảnh — SlotImage tự rơi về placeholder.
  const storyImage = await siteMediaImage('about-story');

  return (
    <>
      <AboutHero />
      <AboutStory storyImage={storyImage} />
      <AboutTimeline />
      <AboutNumbers
        tours={toursRes.data ?? []}
        destinations={destinationsRes.data ?? []}
        failed={!toursRes.ok || !destinationsRes.ok}
      />
      {/* Values "The promises we keep" — lấp tầng giá trị (phân tích: các lời
          hứa mới chỉ teaser ở pill/0-Scripts/marquee, chưa được giải thích) */}
      <AboutValues />
      {/* Gallery bento 3 vùng + 1 tổng (ShadcnSpace Gallery 01) — quãng nghỉ
          thị giác giữa hai khối chữ, số đếm derive từ REGIONS (trình bày,
          mock — xem lib/regions.ts) + tours/destinations THẬT truyền props */}
      <AboutGallery
        tours={toursRes.data ?? []}
        destinations={destinationsRes.data ?? []}
        failed={!toursRes.ok || !destinationsRes.ok}
      />
      <AboutTeam />
      {/* §6 Partners BỎ khỏi About (review: dải tối chen giữa Team trắng và
          CTA trắng làm CTA bị cô lập — trust đã có ở Home + khối Numbers);
          §7 CTA riêng — ShadcnSpace CTA 01 (ứng viên còn lại: CTA 02 video) */}
      {/* Đang so CTA 02 (video + marquee) với CTA 01 (aurora — about-cta.tsx) */}
      <AboutCtaVideo />
    </>
  );
}
