'use client';

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { BookingRail } from '@/components/tours/booking-rail';
import { DepartureStrip } from '@/components/tours/departure-strip';
import type { DepartureVM } from '@/lib/api/tours';

/**
 * Trạng thái "đợt đang chọn" dùng chung cho BỐN nơi: dải chip dưới hero, panel
 * đặt chỗ cạnh gallery, tab Departures, rail booking (+ bar đáy mobile). Một
 * hành động → mọi nơi phản hồi. Modal "All dates" cũng sống ở đây vì hai chỗ
 * khác nhau cùng mở nó mà trang chỉ render một instance.
 *
 * VÌ SAO LÀ CONTEXT chứ không phải state nâng lên `page.tsx`: các nơi đó nằm ở
 * những vị trí khác nhau trong bố cục, và nâng state lên page sẽ buộc cả trang
 * thành client component — mất luôn phần render phía server của tab Overview.
 * Provider là client, còn `children` truyền vào nó vẫn được server render
 * bình thường.
 *
 * Hai component trình bày (`DepartureStrip`/`BookingRail`) giữ nguyên dạng NHẬN
 * PROP THUẦN để test được độc lập; các bản `…Connected` dưới đây chỉ làm một
 * việc là nối chúng vào context. (`DeparturesTableConnected` đã xoá cùng
 * `departures-table.tsx` ở đợt trùng tu 13/08 — bảng đợt giữa trang nay là
 * tab Departures + modal "All dates".)
 */
interface DepartureSelection {
  selectedId: string | undefined;
  select: (id: string) => void;
  departures: DepartureVM[];
  /** Trạng thái modal "All dates" (Task 5) — sống Ở ĐÂY, không phải trong
      component gọi mở nó: cả `TourMediaPanel` (Task 4) lẫn tab Departures
      (Task 9) đều cần mở CÙNG MỘT modal, mà trang chỉ render một instance. */
  allDatesOpen: boolean;
  openAllDates: () => void;
  closeAllDates: () => void;
}

const Ctx = createContext<DepartureSelection | null>(null);

/** Export vì `TourMediaPanel` (Task 4) và tab Departures (Task 9) cần đọc
    trực tiếp — trước đây hàm này private vì chỉ ba `…Connected` dưới đây
    dùng nội bộ. */
/**
 * Bản KHÔNG ném khi thiếu provider — cho `TourHero`, vốn còn được
 * `TourHeroBoard` dựng ở `/book` và `/enquire` (không có provider): ở đó hero
 * rơi về giá "from" (đợt rẻ nhất), ở trang chi tiết thì bám đợt đang chọn.
 */
export function useOptionalDepartureSelection(): DepartureSelection | null {
  return useContext(Ctx);
}

export function useDepartureSelection(): DepartureSelection {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error('Component chọn đợt phải nằm trong <DepartureSelectionProvider>');
  }
  return value;
}

export function DepartureSelectionProvider({
  departures,
  children,
}: {
  departures: DepartureVM[];
  children: ReactNode;
}) {
  // Khởi tạo bằng đợt CÒN CHỖ đầu tiên, không phải phần tử [0]: đợt đầu có thể
  // đã hết chỗ, và mở trang ra với một đợt không đặt được là dẫn người dùng vào
  // ngõ cụt ngay từ đầu. Không đợt nào còn chỗ → undefined, rail đổi sang CTA hỏi.
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => departures.find((d) => d.seatsLeft > 0)?.id,
  );
  const [allDatesOpen, setAllDatesOpen] = useState(false);

  const value = useMemo<DepartureSelection>(
    () => ({
      selectedId,
      select: setSelectedId,
      departures,
      allDatesOpen,
      openAllDates: () => setAllDatesOpen(true),
      closeAllDates: () => setAllDatesOpen(false),
    }),
    [selectedId, departures, allDatesOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function DepartureStripConnected({
  currency,
  className,
}: {
  currency: string;
  className?: string;
}) {
  const { departures, selectedId, select } = useDepartureSelection();
  return (
    <DepartureStrip
      departures={departures}
      currency={currency}
      selectedId={selectedId}
      onSelect={select}
      className={className}
    />
  );
}

export function BookingRailConnected({
  slug,
  currency,
  basePrice,
  durationDays,
  maxGroupSize,
  variant,
}: {
  slug: string;
  currency: string;
  basePrice: string;
  durationDays: number;
  maxGroupSize: number;
  variant: 'rail' | 'bar';
}) {
  const { departures, selectedId } = useDepartureSelection();
  const departure = departures.find((d) => d.id === selectedId);
  return (
    <BookingRail
      slug={slug}
      departure={departure}
      currency={currency}
      basePrice={basePrice}
      durationDays={durationDays}
      maxGroupSize={maxGroupSize}
      variant={variant}
    />
  );
}
