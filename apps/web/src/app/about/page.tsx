import type { Metadata } from 'next';
import { AboutCta } from '@/components/about/about-cta';
import { AboutHero } from '@/components/about/about-hero';
import { AboutNumbers } from '@/components/about/about-numbers';
import { AboutStory } from '@/components/about/about-story';
import { AboutTeam } from '@/components/about/about-team';
import { AboutTimeline } from '@/components/about/about-timeline';
import { Partners } from '@/components/home/partners';

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
      <AboutTeam />
      {/* §6 tái dùng Partners của Home (Logo Cloud 01 same-mechanism, không thay);
          §7 CTA riêng của About — ShadcnSpace CTA 01 (đang demo, ứng viên còn
          lại: CTA 02 video) */}
      <Partners />
      <AboutCta />
    </>
  );
}
