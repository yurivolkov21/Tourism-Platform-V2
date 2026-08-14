'use client';

import { BadgeDollarSignIcon, HeadsetIcon, ShieldCheckIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { SPRING } from '@/lib/motion';

// Dải huy hiệu tin cậy — dựng 14/08 khi ba mục chính sách rời khỏi
// `why-choose-us` (xem chú thích ở đó). Chúng KHÔNG bị bỏ: chúng vẫn ảnh hưởng
// tới quyết định đặt tour, chỉ là không hợp với khối kể chuyện có ảnh lớn.
// Đặt NGAY TRƯỚC dải CTA cuối trang: đây là chỗ người dùng quyết định, nên câu
// trả lời cho ba nỗi lo phổ biến nhất nên đứng liền trước lời mời.
//
// ── Ba câu này viết theo DỮ LIỆU, không theo khẩu hiệu ──
//
// 1. Huỷ miễn phí: KHÔNG ghi "48h". Đo trên 30 tour: 15 tour đặt mốc bằng NGÀY
//    (`freeCancellationDays`), 15 tour còn lại viết mốc bằng GIỜ trong policy,
//    và các mốc khác nhau. Một con số chung là nói sai, nên câu này trỏ người
//    đọc về trang tour — nơi con số lấy thẳng từ dữ liệu của chính tour đó.
//
// 2. Không phí ẩn: đây là câu MẠNH NHẤT vì đúng tuyệt đối — `computeBookingTotal`
//    chỉ nhân giá với số khách, mô hình KHÔNG có dòng phí nào. Nói được là nói.
//
// 3. Hỗ trợ: bản cũ ở `why-choose-us` ghi "Support around the clock" (24/7).
//    Chính site tự phủ nhận: `mocks/offices.ts` khai giờ làm việc
//    "Mon–Fri · 8:00 am – 6:00 pm (GMT+7)", và `contact-hero.tsx` viết "a real
//    person replies within the hour, Monday to Friday". Nên câu ở đây chép
//    đúng giờ đã khai, thay vì hứa 24/7 rồi trang Contact nói ngược lại.
const BADGES = [
  {
    icon: ShieldCheckIcon,
    title: 'Free cancellation',
    detail: 'On most departures. Every tour page shows its own window before you book.',
  },
  {
    icon: BadgeDollarSignIcon,
    title: 'No booking fees',
    detail: 'Your total is the tour price times travellers. Nothing is added at checkout.',
  },
  {
    icon: HeadsetIcon,
    title: 'A real person replies',
    detail: 'Within the hour, Monday to Friday, 8am–6pm (GMT+7).',
  },
];

export function TrustStrip() {
  return (
    <section className="w-full border-y bg-muted/40 px-4 py-10 md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
        {BADGES.map((badge, index) => (
          <motion.div
            key={badge.title}
            className="flex items-start gap-4"
            initial={{ y: 24, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ ...SPRING, delay: index * 0.1 }}
          >
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <badge.icon className="size-4.5 text-primary-emphasis" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">{badge.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{badge.detail}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
