'use client';

import { PAYMENT_EVENT_TYPES, PaymentEventTypeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  CircleCheckIcon,
  CircleQuestionMarkIcon,
  CircleXIcon,
  ShapesIcon,
  TagsIcon,
  TimerOffIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL, fromFreeValue, toFreeValue } from '@/components/kit/filter-value';
import {
  ToolbarFilterMenu,
  type ToolbarFilterMenuGroup,
} from '@/components/kit/toolbar-filter-menu';
import { type PaymentEventsQuery, paymentEventsHref } from '@/lib/payment-events-query';

/**
 * Lọc theo type của `/payment-events` — kit `ToolbarFilterMenu`.
 *
 * HAI thứ RIÊNG của vùng, kit không lo hộ:
 *
 * 1. Tiền tố `v:` (`toFreeValue`) — cột DB là chuỗi tự do nên một hàng
 *    `type = 'ALL'` sẽ trùng sentinel của kit nếu đi thẳng.
 * 2. Mục TẠM cho type ngoài tuple — một `?type=` lạ vẫn lọc thật ở API, nên
 *    menu phải HIỆN đúng giá trị đó thay vì rơi về "All types" trong khi bảng
 *    đang lọc theo thứ khác. Kit quyết chỗ đứng của nó (`unknownItem`).
 *
 * Icon né hết bộ đang có trên trang này: tab provider (list/credit-card/
 * wallet), toggle Unprocessed (circle-dashed) và menu Columns (tag/banknote/
 * ticket/calendar) — cùng một hàng mà một icon mang hai nghĩa là mời đọc nhầm.
 */
const t = messages.admin.paymentEvents;

/**
 * Icon theo type — `Record` trên tuple contract để thêm một type mà quên khai
 * là đỏ ở typecheck.
 */
const TYPE_ICONS: Record<(typeof PAYMENT_EVENT_TYPES)[number], typeof CircleCheckIcon> = {
  'payment.completed': CircleCheckIcon,
  'payment.failed': CircleXIcon,
  // Hết hạn chứ không phải hỏng: đồng hồ tắt, không phải chữ X.
  'payment.expired': TimerOffIcon,
  other: ShapesIcon,
};

const KNOWN_GROUP: ToolbarFilterMenuGroup = {
  key: 'known',
  items: PAYMENT_EVENT_TYPES.map((type) => ({
    label: t.type[type],
    value: toFreeValue(type),
    icon: TYPE_ICONS[type],
  })),
};

/** Mục "tất cả": nhiều thẻ chồng nhau — cả trục type, chưa lọc là mọi type. */
const ALL_ITEM = { value: ALL, label: t.list.typeAll, icon: TagsIcon };

export function PaymentEventsTypeMenu({ query }: { query: PaymentEventsQuery }) {
  const router = useRouter();
  const unknown =
    query.type !== undefined && !PaymentEventTypeSchema.safeParse(query.type).success
      ? query.type
      : null;

  return (
    <ToolbarFilterMenu
      label={t.list.typeLabel}
      value={query.type === undefined ? ALL : toFreeValue(query.type)}
      allItem={ALL_ITEM}
      // Chỗ đứng của mục lạ (cuối, dưới một separator) là việc của kit; vùng
      // chỉ nói KHI NÀO có một cái và dấu chấm hỏi cho nó — nó không đến từ
      // tập gateway biết, và icon nói đúng điều đó.
      unknownItem={
        unknown
          ? { label: unknown, value: toFreeValue(unknown), icon: CircleQuestionMarkIcon }
          : undefined
      }
      groups={[KNOWN_GROUP]}
      onSelect={(next) => router.push(paymentEventsHref(query, { type: fromFreeValue(next) }))}
    />
  );
}
