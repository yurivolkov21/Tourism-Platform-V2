'use client';

import { motion } from 'motion/react';

// Review #22: convert từ forged/Partners — dải marquee tên đối tác/báo chí trên
// nền tối, chấm nhấn màu primary, mask gradient hai mép. Đổi ngữ cảnh gym →
// du lịch: danh sách báo/tổ chức du lịch "as featured in". Đây là config tĩnh
// trang trí (không phải ứng viên schema — sẽ không đọc từ API).
// Marquee tái dùng .animate-marquee-left của globals.css (hover dừng,
// reduced-motion tắt) theo đúng cơ chế hai toa của TopBar.
// Export cho mini-marquee "Featured by" của trang /contact tái dùng
export const PARTNERS = [
  'Lonely Planet',
  'TripAdvisor',
  'National Geographic',
  'Condé Nast Traveler',
  'Travel + Leisure',
  'CNN Travel',
  'BBC Travel',
  'The Guardian',
  'Culture Trip',
  'Vietnam Tourism Board',
];

// Một "toa" marquee — hai toa giống hệt nối đuôi tạo loop kín (bản hai ẩn a11y).
function PartnerGroup({ hidden = false }: { hidden?: boolean }) {
  return (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {PARTNERS.map((name) => (
        <div key={name} className="group mx-10 flex shrink-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-primary transition-transform duration-200 group-hover:scale-150"
          />
          <span className="text-lg font-semibold tracking-widest whitespace-nowrap text-muted-foreground/60 uppercase transition-colors duration-200 group-hover:text-foreground/80">
            {name}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Partners() {
  return (
    <section className="dark w-full overflow-hidden border-y bg-background py-16 text-foreground">
      <motion.p
        className="mb-10 px-4 text-center text-xs font-semibold tracking-[0.25em] text-muted-foreground uppercase"
        initial={{ y: -20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
      >
        In good company — featured by travel storytellers worldwide
      </motion.p>

      <div className="relative">
        {/* Mask gradient hai mép để tên trôi vào/ra mềm */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-linear-to-r from-background to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-linear-to-l from-background to-transparent"
        />

        <div className="animate-marquee-left flex w-max">
          <PartnerGroup />
          <PartnerGroup hidden />
        </div>
      </div>
    </section>
  );
}
