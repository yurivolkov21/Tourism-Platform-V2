'use client';

import { StarIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { SearchCard } from './search-card';

// Stagger load-in kiểu Estate: các khối con trồi lên lần lượt khi trang mở.
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 34 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 240, damping: 60 } },
};

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden text-on-media">
      <div className="hero-scene" aria-hidden="true" />
      <div className="hero-fog" aria-hidden="true" />
      <div className="hero-bamboo" aria-hidden="true" />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex w-full max-w-(--container-content) flex-col items-start gap-5 px-6 pt-24 pb-20"
      >
        <motion.p
          variants={item}
          className="text-xs font-bold tracking-[0.16em] uppercase opacity-85"
        >
          Small-group tours across Vietnam
        </motion.p>
        <motion.h1
          variants={item}
          className="max-w-[16ch] font-heading text-4xl leading-[1.12] font-semibold text-balance md:text-6xl"
        >
          Travel slow. The valley will wait.
        </motion.h1>
        <motion.p variants={item} className="max-w-[46ch] opacity-85">
          Hand-picked journeys through limestone bays, terraced highlands, and lantern-lit old towns
          — led by people who grew up there.
        </motion.p>
        <motion.div variants={item} className="w-full">
          <SearchCard />
        </motion.div>
        <motion.ul variants={item} className="flex flex-wrap items-center gap-6 text-sm opacity-90">
          <li className="flex items-center gap-1.5">
            <StarIcon className="size-4! fill-rating text-rating" aria-hidden="true" />
            <strong className="font-semibold">4.9</strong> · 12,400 reviews
          </li>
          <li>
            <strong className="font-semibold">140+</strong> local guides
          </li>
          <li>Free cancellation up to 48h</li>
        </motion.ul>
      </motion.div>
    </section>
  );
}
