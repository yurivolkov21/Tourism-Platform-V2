'use client';

import { EmailTypeSchema, type EmailTypeValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  BellRingIcon,
  CircleDashedIcon,
  KeyRoundIcon,
  MailCheckIcon,
  MailIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PenLineIcon,
  RectangleEllipsisIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  StarIcon,
  TicketIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ALL_FILTER_VALUE as ALL } from '@/components/kit/filter-value';
import {
  ToolbarFilterMenu,
  type ToolbarFilterMenuGroup,
} from '@/components/kit/toolbar-filter-menu';
import { type OutboxQuery, outboxHref } from '@/lib/outbox-query';

/**
 * Lọc theo loại email của `/outbox` — kit `ToolbarFilterMenu` (khuôn
 * `dropdown-menu-10`, user chốt 03/09).
 *
 * Vì sao vùng này rời kit `ToolbarSelect`: 13 loại email + mục "All" là danh
 * sách DÀI NHẤT trong cả admin, và chúng chia đúng năm họ — thứ một Select
 * phẳng không nói ra được. Vùng chỉ giữ phần kiến thức RIÊNG của nó (loại nào
 * thuộc họ nào, icon gì); hình dạng menu nằm ở kit để ba vùng cùng đổi.
 */
const t = messages.admin.outbox;

/** Năm họ email, theo thứ tự operator quét từ trên xuống. */
const FAMILY_ORDER = ['booking', 'cancellation', 'enquiry', 'reach', 'account'] as const;
type Family = (typeof FAMILY_ORDER)[number];

/**
 * Họ + icon của TỪNG loại email — nguồn DUY NHẤT cho cả hai việc. `Record` đủ
 * member nên thêm một loại vào enum contract mà quên khai ở đây là đỏ ngay ở
 * typecheck (cùng nếp `STATUS_ICONS` của `outbox-toolbar`).
 *
 * HAI luật chọn icon ở đây, theo thứ tự:
 *
 * 1. Ưu tiên glyph dự án ĐÃ dùng cho đúng khái niệm đó (user chốt 03/09):
 *    `TicketIcon` là booking (user-menu web, cột bookingCode), `RotateCcwIcon`
 *    là REFUNDED (tab bookings), `CircleDashedIcon` là "chưa xử lý" (tab
 *    enquiries), `ShieldCheck`/`ShieldX` là duyệt/từ chối (`decision-button`),
 *    `MessageSquareIcon` là enquiry, `StarIcon` là review, `PenLineIcon` là
 *    sửa. Chỉ khi dự án CHƯA có glyph nào cho khái niệm ấy mới lấy glyph mới
 *    của lucide (bell-ring · megaphone · key-round · rectangle-ellipsis).
 * 2. Né bộ của tab trạng thái đứng ngay bên trái (list/clock/circle-check/
 *    circle-x/ban) và cột `recipient` của menu Columns (at-sign): trong cùng
 *    một hàng điều khiển, một icon dùng cho hai nghĩa là mời đọc nhầm.
 */
const TYPE_META: Record<EmailTypeValue, { family: Family; icon: typeof MailIcon }> = {
  BOOKING_CONFIRMATION: { family: 'booking', icon: TicketIcon },
  BOOKING_REFUNDED: { family: 'booking', icon: RotateCcwIcon },
  CANCELLATION_REQUESTED: { family: 'cancellation', icon: CircleDashedIcon },
  CANCELLATION_APPROVED: { family: 'cancellation', icon: ShieldCheckIcon },
  CANCELLATION_DENIED: { family: 'cancellation', icon: ShieldXIcon },
  ENQUIRY_RECEIVED: { family: 'enquiry', icon: MessageSquareIcon },
  // Thư duy nhất gửi cho ĐỘI, không cho khách — chuông chứ không phải bong bóng.
  ENQUIRY_ADMIN_ALERT: { family: 'enquiry', icon: BellRingIcon },
  REVIEW_APPROVED: { family: 'reach', icon: StarIcon },
  NEWSLETTER_WELCOME: { family: 'reach', icon: MegaphoneIcon },
  EMAIL_CHANGED: { family: 'account', icon: PenLineIcon },
  PASSWORD_RESET: { family: 'account', icon: KeyRoundIcon },
  EMAIL_VERIFICATION: { family: 'account', icon: MailCheckIcon },
  EMAIL_OTP: { family: 'account', icon: RectangleEllipsisIcon },
};

/**
 * Nhóm dựng TỪ `TYPE_META` chứ không phải một danh sách thứ hai chép tay —
 * hai danh sách là hai cơ hội để lệch nhau. Thứ tự trong mỗi họ theo enum
 * contract (requested → approved → denied đọc đúng dòng đời của nó).
 *
 * `.filter` cuối chặn một họ khai trong `FAMILY_ORDER` mà chưa có thành viên
 * nào: nhóm rỗng sẽ vẽ ra một separator mồ côi.
 */
const TYPE_GROUPS: ToolbarFilterMenuGroup[] = FAMILY_ORDER.map((family) => ({
  key: family,
  items: EmailTypeSchema.options
    .filter((type) => TYPE_META[type].family === family)
    .map((type) => ({ value: type, label: t.type[type], icon: TYPE_META[type].icon })),
})).filter((group) => group.items.length > 0);

/** Mục "tất cả": phong bì trơn — cả menu nói về email, chưa lọc là mọi loại. */
const ALL_ITEM = { value: ALL, label: t.list.typeAll, icon: MailIcon };

export function OutboxTypeMenu({ query }: { query: OutboxQuery }) {
  const router = useRouter();

  function go(next: string) {
    // `safeParse` chứ không `parse`: value lạ rơi êm về "All" thay vì ném
    // ZodError giữa event handler (nếp bookings, review F1).
    const parsed = EmailTypeSchema.safeParse(next);
    router.push(outboxHref(query, { type: parsed.success ? parsed.data : null }));
  }

  return (
    <ToolbarFilterMenu
      label={t.list.typeLabel}
      value={query.type ?? ALL}
      allItem={ALL_ITEM}
      groups={TYPE_GROUPS}
      onSelect={go}
    />
  );
}
