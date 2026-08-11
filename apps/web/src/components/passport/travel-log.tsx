'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Frame, FramePanel } from '@tourism/ui/components/reui/frame';
import { IconTile } from '@tourism/ui/components/reui/icon-tile';
import { Scrollspy } from '@tourism/ui/components/reui/scrollspy';
import { ScrollArea } from '@tourism/ui/components/scroll-area';
import { MapPinIcon } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import type { TravelLogEntry, TravelLogTrip } from '@/lib/passport';

/**
 * SỔ HÀNH TRÌNH (vòng ReUI 11/08 — user chỉ định pattern Scrollspy +
 * Frame/IconTile của reui.io, đã vendor vào `@tourism/ui/components/reui/*`
 * bản Base UI):
 *
 * - TRÁI: nav Scrollspy (nút theo tên địa danh ĐÃ ĐI) + vùng cuộn các
 *   section ảnh cover + tên — bấm nút cuộn mượt tới nơi, cuộn tay thì nút
 *   tự sáng theo section đang hiện.
 * - PHẢI: cột "các lần đã đi" — mỗi CHUYẾN một FramePanel (IconTile + tên
 *   tour link về trang visa + dòng meta nơi · tháng · số ngày).
 *
 * Client component vì Scrollspy cần ref + observer; dữ liệu đã tính thuần
 * ở server (`travelLog`/`pastTrips`), props serialize được.
 */

export interface TravelLogEntryWithCover extends TravelLogEntry {
  cover: { url: string; alt: string | null } | null;
}

export function TravelLog({
  entries,
  trips,
}: {
  entries: TravelLogEntryWithCover[];
  trips: TravelLogTrip[];
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const t = messages.passportHome;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {/* ── Trái: địa danh đã đi ── */}
      <div className="min-w-0 space-y-4">
        <Scrollspy offset={40} targetRef={parentRef} className="flex flex-wrap gap-2">
          {entries.map((e) => (
            <Button
              key={e.slug}
              variant="outline"
              size="sm"
              data-scrollspy-anchor={`log-${e.slug}`}
              className="data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
            >
              {e.name}
            </Button>
          ))}
        </Scrollspy>
        <div ref={parentRef}>
          {/* Một nơi thì chưa có gì để cuộn — thả chiều cao tự nhiên. */}
          <ScrollArea className={entries.length > 1 ? 'h-[440px]' : ''}>
            <div className="space-y-7 pr-3">
              {entries.map((e) => (
                <section key={e.slug} id={`log-${e.slug}`} className="space-y-2.5">
                  {e.cover ? (
                    // biome-ignore lint/performance/noImgElement: repo không dùng next/image (chưa cấu hình remotePatterns — tiền lệ trip-card/checkout-summary).
                    <img
                      src={e.cover.url}
                      alt={e.cover.alt ?? ''}
                      className="h-44 w-full rounded-2xl border border-border object-cover"
                    />
                  ) : (
                    <div aria-hidden="true" className="h-44 w-full rounded-2xl bg-muted" />
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-heading text-lg font-semibold">{e.name}</h3>
                    <p className="text-xs whitespace-nowrap text-muted-foreground">
                      {t.travelLogVisits(e.visits)} · {e.lastMonth}
                    </p>
                  </div>
                </section>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ── Phải: các lần đã đi ── */}
      <div className="min-w-0">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t.pastTripsHeading}</h3>
        <Frame className="w-full">
          {trips.map((trip) => (
            <FramePanel key={trip.code} className="flex items-start gap-3">
              <IconTile variant="elevated" size="lg" aria-hidden="true">
                <MapPinIcon />
              </IconTile>
              <div className="flex min-w-0 flex-col gap-1">
                <h4 className="truncate text-sm font-medium">
                  <Link
                    href={`/account/bookings/${trip.code}`}
                    className="hover:text-primary-emphasis hover:underline"
                  >
                    {trip.tourTitle}
                  </Link>
                </h4>
                <p className="text-xs text-muted-foreground">
                  {t.tripMeta(trip.destName, trip.month, trip.days)}
                </p>
              </div>
            </FramePanel>
          ))}
        </Frame>
      </div>
    </div>
  );
}
