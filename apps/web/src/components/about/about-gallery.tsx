'use client';

import { motion } from 'motion/react';
import { LoadErrorState } from '@/components/feedback/load-error-state';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { ImagePlaceholder } from '@/components/image-placeholder';
import type { DestinationVM, TourCardVM } from '@/lib/api/tours';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { toursInRegion } from '@/lib/regions';
import { REGIONS } from '@/mocks/regions';
import type { MockRegionKey } from '@/mocks/types';

// About §Gallery (convert ShadcnSpace Gallery 01 "Destination Gallery" — user
// chọn sau vòng săn): lưới bento 4 card ảnh — trái 1 card LỚN, phải 1 card
// ngang + 2 card vuông; gradient chân + tiêu đề + số đếm, hover zoom 1.05.
// Da thịt: Card shadcn của bản gốc bị lột sạch vai trò (border-none p-0) nên
// thay div thuần; ảnh → ImagePlaceholder (thay thật khi chốt trang); gradient
// gray-950 → token overlay; số đếm lấy THẬT qua toursInRegion() (một nguồn sự
// thật — about-numbers cũng derive cùng nguồn). Chấm màu vùng qua data-region.
// Task 5 (cụm destinations-api): `tours`/`destinations` giờ nhận qua PROP
// (page fetch `settle(fetchTours())`/`settle(fetchDestinations())`) thay vì
// tự import mock TOURS/DESTINATIONS — REGIONS vẫn là mock CÓ CHỦ ĐÍCH (tầng
// trình bày, không đến từ API, xem lib/regions.ts). Component KHÔNG tự fetch
// (client, có motion, ADR-0016 §4).

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
          {/* Chấm brand. Trước ADR-0015 nó nhuộm theo `data-region` nên bốn thẻ
              có bốn sắc; user đã bác lớp màu theo vùng, nên nó tụt xuống thành
              bullet trang trí — tên vùng đã nằm ngay trong `<h3>` kề bên. */}
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          <h3 className="font-heading text-xl font-semibold md:text-2xl">{title}</h3>
        </span>
        <p className="text-sm opacity-80">{count}</p>
      </div>
    </motion.div>
  );
}

export function AboutGallery({
  tours,
  destinations,
  failed,
}: {
  tours: TourCardVM[];
  destinations: DestinationVM[];
  failed: boolean;
}) {
  const [north, central, south] = REGIONS;

  // Tổng tour THẬT — phẳng, không cộng dồn theo vùng (xem toursInRegion() bên
  // dưới cho lý do: một tour xuyên vùng chạm cả ba, cộng dồn đếm nhiều lần).
  const totalTours = tours.length;
  /** Số tour DẪN XUẤT của một vùng — tour DISTINCT chạm bất kỳ địa điểm của vùng. */
  const regionTourCount = (key: MockRegionKey) =>
    toursInRegion(REGIONS, destinations, tours, key).length;

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
            transition={SPRING_HEADING}
          >
            The country we call
            <span className="text-primary-emphasis italic"> the office.</span>
          </motion.h2>
        </div>

        {/* Fetch tours/destinations lỗi → LoadErrorState thay cả bento: cả 4
            card đều in số đếm dẫn xuất từ hai nguồn đó, không còn card nào
            "an toàn" để giữ lại — đúng khuôn Journal/Gallery Home (ADR-0016
            §4), heading vẫn đứng nguyên phía trên. */}
        {failed ? (
          <LoadErrorState className="mx-auto max-w-lg" />
        ) : (
          // Bento: trái card lớn · phải 1 ngang + 2 vuông (Gallery 01)
          north &&
          central &&
          south && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <GalleryCard
                title={north.name}
                count={`${regionTourCount('north')} tours`}
                imageLabel="Gallery — terraces under moving mist, Sa Pa"
                region="north"
                className="h-[420px] md:h-[544px]"
              />
              <div className="grid gap-6 md:grid-rows-2">
                <GalleryCard
                  title={central.name}
                  count={`${regionTourCount('central')} tours`}
                  imageLabel="Gallery — lantern night on the Hoài river"
                  region="central"
                  className="h-[260px]"
                  delay={0.1}
                />
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <GalleryCard
                    title={south.name}
                    count={`${regionTourCount('south')} tours`}
                    imageLabel="Gallery — floating market, Cần Thơ"
                    region="south"
                    className="h-[260px]"
                    delay={0.2}
                  />
                  <GalleryCard
                    title="All of Vietnam"
                    count={`${totalTours} tours, twelve seats each`}
                    imageLabel="Gallery — the road between all three"
                    className="h-[260px]"
                    delay={0.3}
                  />
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </section>
  );
}
