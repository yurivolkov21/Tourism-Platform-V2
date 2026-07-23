import type { Metadata } from 'next';
import { AboutHero } from '@/components/about/about-hero';
import { AboutStory } from '@/components/about/about-story';
import { AboutTimeline } from '@/components/about/about-timeline';

// Trang About Us (static-first) — dựng TỪNG SECTION theo review của user
// (quy trình: demo section → review → chốt → section kế). Lineup đã chốt
// 7 khối: Hero · Story · Timeline · Numbers · Team · Partners · CTA.
// Hiện có: §1 Hero (forged/Hero) · §2 Story (forged/About) · §3 Timeline
// (prompt2app/build-process — trục tự vẽ theo scroll).
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
    </>
  );
}
