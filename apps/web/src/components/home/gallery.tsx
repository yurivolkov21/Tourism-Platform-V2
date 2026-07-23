'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { TOURS } from '@/mocks/tours';

// Convert từ Estate gallery.tsx: section cao 180vh, khung sticky, track ảnh
// trượt ngang theo tiến độ cuộn dọc. Ảnh lấy từ mock tours.
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
    // Đợi ảnh đo xong kích thước sau paint đầu
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
          {TOURS.map((tour) => (
            <figure key={tour.slug} className="relative shrink-0">
              <Image
                src={tour.image}
                alt={tour.title}
                width={364}
                height={457}
                className="pointer-events-none h-[457px] w-[364px] rounded-xl object-cover"
              />
              <figcaption className="absolute right-4 bottom-4 left-4 rounded-lg bg-overlay px-4 py-2.5 text-on-media backdrop-blur-sm">
                <span className="block font-heading text-base font-medium">{tour.title}</span>
                <span className="block text-xs opacity-85">{tour.place}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
