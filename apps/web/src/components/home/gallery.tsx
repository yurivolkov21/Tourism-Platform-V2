'use client';

import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { TiltCard } from '@/components/motion/tilt-card';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import type { MockRegionKey } from '@/mocks/types';
import { JourneyScrubber, type ScrubberHandle } from './journey-scrubber';
import { SectionEyebrow } from './section-eyebrow';

// Gallery cuộn ngang (sticky, cơ chế Estate) — 9 địa điểm 3/vùng Bắc→Trung→Nam,
// card tilt 3D + tint vùng. Review #15 (phương án A+C): header dẫn lối đứng yên
// phía trên track + hint động phía dưới hiển thị VÙNG ĐANG XEM theo tiến độ
// cuộn (nhuộm --region-primary của vùng đó).
const REGION_NAME = new Map(REGIONS.map((r) => [r.key, r.name]));

export function Gallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeRegion, setActiveRegion] = useState<MockRegionKey>('north');
  const scrubberRef = useRef<ScrubberHandle>(null);

  useEffect(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    if (!container || !track) {
      return;
    }

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const viewHeight = window.innerHeight;
      const maxScroll = rect.height - viewHeight;
      if (maxScroll <= 0) {
        return;
      }
      // Tiến độ cuộn dọc trong section (0..1) → dịch ngang track tương ứng
      const progress = Math.max(0, Math.min(1, -rect.top / maxScroll));
      const limit = Math.max(0, track.scrollWidth - window.innerWidth);
      track.style.transform = `translateX(-${progress * limit}px)`;
      // 9 card chia đều 3-3-3 → vùng đang xem theo phần ba tiến độ
      setActiveRegion(progress < 1 / 3 ? 'north' : progress < 2 / 3 ? 'central' : 'south');
      scrubberRef.current?.set(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    // Đợi layout đo xong kích thước sau paint đầu
    const timer = setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearTimeout(timer);
    };
  }, []);

  return (
    <section id="gallery" ref={containerRef} className="relative h-[180vh] w-full">
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden">
        {/* Header CĂN GIỮA kiểu PrebuiltUI Feature Sections, nằm TRONG khung sticky —
            tận dụng khoảng trắng trên track, đứng yên suốt hành trình cuộn (review #17,
            combo phương án 1+2). */}
        <div className="mx-auto w-full max-w-5xl px-6 pt-32 text-center">
          <div className="flex justify-center">
            <SectionEyebrow>Destinations</SectionEyebrow>
          </div>
          <motion.h2
            className="mt-3 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
          >
            From the northern mists to the southern delta
          </motion.h2>
          <motion.p
            className="mx-auto mt-2 max-w-[640px] text-sm text-muted-foreground md:text-base"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
          >
            Nine places across three regions — scroll to travel the country from north to south.
          </motion.p>
        </div>

        {/* Track trượt ngang */}
        <div className="flex flex-1 items-center">
          <div
            ref={trackRef}
            className="flex gap-5 px-4 transition-transform duration-300 ease-out will-change-transform md:px-16 lg:px-24 xl:px-32"
          >
            {DESTINATIONS.map((dest) => (
              <TiltCard key={dest.slug} className="shrink-0">
                <a
                  href="#contact"
                  data-region={dest.region}
                  className="group relative block aspect-[4/5] h-[min(52vh,540px)] min-h-[380px] overflow-hidden rounded-xl"
                >
                  <ImagePlaceholder label={dest.blurb} className="h-full w-full" />
                  {/* Chip vùng — tint theo slot --region-* */}
                  <span
                    className="absolute top-4 left-4 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase"
                    style={{
                      background: 'var(--region-surface)',
                      color: 'var(--region-on-surface)',
                    }}
                  >
                    {REGION_NAME.get(dest.region)}
                  </span>
                  {/* Caption đáy — vạch nhấn màu chủ đạo vùng */}
                  <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-overlay to-transparent p-4 pt-10 text-on-media">
                    <span
                      className="h-0.5 w-8 rounded-full"
                      style={{ background: 'var(--region-primary)' }}
                    />
                    <span className="font-heading text-2xl font-semibold">{dest.name}</span>
                    <span className="text-xs opacity-85">{dest.tourCount} tours</span>
                  </span>
                </a>
              </TiltCard>
            ))}
          </div>
        </div>

        {/* Scrubber hành trình (review #18): kéo badge = tua track; scroll là nguồn sự thật */}
        <JourneyScrubber
          activeRegion={activeRegion}
          handleRef={scrubberRef}
          onScrub={(p) => {
            const container = containerRef.current;
            if (!container) {
              return;
            }
            const rect = container.getBoundingClientRect();
            const sectionTop = rect.top + window.scrollY;
            const maxScroll = rect.height - window.innerHeight;
            // Nhảy tức thời để không giành quyền với Lenis khi kéo liên tục
            window.scrollTo({ top: sectionTop + p * maxScroll, behavior: 'instant' });
          }}
        />
      </div>
    </section>
  );
}
