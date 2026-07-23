'use client';

import { MoveRightIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { ImagePlaceholder } from '@/components/image-placeholder';

// Convert từ Estate call-to-action.tsx: 3 ảnh xòe quạt (hover xòe rộng thêm),
// heading + mô tả + nút mũi tên trượt. Ảnh lấy từ mock tours.
export function CallToAction() {
  return (
    <section className="flex w-full flex-col items-center justify-center px-4 py-36 text-center md:px-16 lg:px-24 xl:px-32">
      <div className="mx-auto flex max-w-4xl flex-col items-center">
        <div className="group/cta-images relative mb-12 flex h-[200px] w-full max-w-sm items-center justify-center overflow-hidden select-none md:h-[220px] md:max-w-[600px] md:overflow-visible">
          <ImagePlaceholder
            label="Sa Pa terraces"
            className="absolute z-0 h-[100px] w-[200px] origin-bottom-right -rotate-12 translate-x-[-115px] translate-y-4 rounded-[10px] transition-all duration-500 ease-out group-hover/cta-images:translate-x-[-155px] group-hover/cta-images:translate-y-2 group-hover/cta-images:rotate-[-16deg] md:h-[139px] md:w-[251px]"
          />
          <ImagePlaceholder
            label="Hội An lanterns"
            className="absolute z-0 h-[100px] w-[200px] origin-bottom-left rotate-12 translate-x-[115px] translate-y-4 rounded-[10px] transition-all duration-500 ease-out group-hover/cta-images:translate-x-[155px] group-hover/cta-images:translate-y-2 group-hover/cta-images:rotate-16 md:h-[139px] md:w-[251px]"
          />
          <ImagePlaceholder
            label="Hạ Long bay"
            className="absolute z-10 h-[100px] w-[200px] translate-y-[-10px] rounded-[10px] transition-all duration-500 ease-out group-hover/cta-images:translate-y-[-22px] group-hover/cta-images:scale-105 md:h-[139px] md:w-[251px]"
          />
        </div>

        <motion.h2
          className="mb-3 max-w-[520px] font-heading text-3xl tracking-tight text-foreground md:text-[40px]"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 240, damping: 70, mass: 1 }}
        >
          Find the journey that fits your pace
        </motion.h2>

        <motion.p
          className="mb-7 max-w-[400px] text-sm text-muted-foreground"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          Limestone bays, misty terraces, imperial cities, and river markets — pick a region and let
          a local plan the rest.
        </motion.p>

        <motion.a
          href="#contact"
          className="group flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm text-primary-foreground transition-all duration-200 hover:bg-primary/90"
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 320, damping: 70, mass: 1 }}
        >
          <span>Browse tours</span>
          <MoveRightIcon
            className="size-4 transition-transform duration-200 group-hover:translate-x-1"
            aria-hidden="true"
          />
        </motion.a>
      </div>
    </section>
  );
}
