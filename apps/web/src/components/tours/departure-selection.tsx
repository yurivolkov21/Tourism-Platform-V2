'use client';

import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';
import { BookingRail } from '@/components/tours/booking-rail';
import { DepartureStrip } from '@/components/tours/departure-strip';
import { DeparturesTable } from '@/components/tours/departures-table';
import type { DepartureVM } from '@/lib/api/tours';

/**
 * Trạng thái "đợt đang chọn" dùng chung cho BA nơi: dải chip dưới hero, bảng đợt
 * giữa trang, rail booking cột phải (+ bar đáy mobile). Một hành động → ba nơi
 * phản hồi (spec §6.3).
 *
 * VÌ SAO LÀ CONTEXT chứ không phải state nâng lên `page.tsx`: ba nơi đó nằm ở ba
 * vị trí khác nhau trong bố cục, và nâng state lên page sẽ buộc cả trang thành
 * client component — mất luôn phần render phía server của itinerary, inclusions,
 * good-to-know. Provider là client, còn `children` truyền vào nó vẫn được server
 * render bình thường.
 *
 * Ba component trình bày (`DepartureStrip`/`DeparturesTable`/`BookingRail`) giữ
 * nguyên dạng NHẬN PROP THUẦN để test được độc lập; các bản `…Connected` dưới đây
 * chỉ làm một việc là nối chúng vào context.
 */
interface DepartureSelection {
  selectedId: string | undefined;
  select: (id: string) => void;
  departures: DepartureVM[];
  /** Mã tiền tệ của TOUR (không phải của đợt — `DepartureVM` không có field
      này). `DepartureDialog` (Task 5) có chữ ký RỖNG PROP, chỉ đọc context, nên
      đây là kênh DUY NHẤT để nó format giá — cùng luật "không hardcode 'USD'"
      đã ghi ở `destinations/[region]/page.tsx`. */
  currency: string;
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
export function useDepartureSelection(): DepartureSelection {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error('Component chọn đợt phải nằm trong <DepartureSelectionProvider>');
  }
  return value;
}

export function DepartureSelectionProvider({
  departures,
  currency,
  children,
}: {
  departures: DepartureVM[];
  currency: string;
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
      currency,
      allDatesOpen,
      openAllDates: () => setAllDatesOpen(true),
      closeAllDates: () => setAllDatesOpen(false),
    }),
    [selectedId, departures, currency, allDatesOpen],
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

export function DeparturesTableConnected({
  currency,
  durationDays,
}: {
  currency: string;
  durationDays: number;
}) {
  const { departures, selectedId, select } = useDepartureSelection();
  return (
    <DeparturesTable
      departures={departures}
      currency={currency}
      durationDays={durationDays}
      selectedId={selectedId}
      onSelect={select}
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
