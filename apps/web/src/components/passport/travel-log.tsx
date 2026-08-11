'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Frame, FramePanel } from '@tourism/ui/components/reui/frame';
import { IconTile } from '@tourism/ui/components/reui/icon-tile';
import { Scrollspy } from '@tourism/ui/components/reui/scrollspy';
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@tourism/ui/components/reui/stepper';
import { ScrollArea } from '@tourism/ui/components/scroll-area';
import { CheckIcon, MapPinIcon } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import type { TravelLogEntry } from '@/lib/passport';

/**
 * SỔ HÀNH TRÌNH (vòng ReUI 11/08, bản stepper — user duyệt phân tích):
 *
 * - TRÁI: nav Scrollspy (nút theo tên địa danh ĐÃ ĐI) + vùng cuộn các
 *   section ảnh cover + tên. Scrollspy `onUpdate` là SỢI STATE nối hai cột:
 *   bấm nút hay cuộn tay đều đẩy `activeSlug` sang phải.
 * - PHẢI: STEPPER DỌC các lần đã đi NƠI ĐANG CHỌN — đi 3 lần là 3 step
 *   (lần 1 → lần n, đường nối chạy dần xuống); panel dưới là card
 *   Frame + IconTile của lần đang chọn; Previous/Next lật qua các lần.
 *   `key={activeSlug}` remount stepper → đổi nơi là bộ step RESET về lần 1
 *   theo đúng số lần đã đi nơi mới (hành vi user mô tả).
 *
 * Client component vì Scrollspy/Stepper cần state + observer; dữ liệu tính
 * thuần ở server (`travelLog`), props serialize được.
 */

export interface TravelLogEntryWithCover extends TravelLogEntry {
  cover: { url: string; alt: string | null } | null;
}

export function TravelLog({ entries }: { entries: TravelLogEntryWithCover[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [activeSlug, setActiveSlug] = useState(entries[0]?.slug);
  const t = messages.passportHome;
  const active = entries.find((e) => e.slug === activeSlug) ?? entries[0];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      {/* ── Trái: địa danh đã đi ── */}
      <div className="min-w-0 space-y-4">
        <Scrollspy
          offset={40}
          targetRef={parentRef}
          onUpdate={(id) => setActiveSlug(id.replace(/^log-/, ''))}
          className="flex flex-wrap gap-2"
        >
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

      {/* ── Phải: stepper các lần đã đi nơi đang chọn ── */}
      {active ? (
        <div className="min-w-0">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">
            {t.pastTripsHeading} · {active.name}
          </h3>
          <VisitStepper key={active.slug} entry={active} />
        </div>
      ) : null}
    </div>
  );
}

/** Stepper dọc một địa danh — tách component để `key` remount là reset gọn. */
function VisitStepper({ entry }: { entry: TravelLogEntryWithCover }) {
  const [step, setStep] = useState(1);
  const t = messages.passportHome;
  return (
    <Stepper
      value={step}
      onValueChange={setStep}
      orientation="vertical"
      indicators={{ completed: <CheckIcon className="size-3.5" /> }}
      className="space-y-6"
    >
      <StepperNav className="gap-0">
        {entry.trips.map((trip, index) => (
          <StepperItem key={trip.code} step={index + 1} className="items-start not-last:flex-none">
            <StepperTrigger className="flex items-start justify-start gap-3 text-start">
              <StepperIndicator className="size-8 border-2 data-[state=completed]:bg-success data-[state=completed]:text-white data-[state=inactive]:border-border data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground">
                {index + 1}
              </StepperIndicator>
              <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                <div className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  {t.visitStep(index + 1)}
                </div>
                <StepperTitle className="truncate text-sm font-semibold group-data-[state=inactive]/step:text-muted-foreground">
                  {trip.tourTitle}
                </StepperTitle>
              </div>
            </StepperTrigger>
            {/* Đường nối dọc dưới indicator — xanh dần theo các lần đã xem qua. */}
            {index < entry.trips.length - 1 ? (
              <StepperSeparator className="ms-[15px] h-6 self-start group-data-[state=completed]/step:bg-success" />
            ) : null}
          </StepperItem>
        ))}
      </StepperNav>

      <StepperPanel>
        {entry.trips.map((trip, index) => (
          <StepperContent key={trip.code} value={index + 1}>
            <Frame className="w-full">
              <FramePanel className="flex items-start gap-3">
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
            </Frame>
          </StepperContent>
        ))}
      </StepperPanel>

      {entry.trips.length > 1 ? (
        <div className="flex items-center justify-between gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep((prev) => prev - 1)}
            disabled={step === 1}
          >
            {t.visitPrev}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep((prev) => prev + 1)}
            disabled={step === entry.trips.length}
          >
            {t.visitNext}
          </Button>
        </div>
      ) : null}
    </Stepper>
  );
}
