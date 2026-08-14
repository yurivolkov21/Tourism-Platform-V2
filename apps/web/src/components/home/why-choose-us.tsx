'use client';

import type { MediaItem } from '@tourism/contract';
import {
  CompassIcon,
  LampIcon,
  LandmarkIcon,
  MinusIcon,
  PlusIcon,
  ShipIcon,
  UtensilsIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { SlotImage } from '@/components/slot-image';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { SectionEyebrow } from './section-eyebrow';

// Convert từ Estate why-choose-us.tsx: accordion trái (mở mục nào thì ảnh phải
// đổi theo mục đó, transition scale+fade), nội dung sang tours.
// Review #26: thêm dải caption động dưới ảnh (hiện tên mục đang mở + chấm
// điều hướng — làm cơ chế accordion-đổi-ảnh hiện hình thay vì ngầm).
// Review #27: quote guide (từng thêm ở #26) bị gỡ theo review — khoảng
// trống dưới heading trả về nhịp thở nguyên bản của Estate.
const DEFAULT_IMAGE_LABEL = 'Three regions in one country';

// ── Vì sao năm mục này, và vì sao KHÔNG phải năm mục cũ (đổi 14/08) ──
//
// Bản cũ trộn hai loại lời hứa: hai mục kể TRẢI NGHIỆM (guide bản địa, nhóm
// nhỏ) và ba mục nêu CHÍNH SÁCH (huỷ miễn phí, giá minh bạch, hỗ trợ 24/7).
// Ba mục chính sách hỏng ở cả hai đầu: trang đặt tour nào cũng nói y hệt nên
// không tạo khác biệt, và **không tồn tại bức ảnh nào minh hoạ được** "không
// phí ẩn" — trong khi đây là khối mà ảnh chiếm nửa bố cục.
//
// Năm mục mới đều là một dạng HIỂU BIẾT BẢN ĐỊA (biết ăn ở đâu, biết đi đường
// nước, biết lúc nào phố vắng khách) — ăn khớp tiêu đề "Travel Vietnam with
// people who call it home" — và mỗi mục có một chủ thể ảnh RỜI NHAU: người,
// đồ ăn, thuyền, đèn đêm, kiến trúc cổ.
//
// Chọn theo số đo trên 30 tour thật (summary + highlights + itinerary):
// ẩm thực 30/30 · sông nước 21/30 · đêm/đèn 19/30 · lối mòn 17/30 · di sản 13/30.
//
// Ba mục chính sách KHÔNG bị xoá khỏi sản phẩm — chúng là huy hiệu tin cậy,
// chỗ đúng là một dải icon gọn, không phải khối kể chuyện có ảnh lớn. Chúng đã
// chuyển sang `trust-strip.tsx` (đặt ngay trước dải CTA cuối trang), và câu chữ
// ở đó được viết lại theo dữ liệu — trong đó "Support around the clock" bị BỎ
// vì chính site khai giờ làm việc Mon–Fri 8:00–18:00.
//
// Trường `image` cũ đã GỠ: nó trỏ `/mock/*.jpg` theo ánh xạ địa danh của bản
// tĩnh, không dòng code nào đọc, và giờ còn sai so với chủ đề mới.
const ITEMS = [
  {
    icon: CompassIcon,
    title: 'Local guides on every route',
    slot: 'why-guide',
    description:
      'Every journey is led by someone who grew up on it. Paths, meals, and stories come from lived experience — not a script.',
  },
  {
    icon: UtensilsIcon,
    title: 'You eat where they eat',
    slot: 'why-food',
    description:
      'No hotel buffets. You eat the dishes your guide grew up on — bún, phở, bánh — at the places they have gone to for years.',
  },
  {
    icon: ShipIcon,
    title: 'The country from the water',
    slot: 'why-river',
    description:
      'Limestone bays in the north, delta canals in the south. Much of Vietnam only makes sense from a boat.',
  },
  {
    icon: LampIcon,
    title: 'Towns worth staying the evening for',
    slot: 'why-evening',
    description:
      'Day-trippers leave by four. Our evening routes start when the lanterns come on and the streets go back to the people who live there.',
  },
  {
    icon: LandmarkIcon,
    title: 'Heritage, not a plaque',
    slot: 'why-heritage',
    description:
      'Citadels, tombs and pagodas explained by someone whose own family history runs through them — not read off a sign.',
  },
];

export function WhyChooseUs({
  images = {},
}: {
  /** khoá khe → ảnh. Khe thiếu ảnh thì SlotImage tự rơi về giữ chỗ. */
  images?: Record<string, MediaItem | null>;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mt-28 w-full bg-muted px-4 py-16 md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-2 md:gap-16 lg:gap-24">
        {/* Cột trái: heading + accordion */}
        <div className="flex flex-col">
          <SectionEyebrow>Why tourism</SectionEyebrow>
          <motion.h2
            className="mt-4 max-w-100 font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={SPRING_HEADING}
          >
            Travel Vietnam with people who call it home
          </motion.h2>

          <div className="mt-12 flex w-full flex-col gap-4 md:mt-16">
            {ITEMS.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <motion.div
                  key={item.title}
                  className="overflow-hidden rounded-sm border bg-card"
                  initial={{ y: 150, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ ...SPRING, delay: index * 0.15 }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between p-4 text-left transition hover:bg-muted/40 md:px-6 md:py-4"
                    aria-expanded={isOpen}
                  >
                    <span className="flex items-center gap-4">
                      <item.icon className="size-5 text-primary-emphasis" aria-hidden="true" />
                      <span className="text-sm text-card-foreground md:text-base">
                        {item.title}
                      </span>
                    </span>
                    {isOpen ? (
                      <MinusIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <PlusIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    )}
                  </button>

                  {/* Mở/đóng mượt bằng grid-rows transition — giữ nguyên kỹ thuật template */}
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="p-4 pt-0 text-xs leading-relaxed text-muted-foreground md:px-10 md:text-sm">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Cột phải: mô tả + ảnh đổi theo mục đang mở */}
        <div className="flex flex-col justify-between">
          <motion.p
            className="mb-8 max-w-115 text-sm text-muted-foreground md:mt-20 md:text-base"
            initial={{ y: 50, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ ...SPRING, delay: 0.2 }}
          >
            Our local guides bring insider knowledge and personal care to every departure, so your
            only job is to be there.
          </motion.p>

          {/* Bọc ảnh + caption thành MỘT con của flex justify-between — giữ nguyên
              cách chia khoảng cũ (mô tả trên / khối ảnh dưới) */}
          <div>
            <motion.div
              className="relative h-102.75 w-121.5 max-w-full overflow-hidden rounded-xl bg-muted shadow-(--shadow-card)"
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={SPRING}
            >
              <SlotImage
                image={images['home-why-choose'] ?? null}
                label={DEFAULT_IMAGE_LABEL}
                sizes="(min-width: 768px) 50vw, 100vw"
                className={`absolute inset-0 h-full w-full transition-all duration-500 ease-in-out ${
                  openIndex === null
                    ? 'scale-100 opacity-100'
                    : 'pointer-events-none scale-95 opacity-0'
                }`}
              />
              {ITEMS.map((item, index) => (
                <SlotImage
                  key={item.title}
                  image={images[item.slot] ?? null}
                  label={item.title}
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className={`absolute inset-0 h-full w-full transition-all duration-500 ease-in-out ${
                    openIndex === index
                      ? 'scale-100 opacity-100'
                      : 'pointer-events-none scale-95 opacity-0'
                  }`}
                />
              ))}
            </motion.div>

            {/* Dải caption động (C) — hiện tên mục đang mở + chấm điều hướng,
              làm rõ mối liên hệ accordion ↔ ảnh. Chấm bấm được: mở đúng mục
              (bấm lại chấm đang mở thì đóng, y hệt hành vi accordion). */}
            <motion.div
              className="mt-4 flex w-121.5 max-w-full items-center justify-between gap-4"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: 0.1 }}
            >
              <motion.span
                key={openIndex === null ? DEFAULT_IMAGE_LABEL : ITEMS[openIndex]?.title}
                className="truncate text-sm text-muted-foreground"
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                {openIndex === null ? DEFAULT_IMAGE_LABEL : ITEMS[openIndex]?.title}
              </motion.span>
              <div className="flex shrink-0 items-center gap-2">
                {ITEMS.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                    aria-label={item.title}
                    aria-pressed={openIndex === index}
                    className={`h-1.5 cursor-pointer rounded-full transition-all duration-300 ${
                      openIndex === index ? 'w-6 bg-primary' : 'w-1.5 bg-border hover:bg-primary/40'
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
