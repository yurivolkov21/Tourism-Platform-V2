import type { MediaItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  capList,
  printPhoto,
  referenceColumn,
  stampTone,
  textColumn,
  ticketCells,
  ticketDate,
} from './print-ticket';

describe('stampTone — mộc in đổi tông (G32)', () => {
  it('success thành confirmed, warning thành pending, còn lại muted', () => {
    expect(stampTone('success')).toBe('confirmed');
    expect(stampTone('warning')).toBe('pending');
    expect(stampTone('muted')).toBe('muted');
    expect(stampTone('destructive')).toBe('muted');
  });
});

describe('ticketDate — ngày lớn và dòng phụ của vé', () => {
  it('"29 OCT" và "Thu · 2026"', () => {
    expect(ticketDate('2026-10-29')).toEqual({ big: '29 OCT', sub: 'Thu · 2026' });
  });

  it('có giờ hẹn thì nối vào dòng phụ', () => {
    expect(ticketDate('2026-10-29', 'meet 15:30')).toEqual({
      big: '29 OCT',
      sub: 'Thu · 2026 · meet 15:30',
    });
  });
});

describe('ticketCells — bốn ô của vé', () => {
  it('Lead traveller · Travellers · Booked (ngày lịch VN) · ô cuối của nơi gọi', () => {
    const booking = makeBooking({
      contactName: 'Nora Dahl',
      numAdults: 2,
      numChildren: 1,
      createdAt: '2026-10-08T19:30:00.000Z', // 02:30 ngày 9/10 giờ Việt Nam
    });
    expect(ticketCells(booking, { label: 'Payment', value: 'PayPal' })).toEqual([
      { label: messages.bookingDetail.leadTraveller, value: 'Nora Dahl' },
      {
        label: messages.passportVisa.labels.travellers,
        value: messages.accountBookings.travellers(2, 1),
      },
      { label: messages.bookingDetail.booked, value: '9 Oct 2026' },
      { label: 'Payment', value: 'PayPal' },
    ]);
  });
});

describe('capList — tối đa 6 dòng mỗi cột', () => {
  const more = (n: number) => `+${n} more`;
  it('rỗng thì null — bỏ cột', () => {
    expect(capList([], more)).toBeNull();
  });
  it('6 mục giữ nguyên', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(capList(items, more)).toEqual({ items, more: null });
  });
  it('7 mục thì 5 mục và "+2 more"', () => {
    expect(capList(['a', 'b', 'c', 'd', 'e', 'f', 'g'], more)).toEqual({
      items: ['a', 'b', 'c', 'd', 'e'],
      more: '+2 more',
    });
  });
});

describe('cột của dải cuối', () => {
  it('textColumn chỉ có chữ thường; referenceColumn mang mã ở dòng riêng', () => {
    expect(textColumn('Payment', 'Paid.')).toEqual({
      heading: 'Payment',
      strong: null,
      text: 'Paid.',
      reference: false,
    });
    expect(referenceColumn('BK-EET0JBTH', 'Booked by a@b.co')).toEqual({
      heading: messages.booking.success.refLabel,
      strong: 'BK-EET0JBTH',
      text: 'Booked by a@b.co',
      reference: true,
    });
  });
});

describe('printPhoto — ảnh bìa in', () => {
  const IMAGE: MediaItem = {
    publicId: 'tourism/catalog/tour/hoi-an/hero',
    url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/tourism/catalog/tour/hoi-an/hero',
    type: 'IMAGE',
    role: 'hero',
    posterUrl: null,
    width: 1600,
    height: 900,
    alt: 'Lantern street at dusk',
    sortOrder: 0,
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
  };

  it('không ảnh thì null', () => {
    expect(printPhoto(null)).toBeNull();
  });

  it('ảnh Cloudinary xin bề rộng 1400, giữ alt', () => {
    const photo = printPhoto(IMAGE);
    expect(photo?.alt).toBe('Lantern street at dusk');
    expect(photo?.url).toContain('w_1400');
  });

  it('alt trống thì chuỗi rỗng — ảnh trang trí', () => {
    expect(printPhoto({ ...IMAGE, alt: null })?.alt).toBe('');
  });
});
