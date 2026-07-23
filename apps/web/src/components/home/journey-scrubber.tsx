'use client';

import { type Ref, useImperativeHandle, useRef } from 'react';
import { REGIONS } from '@/mocks/regions';
import type { MockRegionKey } from '@/mocks/types';

// Scrubber hành trình (review #19, style badge-lồng-badge của PrebuiltUI —
// Exclusive Offer/Order Tracking): outer pill viền tròn làm khe chạy với 3 chấm
// mốc màu vùng, inner chip tint vùng TRƯỢT bên trong — cuộn xuống card chạy
// trái, chip chạy phải (ngược chiều). Scroll là NGUỒN SỰ THẬT duy nhất:
// gallery đẩy tiến độ qua handle set(), kéo/click chỉ phát onScrub(p).
export interface ScrubberHandle {
  /** Gallery gọi mỗi scroll tick — đặt vị trí badge theo tiến độ 0..1 */
  set(progress: number): void;
}

interface JourneyScrubberProps {
  activeRegion: MockRegionKey;
  onScrub: (progress: number) => void;
  handleRef: Ref<ScrubberHandle>;
}

const REGION_NAME = new Map(REGIONS.map((r) => [r.key, r.name]));

export function JourneyScrubber({ activeRegion, onScrub, handleRef }: JourneyScrubberProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);

  useImperativeHandle(handleRef, () => ({
    set(progress: number) {
      const badge = badgeRef.current;
      if (badge) {
        // left + translateX ngược để chip trượt TRONG lòng pill, không tràn mép
        badge.style.left = `${progress * 100}%`;
        badge.style.transform = `translateX(${-progress * 100}%) translateY(-50%)`;
        badge.setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      }
    },
  }));

  // Quy đổi toạ độ con trỏ trên ray → tiến độ 0..1
  const progressFromPointer = (clientX: number) => {
    const rail = railRef.current;
    if (!rail) {
      return 0;
    }
    const rect = rail.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    onScrub(progressFromPointer(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragging.current) {
      onScrub(progressFromPointer(e.clientX));
    }
  };

  const handlePointerUp = () => {
    dragging.current = false;
  };

  // Bàn phím: mũi tên nhảy theo 1/9 (từng card), Home/End về hai đầu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const badge = badgeRef.current;
    const current = badge ? Number.parseFloat(badge.style.left || '0') / 100 : 0;
    const step = 1 / 9;
    if (e.key === 'ArrowRight') {
      onScrub(Math.min(1, current + step));
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      onScrub(Math.max(0, current - step));
      e.preventDefault();
    } else if (e.key === 'Home') {
      onScrub(0);
      e.preventDefault();
    } else if (e.key === 'End') {
      onScrub(1);
      e.preventDefault();
    }
  };

  return (
    <div className="flex items-center justify-center pb-5">
      {/* Outer pill = khe chạy (badge ngoài): viền tròn, 3 chấm mốc màu vùng.
          touch-action none chỉ trên pill nhỏ — không giành cuộn dọc của trang. */}
      <div
        ref={railRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative h-10 w-[min(320px,70vw)] cursor-pointer touch-none rounded-full border bg-card shadow-(--shadow-card)"
        role="presentation"
      >
        {/* 3 chấm mốc — vị trí giữa mỗi vùng trên hành trình */}
        {REGIONS.map((region, i) => (
          <span
            key={region.key}
            data-region={region.key}
            aria-hidden="true"
            className={`absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-500 ${
              region.key === activeRegion ? 'opacity-90' : 'opacity-35'
            }`}
            style={{ left: `${((i * 2 + 1) / 6) * 100}%`, background: 'var(--region-primary)' }}
          />
        ))}

        {/* Inner chip (badge trong) — trượt trong lòng pill, tint vùng đang xem */}
        <button
          ref={badgeRef}
          type="button"
          data-region={activeRegion}
          role="slider"
          aria-label="Journey position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          aria-valuetext={REGION_NAME.get(activeRegion)}
          onKeyDown={handleKeyDown}
          className="absolute top-1/2 cursor-grab rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-300 active:cursor-grabbing"
          style={{
            left: '0%',
            transform: 'translateY(-50%)',
            background: 'var(--region-primary)',
            color: 'var(--on-media)',
          }}
        >
          {REGION_NAME.get(activeRegion)}
        </button>
      </div>
    </div>
  );
}
