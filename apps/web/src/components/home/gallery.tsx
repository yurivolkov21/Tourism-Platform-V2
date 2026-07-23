'use client';

import { useEffect, useRef } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { TiltCard } from '@/components/motion/tilt-card';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';

// Gallery cuộn ngang (cơ chế sticky giữ nguyên từ Estate) — review #14 đổi nội
// dung từ tour sang 9 ĐỊA ĐIỂM (3 mỗi vùng, liền mạch Bắc → Trung → Nam), card
// tilt 3D theo con trỏ (PrebuiltUI) + tint vùng qua slot --region-* (page-level
// được phép dùng — ADR-0013 #4).
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
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div
          ref={trackRef}
          className="flex gap-5 px-4 py-16 transition-transform duration-300 ease-out will-change-transform md:px-16 md:py-20 lg:px-24 xl:px-32"
        >
          {DESTINATIONS.map((dest) => (
            <TiltCard key={dest.slug} className="shrink-0">
              <a
                href="#contact"
                data-region={dest.region}
                className="group relative block h-[457px] w-[364px] overflow-hidden rounded-xl"
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
    </section>
  );
}
