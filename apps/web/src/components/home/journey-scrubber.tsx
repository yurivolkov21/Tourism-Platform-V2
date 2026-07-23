'use client';

import { type Ref, useImperativeHandle, useRef } from 'react';
import { REGIONS } from '@/mocks/regions';
import type { MockRegionKey } from '@/mocks/types';

// Scrubber hành trình (review #18): ray ngang 3 đoạn nhuộm màu 3 vùng (mini
// bản đồ Bắc→Trung→Nam) + badge kéo được. Scroll là NGUỒN SỰ THẬT duy nhất:
// gallery đẩy tiến độ vào qua imperative handle (set), kéo/click chỉ phát
// onScrub(p) để gallery scrollTo — badge không tự giữ state vị trí.
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
        badge.style.left = `${progress * 100}%`;
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
    <div className="flex items-center justify-center pb-8">
      {/* Ray: touch-action none để kéo ngang không giành cuộn dọc (chỉ trên ray nhỏ) */}
      <div
        ref={railRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative h-1.5 w-[min(360px,70vw)] cursor-pointer touch-none rounded-full"
        role="presentation"
      >
        {/* 3 đoạn màu vùng — đoạn đang xem sáng rõ, còn lại mờ */}
        <div className="flex h-full gap-1 overflow-hidden rounded-full">
          {REGIONS.map((region) => (
            <div
              key={region.key}
              data-region={region.key}
              className={`h-full flex-1 rounded-full transition-opacity duration-500 ${
                region.key === activeRegion ? 'opacity-100' : 'opacity-30'
              }`}
              style={{ background: 'var(--region-primary)' }}
            />
          ))}
        </div>

        {/* Badge kéo được — slider chuẩn a11y, tint theo vùng đang xem */}
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
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap shadow-(--shadow-dropdown) transition-colors duration-300 active:cursor-grabbing"
          style={{
            left: '0%',
            background: 'var(--region-surface)',
            color: 'var(--region-on-surface)',
            borderColor: 'var(--region-primary)',
          }}
        >
          {REGION_NAME.get(activeRegion)}
        </button>
      </div>
    </div>
  );
}
