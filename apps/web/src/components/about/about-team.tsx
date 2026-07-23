'use client';

import { motion } from 'motion/react';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { TEAM } from '@/mocks/team';

// About §5 Team (convert slidex/meet-our-team — section team-grid ĐÚNG NGHĨA
// duy nhất trong 12 template): hàng card chân dung dọc (ảnh 208×256 + tên +
// chức danh), bản gốc chỉ CSS hover nên bơm thêm spring nhà: card trồi vào
// so le, hover nhấc nhẹ. Nội dung: CHỈ founder/vận hành (quyết định user
// 23/07) — 4 người khớp chuyện §2. Anchor #team là đích của nút hero §1.
const SPRING = { type: 'spring', stiffness: 320, damping: 70, mass: 1 } as const;

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
          transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
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

        <div className="mt-14 flex flex-wrap justify-center gap-8">
          {TEAM.map((member, index) => (
            <motion.figure
              key={member.name}
              className="w-52 transition-transform duration-300 hover:-translate-y-1"
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: index * 0.1 }}
            >
              <ImagePlaceholder
                label={`Portrait — ${member.name}`}
                className="h-64 w-52 rounded-xl"
              />
              <figcaption className="mt-4">
                <p className="font-heading text-lg font-semibold text-foreground">{member.name}</p>
                <p className="mt-0.5 text-xs font-medium tracking-wide text-primary uppercase">
                  {member.role}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{member.line}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
