'use client';

import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { TiltCard } from '@/components/motion/tilt-card';
import { regionOf } from '@/lib/regions';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import { SectionEyebrow } from './section-eyebrow';

// Gallery cuộn ngang (sticky, cơ chế Estate) — 9 địa điểm 3/vùng Bắc→Trung→Nam,
// card tilt 3D. Review #15 (phương án A+C): header dẫn lối đứng yên phía trên
// track + hint động phía dưới hiển thị VÙNG ĐANG XEM theo tiến độ cuộn.
// Lớp tint theo vùng đã BỎ (ADR-0015, 29/07): chip và vạch nhấn của cả chín thẻ
// dùng chung token brand. `data-region` GIỮ lại làm móc dữ liệu — `gallery.spec.tsx`
// canh nó mang KHOÁ vùng chứ không phải tên hiển thị, một bug đã dính thật.
const REGION_NAME = new Map(REGIONS.map((r) => [r.key, r.name]));

export function Gallery() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

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
            {DESTINATIONS.map((dest) => {
              // `dest.region` giờ là chuỗi tự do kiểu contract ('Northern Vietnam'),
              // KHÔNG còn là khoá 'north'/'central'/'south' — data-region và tra cứu
              // tên vùng phải đi qua regionOf() để về đúng lớp token `[data-region]`.
              const regionKey = regionOf(REGIONS, dest);
              return (
                <TiltCard key={dest.slug} className="shrink-0">
                  <a
                    href="#contact"
                    data-region={regionKey ?? undefined}
                    className="group relative block aspect-[4/5] h-[min(52vh,540px)] min-h-[380px] overflow-hidden rounded-xl"
                  >
                    <ImagePlaceholder
                      label={dest.description ?? dest.name}
                      className="h-full w-full"
                    />
                    {/* Chip vùng — cặp `secondary`/`secondary-foreground` của
                        brand. Trước ADR-0015 nó lấy `--region-surface`/
                        `--region-on-surface` nên ba vùng có ba sắc chip; user đã
                        bác lớp màu theo vùng, nên chín thẻ dùng chung một cặp và
                        cặp đó LẬT theo theme (thứ lớp cũ không làm được). */}
                    <span className="absolute top-4 left-4 rounded-full bg-secondary px-3 py-1 text-xs font-semibold tracking-wide text-secondary-foreground uppercase">
                      {regionKey ? REGION_NAME.get(regionKey) : null}
                    </span>
                    {/* Caption đáy — vạch nhấn brand */}
                    <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-linear-to-t from-overlay to-transparent p-4 pt-10 text-on-media">
                      <span className="h-0.5 w-8 rounded-full bg-primary" />
                      <span className="font-heading text-2xl font-semibold">{dest.name}</span>
                      <span className="text-xs opacity-85">{dest.tourCount} tours</span>
                    </span>
                  </a>
                </TiltCard>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
