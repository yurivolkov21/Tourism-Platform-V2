'use client';

import { Clock8Icon, MapPinIcon } from 'lucide-react';
import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { AnimatedGridPattern } from '@/components/motion/animated-grid-pattern';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { OFFICES } from '@/mocks/offices';

// Contact §3 — map thật MapLibre (ADR-0018, thay ImagePlaceholder 06/08) +
// lưới 2 card văn phòng (địa chỉ · giờ mở cửa · nút Get directions trỏ Google
// Maps). Data từ mock OFFICES — nguồn sự thật duy nhất của địa chỉ toàn site.

// maplibre-gl nặng và cần WebGL (client-only) → chunk lười, bỏ SSR.
const ContactMap = dynamic(() => import('./contact-map'), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

function MapSkeleton() {
  return <div className="size-full animate-pulse bg-muted" aria-hidden="true" />;
}

export function ContactLocation() {
  // Chunk bản đồ chỉ tải khi khách thật sự cuộn tới khu này — rootMargin 200px
  // để nó kịp tải xong trước khi lọt vào tầm mắt.
  const mapRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = mapRef.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  return (
    <section
      id="visit"
      className="relative w-full overflow-hidden bg-muted px-4 py-20 md:px-16 md:py-28 lg:px-24 xl:px-32"
    >
      {/* Nền lưới ĐỘNG (thay lưới trắc địa tĩnh, 27/07): ô sáng nhấp nháy rải
          rác trên lưới — giữ nguyên mask mờ dần về đáy của bản cũ để không đè
          lưới card. Màu đặt bằng token (fill/stroke primary), không hex.
          Component tự dừng khi cuộn khỏi khung nhìn và tự tắt hẳn khi người
          dùng xin giảm chuyển động — hai thứ bản gốc MagicUI không có. */}
      <AnimatedGridPattern
        numSquares={26}
        maxOpacity={0.28}
        duration={4}
        repeatDelay={0.8}
        className="fill-primary/25 stroke-primary/20 [mask-image:linear-gradient(to_bottom,black_35%,transparent_85%)]"
      />
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-4 md:mb-14">
          <SectionEyebrow>Come say hello</SectionEyebrow>
          <motion.h2
            className="max-w-md font-heading text-3xl leading-tight font-medium text-foreground md:text-4xl"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={SPRING_HEADING}
          >
            Two doors,
            <span className="text-primary italic"> always open.</span>
          </motion.h2>
        </div>

        {/* Bản đồ MapLibre — nằm trong lớp z-10 để nền lưới động không đè lên */}
        <motion.div
          ref={mapRef}
          className="relative h-90 overflow-hidden rounded-2xl ring-1 ring-border sm:h-110"
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={SPRING}
        >
          {inView ? <ContactMap /> : <MapSkeleton />}
        </motion.div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {OFFICES.map((office, index) => (
            <motion.div
              key={office.city}
              className="rounded-xl bg-background p-5 shadow-(--shadow-card) ring-1 ring-border sm:p-6"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: index * 0.1 }}
            >
              <h3 className="font-heading text-xl font-semibold text-foreground">
                {office.city}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {office.name}
                </span>
              </h3>
              <div className="mt-3 flex flex-col gap-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <MapPinIcon
                    className="mt-0.5 size-4.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">
                    {office.addressLines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock8Icon className="size-4.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-muted-foreground">{office.hours}</span>
                </div>
              </div>
              {/* Chỉ đường mở Google Maps ở tab mới — trước 06/08 đây là
                  href="#visit", một link chết trỏ ngược về chính section. */}
              <a
                href={office.mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
              >
                Get directions →
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
