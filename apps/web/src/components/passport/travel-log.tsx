'use client';

import { messages } from '@tourism/i18n';
import { Badge } from '@tourism/ui/components/badge';
import { Button } from '@tourism/ui/components/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@tourism/ui/components/collapsible';
import { Frame, FrameHeader, FramePanel } from '@tourism/ui/components/reui/frame';
import { Scrollspy } from '@tourism/ui/components/reui/scrollspy';
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@tourism/ui/components/reui/timeline';
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react';
import Link from 'next/link';
import { RevealItem } from '@/components/motion/reveal-item';
import { STAGGER } from '@/lib/motion';
import type { TravelLogEntry, TravelLogTrip } from '@/lib/passport';

/**
 * SỔ HÀNH TRÌNH — bản TIMELINE (vòng 11/08 tối, user phát hiện tổ hợp
 * scrollspy-dọc + timeline-pipeline hợp hơn stepper và duyệt phân tích):
 *
 * - TRÁI: cột nút Scrollspy DỰNG DỌC (sticky) theo tên địa danh.
 * - PHẢI: mỗi địa danh một section = ảnh cover + tên + TIMELINE dọc các
 *   chuyến ở nơi đó — node check mực đầy = lần ĐÃ đi (tháng kết thúc),
 *   node tròn rỗng "pending" cuối = chuyến SẮP tới (tháng khởi hành);
 *   `defaultValue = số lần đã đi` nên timeline tự chia hai trạng thái.
 *   Mỗi node kèm card Frame xổ được (Collapsible): mã booking + meta +
 *   link về trang booking.
 *
 * MỘT dòng chảy cuộn duy nhất — stepper + logic reset của bản trước nghỉ
 * hưu (component stepper vẫn ở lib UI dùng chung). Dữ liệu tính thuần ở
 * server (`travelLog`), props serialize được.
 */

export interface TravelLogEntryWithCover extends TravelLogEntry {
  cover: { url: string; alt: string | null } | null;
}

export function TravelLog({ entries }: { entries: TravelLogEntryWithCover[] }) {
  const t = messages.passportHome;
  return (
    <div className="grid gap-8 lg:grid-cols-[10rem_minmax(0,1fr)]">
      {/* ── Nav địa danh dựng dọc — sticky khi đủ rộng ── */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        {/* KHÔNG targetRef: scrollspy bám cuộn của WINDOW — bản đầu dùng
            ScrollArea lồng trong trang, hai thanh cuộn tranh wheel nên trong
            timeline chỉ kéo tay được (user bắt 11/08); một ngữ cảnh cuộn
            duy nhất thì chuột/trackpad chạy tự nhiên. */}
        <Scrollspy
          offset={120}
          className="flex flex-row flex-wrap gap-2 lg:flex-col lg:items-stretch"
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
      </div>

      {/* ── Section địa danh + timeline các chuyến — chảy theo trang ── */}
      <div className="min-w-0">
        {/* pl-2: indicator/đường nối của timeline neo âm về mép trái. */}
        <div className="space-y-12 pl-2">
          {entries.map((e, index) => (
            // Mỗi năm/địa danh của nhật ký trồi lên theo bậc thang khi cuộn tới
            // (nhóm motion 3, 19/08); `section` giữ `id` cho Scrollspy.
            <RevealItem key={e.slug} enter="rise" delay={Math.min(index, 3) * STAGGER.grid}>
              <section id={`log-${e.slug}`}>
                {e.cover ? (
                  // biome-ignore lint/performance/noImgElement: repo không dùng next/image (chưa cấu hình remotePatterns — tiền lệ trip-card/checkout-summary).
                  <img
                    src={e.cover.url}
                    alt={e.cover.alt ?? ''}
                    className="h-40 w-full rounded-2xl border border-border object-cover"
                  />
                ) : (
                  <div aria-hidden="true" className="h-40 w-full rounded-2xl bg-muted" />
                )}
                <div className="mt-2.5 mb-5 flex items-baseline justify-between gap-3">
                  <h3 className="font-heading text-lg font-semibold">{e.name}</h3>
                  <p className="text-xs whitespace-nowrap text-muted-foreground">
                    {t.travelLogVisits(e.visits)}
                    {e.lastMonth ? ` · ${e.lastMonth}` : ''}
                  </p>
                </div>
                <Timeline defaultValue={e.trips.length}>
                  {[...e.trips, ...e.upcoming].map((trip, index) => (
                    <VisitNode
                      key={trip.code}
                      trip={trip}
                      step={index + 1}
                      done={index < e.trips.length}
                    />
                  ))}
                </Timeline>
              </section>
            </RevealItem>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Một node timeline = một chuyến — check mực khi đã đi, tròn rỗng khi chờ.
 *
 * `ms-10` phải mang ĐÚNG variant dọc của class gốc (`ms-8` có variant) —
 * không thì tailwind-merge giữ cả hai và thứ tự stylesheet quyết định,
 * margin có thể tụt về 32px làm indicator (-left-7, size-6) tràn âm khỏi
 * khối và bị viewport ScrollArea cắt mất nửa (user bắt 11/08).
 */
function VisitNode({ trip, step, done }: { trip: TravelLogTrip; step: number; done: boolean }) {
  const t = messages.passportHome;
  return (
    <TimelineItem
      step={step}
      className="pb-8 last:pb-0 group-data-[orientation=vertical]/timeline:ms-10"
    >
      <TimelineHeader>
        <TimelineSeparator className="group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
        <div className="flex flex-wrap items-center gap-2">
          <TimelineTitle className="text-sm font-semibold">{trip.tourTitle}</TimelineTitle>
          <Badge variant="outline" className={done ? '' : 'text-muted-foreground'}>
            {t.tripDuration(trip.month, trip.days)}
          </Badge>
        </div>
        <TimelineIndicator className="flex size-6 items-center justify-center border-none bg-muted text-muted-foreground group-data-completed/timeline-item:bg-primary group-data-completed/timeline-item:text-primary-foreground group-data-[orientation=vertical]/timeline:-left-7">
          {done ? <CheckIcon className="size-3.5" /> : <CircleIcon className="size-3.5" />}
        </TimelineIndicator>
      </TimelineHeader>
      <TimelineContent className="mt-2">
        <Frame stacked dense spacing="sm">
          <Collapsible className="group/collapsible">
            <CollapsibleTrigger className="flex w-full cursor-pointer">
              <FrameHeader className="flex grow flex-row items-center justify-between gap-2">
                <span className="font-mono text-xs tracking-[0.06em] text-muted-foreground">
                  {trip.code}
                </span>
                <ChevronRightIcon className="size-4 text-muted-foreground transition-transform duration-200 group-data-open/collapsible:rotate-90" />
              </FrameHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <FramePanel>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t.tripMeta(trip.destName, trip.month, trip.days)}
                </p>
                <Link
                  href={`/account/bookings/${trip.code}`}
                  className="mt-1.5 inline-block text-[13px] font-semibold text-primary-emphasis hover:underline"
                >
                  {t.viewBooking}
                </Link>
              </FramePanel>
            </CollapsibleContent>
          </Collapsible>
        </Frame>
      </TimelineContent>
    </TimelineItem>
  );
}
