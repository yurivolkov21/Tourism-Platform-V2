import type { Metadata } from 'next';
import { AboutCtaVideo } from '@/components/about/about-cta-video';
import { AboutHero } from '@/components/about/about-hero';
import { AboutNumbers } from '@/components/about/about-numbers';
import { AboutStory } from '@/components/about/about-story';
import { AboutTeam } from '@/components/about/about-team';
import { AboutTimeline } from '@/components/about/about-timeline';
import { AboutValues } from '@/components/about/about-values';

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

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <AboutStory />
      <AboutTimeline />
      <AboutNumbers />
      {/* Values "The promises we keep" — lấp tầng giá trị (phân tích: các lời
          hứa mới chỉ teaser ở pill/0-Scripts/marquee, chưa được giải thích) */}
      <AboutValues />
      <AboutTeam />
      {/* §6 Partners BỎ khỏi About (review: dải tối chen giữa Team trắng và
          CTA trắng làm CTA bị cô lập — trust đã có ở Home + khối Numbers);
          §7 CTA riêng — ShadcnSpace CTA 01 (ứng viên còn lại: CTA 02 video) */}
      {/* Đang so CTA 02 (video + marquee) với CTA 01 (aurora — about-cta.tsx) */}
      <AboutCtaVideo />
    </>
  );
}
