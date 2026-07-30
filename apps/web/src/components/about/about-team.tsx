'use client';

import { GlobeIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { LinkedinIcon } from '@/components/icons/social';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { TEAM } from '@/mocks/team';

// About §5 Team — §5 lần 2: bản slidex bị chê "trang nào cũng có", thay bằng
// convert ShadcnSpace **Team 01** (user chọn sau vòng săn 3 nguồn): grid 4 cột
// portrait LỚN, hover ảnh chuyển GRAYSCALE (thấy rõ khi có ảnh thật — ghi chú
// dưới), name/role căn giữa + hàng social icon tròn. Motion đổi ease gốc
// [0.21,0.47,0.32,0.98] về spring nhà, giữ stagger 0.1s. Trường `line` của
// mock giữ trong data (schema candidate) nhưng không render — Team 01 chủ
// đích tối giản. Nội dung CHỈ founder (quyết định user 23/07); anchor #team
// là đích nút hero §1.

export function AboutTeam() {
  return (
    <section id="team" className="w-full bg-background px-4 py-24 md:px-16 md:py-32">
      <div className="mx-auto flex max-w-7xl flex-col items-center">
        <SectionEyebrow>The team</SectionEyebrow>
        <motion.h2
          className="mt-4 max-w-md text-center font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={SPRING_HEADING}
        >
          Four faces,
          <span className="text-primary italic"> one slow idea.</span>
        </motion.h2>
        <motion.p
          className="mt-3 max-w-md text-center text-sm text-muted-foreground md:text-base"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, ...SPRING }}
        >
          The people who signed the lease, drew the first routes, and still answer the phone.
        </motion.p>

        <div className="mt-14 grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((member, index) => (
            <motion.figure
              key={member.name}
              className="group flex flex-col items-center gap-6"
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: index * 0.1 }}
            >
              {/* Portrait lớn — hover chuyển grayscale (Team 01); hiệu ứng chỉ
                  thấy rõ khi thay placeholder bằng ảnh chân dung thật */}
              <ImagePlaceholder
                label={`Portrait — ${member.name}`}
                className="h-80 w-full rounded-xl transition-all duration-300 group-hover:grayscale"
              />
              <figcaption className="flex w-full flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <p className="font-heading text-2xl font-medium text-foreground">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href="#team"
                    aria-label={`${member.name} — website`}
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground"
                  >
                    <GlobeIcon className="size-4" aria-hidden="true" />
                  </a>
                  <a
                    href="#team"
                    aria-label={`${member.name} — LinkedIn`}
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground"
                  >
                    <LinkedinIcon className="size-4" />
                  </a>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
