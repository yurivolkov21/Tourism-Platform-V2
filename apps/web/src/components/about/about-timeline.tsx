'use client';

import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { ImagePlaceholder } from '@/components/image-placeholder';

// About §3 Timeline (convert 100% cơ chế prompt2app/build-process): trục dọc
// giữa gồm 3 đoạn line TỰ LẤP ĐẦY theo tiến trình cuộn (đo getBoundingClientRect
// mỗi đoạn, map vào [0.6vh → 0.2vh]), chấm mốc đổi màu khi đoạn trên nó chạy
// xong; 4 mốc zigzag hai bên (phải→trái→phải→trái, so le h-60/mt-60 y template).
// Nâng cấp riêng v2: mỗi mốc nhuộm màu VÙNG nó mở ra qua data-region +
// var(--region-primary) (page-level — hợp lệ ADR-0013 #4); mốc cuối màu brand.
// Mobile: ẩn trục, mốc xếp dọc (như template gốc).
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

interface Milestone {
  year: string;
  title: string;
  description: string;
  /** Nhãn ảnh minh hoạ — chiếm ô trống đối diện chữ (góp ý user, kiểu Nexora) */
  imageLabel: string;
  /** Vùng gắn với mốc — undefined = màu brand mặc định */
  region?: 'north' | 'central' | 'south';
}

// Mốc chẵn (index 0,2) cột PHẢI · mốc lẻ (1,3) cột TRÁI — đúng nhịp template
const MILESTONES: Milestone[] = [
  {
    year: '2014',
    title: 'Three guides, one minivan',
    description:
      'It starts in Sa Pa: two brothers and a neighbour borrow a minivan and take eight strangers across the terraces they grew up on. Nobody calls it a company yet.',
    imageLabel: '2014 — the borrowed minivan, Sa Pa',
    region: 'north',
  },
  {
    year: '2017',
    title: 'The centre opens',
    description:
      'Huế and Hội An join the map — imperial kitchens, lantern rivers, and our first guides who grew up inside the citadel walls.',
    imageLabel: '2017 — lanterns on the Thu Bồn river',
    region: 'central',
  },
  {
    year: '2021',
    title: 'South to the delta',
    description:
      'Mekong boatmen become colleagues. Floating markets before sunrise, island dusk after — the map finally runs the whole country.',
    imageLabel: '2021 — Cái Răng floating market at dawn',
    region: 'south',
  },
  {
    year: '2026',
    title: 'Still twelve seats',
    description:
      'A new home online, the same old promise: small groups, local pace, no scripts. Growth means deeper roads, not more of them.',
    imageLabel: '2026 — the team, twelve seats later',
  },
];

function MilestoneText({ milestone }: { milestone: Milestone }) {
  return (
    <motion.div
      data-region={milestone.region}
      className="h-60 w-full max-w-lg"
      initial={{ y: 40, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={SPRING}
    >
      <p className="font-heading text-3xl font-semibold" style={{ color: 'var(--region-primary)' }}>
        {milestone.year}
      </p>
      <h3 className="mt-2 font-heading text-xl font-medium text-foreground">{milestone.title}</h3>
      <p className="mt-3 text-sm/6 text-muted-foreground">{milestone.description}</p>
    </motion.div>
  );
}

// Ảnh minh hoạ chiếm ô trống ĐỐI DIỆN chữ (góp ý user — kiểu genesis/Nexora):
// trượt vào từ phía mình đứng, vạch accent màu vùng ở đáy.
function MilestoneImage({ milestone, side }: { milestone: Milestone; side: 'left' | 'right' }) {
  return (
    <motion.div
      data-region={milestone.region}
      className="hidden h-60 w-full max-w-lg pb-8 md:block"
      initial={{ x: side === 'left' ? -40 : 40, opacity: 0 }}
      whileInView={{ x: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={SPRING}
    >
      <div className="relative h-full w-full overflow-hidden rounded-xl">
        <ImagePlaceholder label={milestone.imageLabel} className="h-full w-full" />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ background: 'var(--region-primary)' }}
        />
      </div>
    </motion.div>
  );
}

export function AboutTimeline() {
  const segmentRefs = useRef<HTMLDivElement[]>([]);
  const [progress, setProgress] = useState<number[]>([0, 0, 0]);

  useEffect(() => {
    const handleScroll = () => {
      const updated = segmentRefs.current.map((el) => {
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        // Đoạn line "vẽ" trong khoảng nó đi từ 60% xuống 20% chiều cao màn
        const start = windowHeight * 0.6;
        const end = windowHeight * 0.2;
        return Math.min(Math.max((start - rect.top) / (start - end), 0), 1);
      });
      setProgress(updated);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [m1, m2, m3, m4] = MILESTONES;

  return (
    <section id="milestones" className="w-full bg-muted px-4 py-24 md:px-16 md:py-32">
      <div className="mx-auto flex max-w-7xl flex-col items-center">
        <SectionEyebrow>Milestones</SectionEyebrow>
        <motion.h2
          className="mt-4 max-w-md text-center font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
        >
          Twelve years,
          <span className="text-primary italic"> four turning points.</span>
        </motion.h2>

        {/* Desktop: zigzag chữ–ảnh soi gương qua trục — mỗi cột xen kẽ
            [ảnh đối diện, chữ, ảnh đối diện, chữ] nên không cần offset */}
        <div className="mt-16 hidden md:mt-28 md:flex">
          {m1 && m2 && m3 && m4 && (
            <>
              {/* Cột trái: ảnh M1 · chữ M2 · ảnh M3 · chữ M4 */}
              <div className="flex flex-col items-end">
                <MilestoneImage milestone={m1} side="left" />
                <MilestoneText milestone={m2} />
                <MilestoneImage milestone={m3} side="left" />
                <MilestoneText milestone={m4} />
              </div>

              {/* Trục giữa: chấm khởi đầu + 3 đoạn tự lấp + chấm mốc */}
              <div className="flex flex-col items-center">
                <div className="size-3.5 rounded-sm bg-primary" />
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div
                      ref={(el) => {
                        if (el) segmentRefs.current[i] = el;
                      }}
                      className="relative mx-10 h-60 w-0.5 overflow-hidden bg-border"
                    >
                      <div
                        style={{ height: `${(progress[i] ?? 0) * 100}%` }}
                        className="absolute top-0 left-0 w-full bg-primary"
                      />
                    </div>
                    <div
                      className={`size-3.5 rounded-sm transition-colors duration-300 ${
                        (progress[i] ?? 0) > 0.95 ? 'bg-primary' : 'bg-border'
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* Cột phải: chữ M1 · ảnh M2 · chữ M3 · ảnh M4 */}
              <div className="flex flex-col items-start">
                <MilestoneText milestone={m1} />
                <MilestoneImage milestone={m2} side="right" />
                <MilestoneText milestone={m3} />
                <MilestoneImage milestone={m4} side="right" />
              </div>
            </>
          )}
        </div>

        {/* Mobile: stack dọc ĐÚNG thứ tự thời gian (sửa luôn lỗi thứ tự của
            template gốc — bản cũ mobile hiện M2,M4 trước M1,M3) */}
        <div className="mt-16 flex flex-col gap-12 md:hidden">
          {MILESTONES.map((milestone) => (
            <div key={milestone.year} data-region={milestone.region}>
              <p
                className="font-heading text-3xl font-semibold"
                style={{ color: 'var(--region-primary)' }}
              >
                {milestone.year}
              </p>
              <h3 className="mt-2 font-heading text-xl font-medium text-foreground">
                {milestone.title}
              </h3>
              <p className="mt-3 text-sm/6 text-muted-foreground">{milestone.description}</p>
              <div className="relative mt-5 h-44 w-full overflow-hidden rounded-xl">
                <ImagePlaceholder label={milestone.imageLabel} className="h-full w-full" />
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-1"
                  style={{ background: 'var(--region-primary)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
