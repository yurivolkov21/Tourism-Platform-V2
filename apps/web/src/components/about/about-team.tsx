'use client';

import type { MediaItem } from '@tourism/contract';
import { aboutPage } from '@tourism/i18n';
import { motion } from 'motion/react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { SlotImage } from '@/components/slot-image';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { TEAM } from '@/mocks/team';

// About §5 Team — §5 lần 2: bản slidex bị chê "trang nào cũng có", thay bằng
// convert ShadcnSpace **Team 01** (user chọn sau vòng săn 3 nguồn): grid 3 cột (4 cột tới 24/09)
// portrait LỚN, hover ảnh chuyển GRAYSCALE (thấy rõ khi có ảnh thật — ghi chú
// dưới), name/role căn giữa. Motion đổi ease gốc
// [0.21,0.47,0.32,0.98] về spring nhà, giữ stagger 0.1s. Trường `line` của
// mock giữ trong data (schema candidate) nhưng không render — Team 01 chủ
// đích tối giản. Nội dung CHỈ founder (quyết định user 23/07); anchor #team
// là đích nút hero §1.
// Hàng icon Website, LinkedIn của mẫu Team 01 đã bỏ 21/10 (review L8-10, Yuri chọn): đội là
// dữ liệu mock nên icon chỉ trỏ `#team`, bấm không đi đâu. Có link thật thì thêm lại.

const t = aboutPage.team;

export function AboutTeam({
  images = {},
}: {
  /** khoá khe → ảnh. Cùng khuôn `about-gallery` / `about-timeline`. */
  images?: Record<string, MediaItem | null>;
}) {
  return (
    <section id="team" className="w-full bg-background px-4 py-24 md:px-16 md:py-32">
      <div className="mx-auto flex max-w-7xl flex-col items-center">
        <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
        <motion.h2
          className="mt-4 max-w-md text-center font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={SPRING_HEADING}
        >
          {t.titleLead}
          <span className="text-primary-emphasis italic"> {t.titleAccent}</span>
        </motion.h2>
        <motion.p
          className="mt-3 max-w-md text-center text-sm text-muted-foreground md:text-base"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, ...SPRING }}
        >
          {t.intro}
        </motion.p>

        <div className="mt-14 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
          {TEAM.map((member, index) => (
            <motion.figure
              key={member.name}
              className="group flex flex-col items-center gap-6"
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: index * 0.1 }}
            >
              {/* Ảnh xám nhạt lúc thường, RÊ VÀO thì bừng màu (đổi 17/08 theo
                  góp ý user — bản cũ làm ngược: màu sẵn rồi hover mới xám).
                  `[@media(hover:hover)]:grayscale` là phần quan trọng: chỉ máy
                  CÓ hover mới bị xám. Trên điện thoại không có hover, nếu để
                  xám mặc định thì avatar vĩnh viễn không bao giờ lên màu.
                  Cũng vì lý do đó KHÔNG dùng skeleton làm trạng thái thường:
                  skeleton là tín hiệu "đang tải", và nội dung chỉ-hiện-khi-hover
                  thì khách mobile mất hẳn. */}
              <SlotImage
                image={images[member.slot] ?? null}
                label={t.portraitLabel(member.name)}
                className="h-80 w-full rounded-xl transition-all duration-500 [@media(hover:hover)]:grayscale group-hover:grayscale-0"
                sizes="(min-width: 768px) 33vw, 100vw"
              />
              <figcaption className="flex w-full flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <p className="font-heading text-2xl font-medium text-foreground">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
