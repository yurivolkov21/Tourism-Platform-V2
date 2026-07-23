'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { MOMENTS } from '@/mocks/moments';

// Convert từ PrebuiltUI "Image Slider with Indicators" (review #10; #11 đổi
// nội dung sang KHOẢNH KHẮC TRẢI NGHIỆM của khách — bằng chứng sống đứng cạnh
// số liệu social proof, không phải danh mục tour): tự chạy 4s/slide (dừng khi
// hover / reduced-motion), bấm chấm nhảy slide. Thu ~13% so với cột.
const SLIDES = MOMENTS;

export function StatsSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (paused || reduced) {
      return;
    }
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 4000);
    return () => clearInterval(timer);
  }, [paused, reduced]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Traveler moments"
      className="mx-auto w-full self-center lg:w-[87%]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((moment) => (
            <div key={moment.title} className="w-full shrink-0">
              <ImagePlaceholder
                label={`${moment.title} — ${moment.credit}`}
                className="aspect-(--aspect-card) w-full"
              />
            </div>
          ))}
        </div>

        {/* Chấm indicator — chấm active giãn dài, bấm để nhảy slide */}
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
          {SLIDES.map((moment, i) => (
            <button
              key={moment.title}
              type="button"
              aria-label={`Slide ${i + 1}: ${moment.title}`}
              aria-current={i === index || undefined}
              onClick={() => setIndex(i)}
              className={`h-2 cursor-pointer rounded-full transition-all duration-300 ${
                i === index ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
