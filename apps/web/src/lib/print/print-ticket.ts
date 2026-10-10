import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { DocStampTone } from '@tourism/ui/components/print-doc/doc-stamp';
import { type BookingViewTone, vietnamDay } from '@/lib/booking-vm';
import cloudinaryLoader from '@/lib/cloudinary-loader';
import { calendarDateParts, formatDate, formatTicketDate } from '@/lib/tours';

/**
 * Kiểu và helper dùng chung của tài liệu in khách (G40, spec §3–§4): tấm vé có cuống của voucher
 * (5b) và tấm vé "chờ" của hoá đơn (B1) là MỘT hình, khác tông. View-model ghép sẵn mọi chuỗi;
 * component chỉ vẽ.
 */
export type PrintTicketTone = 'active' | 'pending' | 'closed';

export interface PrintTicketDate {
  big: string;
  sub: string;
}

export interface PrintTicketCell {
  label: string;
  value: string;
}

export interface PrintTicketStub {
  band: string;
  tag: string | null;
  amountLabel: string | null;
  amount: string;
  note: string;
  /** Mã để vẽ mã vạch và in bên dưới; `null` là không mã vạch (đơn chưa trả, đã đi, đã huỷ). */
  barcode: string | null;
  footer: { label: string; value: string | null } | null;
}

export interface PrintTicketView {
  tone: PrintTicketTone;
  bandStart: string;
  bandEnd: string;
  title: string;
  stamp: { label: string; tone: DocStampTone };
  departs: PrintTicketDate;
  returns: PrintTicketDate;
  routeLine: string;
  cells: PrintTicketCell[];
  stub: PrintTicketStub;
  /** Dải hết hiệu lực thay thân vé (voucher đã huỷ); `null` là vé còn thân. */
  notice: string | null;
}

/**
 * Một cột của dải cuối. Cột thường: phần đậm (điểm hẹn) rồi phần thường, nối " · ". Cột mã đơn
 * (`reference`): mã mono ở dòng riêng, dòng phụ mờ bên dưới.
 */
export interface PrintColumn {
  heading: string;
  strong: string | null;
  text: string | null;
  reference: boolean;
}

/** Danh sách đã cắt cho vừa một trang: các mục giữ lại và dòng "more" (nếu cắt). */
export interface PrintList<T = string> {
  items: T[];
  more: string | null;
}

export interface PrintPhoto {
  url: string;
  alt: string;
}

/** Bề rộng ảnh bìa xin Cloudinary: đủ nét cho 180 mm in, không nặng hơn cần (spec §12). */
const PRINT_PHOTO_WIDTH = 1400;

/** Tông mộc in (quyết định 5 của plan): xanh lá `success` đổi sang teal — G32. */
export function stampTone(tone: BookingViewTone): DocStampTone {
  switch (tone) {
    case 'success':
      return 'confirmed';
    case 'warning':
      return 'pending';
    case 'muted':
    case 'destructive':
      return 'muted';
  }
}

/** Ngày lớn "29 OCT" và dòng phụ "Thu · 2026" (thêm "· meet 15:30" khi có giờ hẹn). */
export function ticketDate(date: string, extra: string | null = null): PrintTicketDate {
  const { weekday, year } = calendarDateParts(date);
  const sub = `${weekday} · ${year}`;
  return { big: formatTicketDate(date), sub: extra === null ? sub : `${sub} · ${extra}` };
}

/** Bốn ô của vé: ba ô chung, ô cuối do nơi gọi (Paid with của voucher, Payment của hoá đơn). */
export function ticketCells(
  booking: Pick<Booking, 'contactName' | 'numAdults' | 'numChildren' | 'createdAt'>,
  last: PrintTicketCell,
): PrintTicketCell[] {
  return [
    { label: messages.bookingDetail.leadTraveller, value: booking.contactName },
    {
      label: messages.passportVisa.labels.travellers,
      value: messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
    },
    { label: messages.bookingDetail.booked, value: formatDate(vietnamDay(booking.createdAt)) },
    last,
  ];
}

export function printPhoto(image: Booking['tourImage']): PrintPhoto | null {
  if (image === null) return null;
  return {
    url: cloudinaryLoader({ src: image.url, width: PRINT_PHOTO_WIDTH }),
    alt: image.alt ?? '',
  };
}

/**
 * Luật cắt chung của bản in (spec §3.4): tối đa `max` dòng; hơn thì `max − 1` mục và một dòng
 * "more" — tổng số dòng không bao giờ vượt `max`. Rỗng thì `null`: bỏ cả khối, không in tiêu đề
 * trên một danh sách trống.
 */
export function capList<T>(
  items: T[],
  max: number,
  more: (n: number) => string,
): PrintList<T> | null {
  if (items.length === 0) return null;
  if (items.length <= max) return { items, more: null };
  const keep = max - 1;
  return { items: items.slice(0, keep), more: more(items.length - keep) };
}

export function textColumn(heading: string, text: string): PrintColumn {
  return { heading, strong: null, text, reference: false };
}

/** Cột "Booking reference": mã đơn và một dòng phụ tuỳ chọn ("Booked by …"). */
export function referenceColumn(code: string, sub: string | null): PrintColumn {
  return { heading: messages.booking.success.refLabel, strong: code, text: sub, reference: true };
}
