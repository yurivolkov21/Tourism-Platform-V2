'use client';

import { motion } from 'motion/react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { REGIONS } from '@/mocks/regions';

// About §Gallery (convert ShadcnSpace Gallery 01 "Destination Gallery" — user
// chọn sau vòng săn): lưới bento 4 card ảnh — trái 1 card LỚN, phải 1 card
// ngang + 2 card vuông; gradient chân + tiêu đề + số đếm, hover zoom 1.05.
// Da thịt: Card shadcn của bản gốc bị lột sạch vai trò (border-none p-0) nên
// thay div thuần; ảnh → ImagePlaceholder (thay thật khi chốt trang); gradient
// gray-950 → token overlay; số đếm lấy THẬT từ REGIONS mock (một nguồn sự
// thật — about-numbers cũng derive cùng nguồn). Chấm màu vùng qua data-region.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

const TOTAL_TOURS = REGIONS.reduce((acc, r) => acc + r.tourCount, 0);

interface GalleryCardProps {
  title: string;
  count: string;
  imageLabel: string;
  region?: string;
  className?: string;
  delay?: number;
}

function GalleryCard({ title, count, imageLabel, region, className, delay = 0 }: GalleryCardProps) {
  return (
    <motion.div
      data-region={region}
      className={`group relative overflow-hidden rounded-2xl after:absolute after:inset-0 after:bg-linear-to-b after:from-transparent after:from-40% after:to-overlay ${className ?? ''}`}
      initial={{ y: 30, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ ...SPRING, delay }}
    >
      <ImagePlaceholder
        label={imageLabel}
        className="h-full w-full transition-transform duration-500 group-hover:scale-105"
      />
      <div className="absolute bottom-0 z-10 flex flex-col gap-1 pb-6 ps-6 text-on-media md:pb-8 md:ps-8">
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: 'var(--region-primary)' }}
          />
          <h3 className="font-heading text-xl font-semibold md:text-2xl">{title}</h3>
        </span>
        <p className="text-sm opacity-80">{count}</p>
      </div>
    </motion.div>
  );
}

export function AboutGallery() {
  const [north, central, south] = REGIONS;

  return (
    <section id="country" className="w-full bg-background px-4 py-24 md:px-16 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 flex flex-col items-center text-center">
          <SectionEyebrow>Through the lens</SectionEyebrow>
          <motion.h2
            className="mt-4 max-w-md font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
          >
            The country we call
            <span className="text-primary italic"> the office.</span>
          </motion.h2>
        </div>

        {/* Bento: trái card lớn · phải 1 ngang + 2 vuông (Gallery 01) */}
        {north && central && south && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <GalleryCard
              title={north.name}
              count={`${north.tourCount} tours`}
              imageLabel="Gallery — terraces under moving mist, Sa Pa"
              region="north"
              className="h-[420px] md:h-[544px]"
            />
            <div className="grid gap-6 md:grid-rows-2">
              <GalleryCard
                title={central.name}
                count={`${central.tourCount} tours`}
                imageLabel="Gallery — lantern night on the Hoài river"
                region="central"
                className="h-[260px]"
                delay={0.1}
              />
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <GalleryCard
                  title={south.name}
                  count={`${south.tourCount} tours`}
                  imageLabel="Gallery — floating market, Cần Thơ"
                  region="south"
                  className="h-[260px]"
                  delay={0.2}
                />
                <GalleryCard
                  title="All of Vietnam"
                  count={`${TOTAL_TOURS} tours, twelve seats each`}
                  imageLabel="Gallery — the road between all three"
                  className="h-[260px]"
                  delay={0.3}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
