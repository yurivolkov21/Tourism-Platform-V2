import type { BookingCancellation } from '@tourism/contract';
import { describe, expect, it } from 'vitest';
import { makeBooking } from '@/test/fixtures/booking';
import {
  type BookingTourData,
  getReadySteps,
  prepStorageKey,
  readPrepChecked,
  tourMeetingPoint,
} from './get-ready';

/**
 * Khối "Get ready" của đơn sắp đi (spec P7 §2.4). Chuyến 3 ngày 03–05/11: ngày đi và ngày về
 * khác nhau để bắt chỗ lấy nhầm mốc; hôm nay 05/10 — còn 29 ngày.
 */
const TODAY = '2026-10-05';

function cancellationOf(overrides: Partial<BookingCancellation> = {}): BookingCancellation {
  return {
    deadline: '2026-10-31',
    withinDeadline: true,
    refundAmount: '147.00',
    canCancel: true,
    ...overrides,
  };
}

const BOOKING = makeBooking({
  code: 'BK-B6VCOQNW',
  tourSlug: 'hanoi-heritage-day',
  tourDestinations: [{ slug: 'ha-noi', name: 'Hà Nội', isPrimary: true }],
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
  cancellation: cancellationOf(),
});

const DAY_ONE = [
  '08:00 — Hotel pickup, drive to Ba Đình Square',
  '08:30 — Hồ Chí Minh Mausoleum exterior',
].join('\n');
const DAY_TWO = { dayNumber: 2, title: 'Ninh Bình by boat', description: '07:00 — Depart' };

/** Ngày 2 đứng TRƯỚC ngày 1 trong mảng: bước "Day 1" phải tìm theo `dayNumber`. */
const TOUR: BookingTourData = {
  excluded: ['Lunch (own arrangement)', 'Tips', 'Personal expenses'],
  meetingPoint: 'Hotel pickup — hotels in Hoàn Kiếm, Ba Đình or Tây Hồ districts, Hà Nội',
  itinerary: [DAY_TWO, { dayNumber: 1, title: 'Ba Đình to the Old Quarter', description: DAY_ONE }],
};

const steps = (tour: BookingTourData | null, booking = BOOKING) =>
  getReadySteps(booking, tour, TODAY).steps.map((step) => `${step.number} ${step.key}`);

describe('getReadySteps — các bước (spec §2.4)', () => {
  it('đủ dữ liệu: bốn bước, đánh số 01–04', () => {
    expect(steps(TOUR)).toEqual(['01 freeCancellation', '02 budget', '03 pickup', '04 dayOne']);
  });

  it('nội dung từng bước', () => {
    const [cancel, budget, pickup, dayOne] = getReadySteps(BOOKING, TOUR, TODAY).steps;
    expect(cancel).toEqual({
      key: 'freeCancellation',
      number: '01',
      title: 'Free cancellation',
      text: 'Free cancellation until 31 Oct, 11:59 pm Vietnam time. No refund after that.',
      open: true,
    });
    expect(budget).toEqual({
      key: 'budget',
      number: '02',
      title: 'Budget for what’s not included',
      items: ['Lunch (own arrangement)', 'Tips', 'Personal expenses'],
      note: 'Tick them off — saved on this device.',
    });
    expect(pickup).toEqual({
      key: 'pickup',
      number: '03',
      title: 'Pickup on Tue 3 Nov',
      text: 'Hotel pickup — hotels in Hoàn Kiếm, Ba Đình or Tây Hồ districts, Hà Nội',
    });
    expect(dayOne).toEqual({
      key: 'dayOne',
      number: '04',
      title: 'Day 1 · Ba Đình to the Old Quarter',
      text: DAY_ONE,
      href: '/tours/hanoi-heritage-day#itinerary',
      linkLabel: 'Full itinerary',
    });
  });

  it('tour đã gỡ (null): chỉ còn bước hạn huỷ', () => {
    expect(steps(null)).toEqual(['01 freeCancellation']);
  });

  it('bỏ bước thiếu dữ liệu thì các bước sau đánh số lại', () => {
    expect(steps({ ...TOUR, excluded: [] })).toEqual([
      '01 freeCancellation',
      '02 pickup',
      '03 dayOne',
    ]);
    expect(steps({ ...TOUR, meetingPoint: '   ' })).toEqual([
      '01 freeCancellation',
      '02 budget',
      '03 dayOne',
    ]);
    expect(steps({ ...TOUR, itinerary: [DAY_TWO] })).toEqual([
      '01 freeCancellation',
      '02 budget',
      '03 pickup',
    ]);
  });

  it('không có cờ huỷ của server thì không bịa câu hạn huỷ', () => {
    expect(steps(TOUR, { ...BOOKING, cancellation: null })).toEqual([
      '01 budget',
      '02 pickup',
      '03 dayOne',
    ]);
  });

  it('mục trống và mục trùng trong danh sách không gồm bị bỏ', () => {
    const view = getReadySteps(
      BOOKING,
      { ...TOUR, excluded: ['Tips', ' ', 'Tips', 'Drinks'] },
      TODAY,
    );
    expect(view.steps.find((step) => step.key === 'budget')).toMatchObject({
      items: ['Tips', 'Drinks'],
    });
  });

  it('đã qua hạn huỷ: câu "đã qua" và bước không còn nổi', () => {
    const view = getReadySteps(
      { ...BOOKING, cancellation: cancellationOf({ withinDeadline: false, refundAmount: '0.00' }) },
      TOUR,
      TODAY,
    );
    expect(view.steps[0]).toMatchObject({
      text: 'The free-cancellation deadline (31 Oct) has passed.',
      open: false,
    });
  });

  it('ngày 1 không có mô tả: vẫn có bước, chỉ không có khối chữ', () => {
    const view = getReadySteps(
      BOOKING,
      { ...TOUR, itinerary: [{ dayNumber: 1, title: 'Arrival', description: null }] },
      TODAY,
    );
    expect(view.steps.at(-1)).toMatchObject({
      key: 'dayOne',
      title: 'Day 1 · Arrival',
      text: null,
    });
  });
});

describe('getReadySteps — đầu và chân khối', () => {
  it('số ngày cỡ lớn, dòng "Departs" có năm và điểm đến, chân nói ngày VỀ', () => {
    const view = getReadySteps(BOOKING, TOUR, TODAY);
    expect(view.countdown).toEqual({ count: 29, label: 'days to go' });
    expect(view.departs).toBe('Departs Tue 3 Nov 2026 · Hà Nội');
    expect(view.footer).toBe('Your review opens after the trip ends on Thu 5 Nov.');
  });

  it('còn đúng một ngày: "Tomorrow" thay cho con số', () => {
    expect(getReadySteps(BOOKING, TOUR, '2026-11-02').countdown).toEqual({
      count: null,
      label: 'Tomorrow',
    });
  });

  it('tour không gắn điểm đến: dòng "Departs" chỉ có ngày', () => {
    expect(getReadySteps({ ...BOOKING, tourDestinations: [] }, TOUR, TODAY).departs).toBe(
      'Departs Tue 3 Nov 2026',
    );
  });
});

describe('tourMeetingPoint', () => {
  it('in nguyên văn; tour gỡ hay ô trống thì null', () => {
    expect(tourMeetingPoint(TOUR)).toBe(TOUR.meetingPoint);
    expect(tourMeetingPoint(null)).toBeNull();
    expect(tourMeetingPoint({ ...TOUR, meetingPoint: '  ' })).toBeNull();
    expect(tourMeetingPoint({ ...TOUR, meetingPoint: null })).toBeNull();
  });
});

describe('ô tích lưu trên máy', () => {
  const ITEMS = ['Lunch (own arrangement)', 'Tips', 'Personal expenses'];

  it('khoá theo mã đơn', () => {
    expect(prepStorageKey('BK-B6VCOQNW')).toBe('prep:BK-B6VCOQNW');
  });

  it('giữ thứ tự của danh sách, bỏ mục không còn trong danh sách', () => {
    const raw = JSON.stringify(['Personal expenses', 'Gone item', 'Lunch (own arrangement)']);
    expect(readPrepChecked(raw, ITEMS)).toEqual(['Lunch (own arrangement)', 'Personal expenses']);
  });

  it.each([
    ['chưa lưu gì', null],
    ['JSON hỏng', '{oops'],
    ['không phải mảng', JSON.stringify({ Tips: true })],
  ])('%s → chưa tích gì', (_, raw) => {
    expect(readPrepChecked(raw, ITEMS)).toEqual([]);
  });
});
