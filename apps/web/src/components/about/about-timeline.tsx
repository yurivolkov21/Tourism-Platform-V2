'use client';

import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';

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
    region: 'north',
  },
  {
    year: '2017',
    title: 'The centre opens',
    description:
      'Huế and Hội An join the map — imperial kitchens, lantern rivers, and our first guides who grew up inside the citadel walls.',
    region: 'central',
  },
  {
    year: '2021',
    title: 'South to the delta',
    description:
      'Mekong boatmen become colleagues. Floating markets before sunrise, island dusk after — the map finally runs the whole country.',
    region: 'south',
  },
  {
    year: '2026',
    title: 'Still twelve seats',
    description:
      'A new home online, the same old promise: small groups, local pace, no scripts. Growth means deeper roads, not more of them.',
  },
];

function MilestoneBlock({ milestone, offset }: { milestone: Milestone; offset: boolean }) {
  return (
    <motion.div
      data-region={milestone.region}
      className={`h-60 max-w-lg ${offset ? 'md:mt-60' : ''}`}
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

  const leftSteps = [MILESTONES[1], MILESTONES[3]];
  const rightSteps = [MILESTONES[0], MILESTONES[2]];

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

        <div className="mt-16 flex flex-col gap-10 md:mt-28 md:flex-row md:gap-0">
          {/* Cột trái: mốc 2 & 4 */}
          <div>
            {leftSteps.map(
              (milestone) =>
                milestone && <MilestoneBlock key={milestone.year} milestone={milestone} offset />,
            )}
          </div>

          {/* Trục giữa: chấm khởi đầu + 3 đoạn tự lấp + chấm mốc (chỉ md+) */}
          <div className="hidden flex-col items-center md:flex">
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

          {/* Cột phải: mốc 1 & 3 */}
          <div>
            {rightSteps.map(
              (milestone, index) =>
                milestone && (
                  <MilestoneBlock key={milestone.year} milestone={milestone} offset={index > 0} />
                ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
