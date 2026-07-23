'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { TOURS } from '@/mocks/tours';

// Convert từ PrebuiltUI "Image Slider with Indicators" (review #10, thay
// hover-expand gallery): slider trượt ngang + chấm indicator, tự chạy 4s/slide
// (dừng khi hover hoặc reduced-motion), bấm chấm để nhảy slide.
// Thu ~13% so với cột (w-[87%]) theo yêu cầu giảm tỉ lệ 10–15%.
const SLIDES = TOURS.slice(0, 5);

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

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
      aria-label="Featured tours"
      className="mx-auto w-full self-center lg:w-[87%]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((tour) => (
            <div key={tour.slug} className="w-full shrink-0">
              <ImagePlaceholder
                label={`${tour.title} — from ${usd.format(tour.priceUsd)} / person`}
                className="aspect-(--aspect-card) w-full"
              />
            </div>
          ))}
        </div>

        {/* Chấm indicator — chấm active giãn dài, bấm để nhảy slide */}
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
          {SLIDES.map((tour, i) => (
            <button
              key={tour.slug}
              type="button"
              aria-label={`Slide ${i + 1}: ${tour.title}`}
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
