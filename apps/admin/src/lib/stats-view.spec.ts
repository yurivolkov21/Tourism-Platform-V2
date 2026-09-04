import {
  type AdminBookingsStats,
  type AdminCancellationsStats,
  type AdminEnquiriesStats,
  type AdminOutboxStats,
  type AdminPaymentEventsStats,
  type AdminReviewsStats,
  type AdminSubscribersStats,
  PAYMENT_EVENT_STUCK_MINUTES,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  type StatCardVM,
  toBookingsStatCards,
  toCancellationsStatCards,
  toEnquiriesStatCards,
  toOutboxStatCards,
  toPaymentEventsStatCards,
  toReviewsStatCards,
  toSubscribersStatCards,
} from './stats-view';

/**
 * TDD suite (spec P4b §3-F5, viết TRƯỚC) cho mapper hiển thị stat card. Đây
 * là toàn bộ phần "tính" của client: chọn chiều mũi tên, độ lớn %, và hướng
 * TỐT/XẤU. Cửa sổ thời gian thì KHÔNG — hai con số đã do server trả.
 */

const t = messages.admin.stats;

const period = {
  windowDays: 28,
  currentFrom: '2026-08-04T10:30:00.000Z',
  currentTo: '2026-09-01T10:30:00.000Z',
  previousFrom: '2026-07-07T10:30:00.000Z',
  generatedAt: '2026-09-01T10:30:00.000Z',
};

const BOOKINGS: AdminBookingsStats = {
  period,
  currency: 'USD',
  revenue: { current: '1240.50', previous: '900.00' },
  paidBookings: { current: 12, previous: 9 },
  newBookings: { current: 20, previous: 20 },
  cancellationRate: { current: '8.3', previous: '5.0' },
};

const CANCELLATIONS: AdminCancellationsStats = {
  period,
  pendingQueue: { current: 5, previous: 2 },
  approved: { current: 4, previous: 8 },
  denied: { current: 1, previous: 0 },
};

const REVIEWS: AdminReviewsStats = {
  period,
  pending: { current: 3, previous: 7 },
  approved: { current: 9, previous: 4 },
  averageRating: { current: '4.60', previous: '4.20' },
};

const OUTBOX: AdminOutboxStats = {
  period,
  sent: 40,
  queued: 3,
  failed: 2,
};

const ENQUIRIES: AdminEnquiriesStats = {
  period,
  created: { current: 12, previous: 8 },
  won: { current: 3, previous: 5 },
  open: 7,
};

const SUBSCRIBERS: AdminSubscribersStats = {
  period,
  created: { current: 24, previous: 15 },
  unsubscribed: { current: 6, previous: 4 },
  active: 180,
};

const PAYMENT_EVENTS: AdminPaymentEventsStats = {
  period,
  received: { current: 40, previous: 32 },
  unprocessed: 2,
  stuck: 1,
  linked: { current: 30, previous: 30 },
};

/** Lấy một card theo khoá — test đọc theo tên chứ không theo vị trí mảng. */
function card(cards: StatCardVM[], key: string): StatCardVM {
  const found = cards.find((c) => c.key === key);
  if (!found) throw new Error(`no stat card "${key}" in [${cards.map((c) => c.key).join(', ')}]`);
  return found;
}

describe('toBookingsStatCards', () => {
  it('in tiền theo ĐÚNG đồng tiền server nói đã cộng — client không đoán', () => {
    expect(card(toBookingsStatCards(BOOKINGS), 'revenue').value).toBe('$1,240.50');
  });

  it('caption là con số KỲ TRƯỚC, định dạng cùng kiểu với số lớn', () => {
    expect(card(toBookingsStatCards(BOOKINGS), 'revenue').caption).toBe(
      t.comparison('$900.00', 28),
    );
  });

  it('pill delta mang ĐỘ LỚN phần trăm, chiều nằm ở mũi tên', () => {
    // 12 so với 9 → +33.3%. Con số % là suy ra từ HAI số server trả, không
    // phải từ một cửa sổ thời gian client tự cắt.
    const paid = card(toBookingsStatCards(BOOKINGS), 'paid');
    expect(paid.delta).toEqual({
      direction: 'up',
      amount: '33.3%',
      srLabel: t.trend.up('33.3%'),
    });
    expect(paid.deltaGood).toBe(true);
  });

  it('không đổi → chiều "flat", vẫn có pill để nói rõ là đứng yên', () => {
    const created = card(toBookingsStatCards(BOOKINGS), 'created');
    expect(created.delta?.direction).toBe('flat');
    expect(created.delta?.srLabel).toBe(t.trend.flat);
  });

  it('tỉ lệ huỷ TĂNG là XẤU — hướng tốt/xấu là thuộc tính của metric', () => {
    const rate = card(toBookingsStatCards(BOOKINGS), 'cancellationRate');
    expect(rate.value).toBe('8.3%');
    expect(rate.delta?.direction).toBe('up');
    expect(rate.deltaGood).toBe(false);
  });

  it('đếm lớn có dấu phân cách hàng nghìn', () => {
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      paidBookings: { current: 12_400, previous: 9 },
    });
    expect(card(cards, 'paid').value).toBe('12,400');
  });

  it('kỳ trước bằng 0, kỳ này dương: pill "New" — 0 → N phải CÓ tín hiệu (vòng vá F5)', () => {
    // % so với 0 vẫn không tồn tại, nhưng im lặng thì "hàng đợi 0 → 40"
    // render y hệt "40 → 40" — chuyển động đáng báo nhất bị nuốt.
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      paidBookings: { current: 12, previous: 0 },
    });
    const paid = card(cards, 'paid');
    expect(paid.delta).toEqual({
      direction: 'up',
      amount: t.trend.newLabel,
      srLabel: t.trend.fromZero,
    });
    expect(paid.deltaGood).toBe(true); // up-good: có khách trả tiền là tốt
    expect(paid.caption).toBe(t.comparison('0', 28));
  });

  it('cả hai kỳ bằng 0: không có gì để nói — không pill', () => {
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      paidBookings: { current: 0, previous: 0 },
    });
    expect(card(cards, 'paid').delta).toBeUndefined();
  });

  it('cancellationRate: delta theo ĐIỂM phần trăm, không phải % của % (vòng vá F5)', () => {
    // 2.0% → 4.0% từng in "↑100.0%" — đọc thành tăng gấp đôi/chạm trần.
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      cancellationRate: { current: '4.0', previous: '2.0' },
    });
    const rate = card(cards, 'cancellationRate');
    expect(rate.delta?.amount).toBe(t.trend.percentagePoints('2.0'));
    expect(rate.delta?.direction).toBe('up');
    expect(rate.deltaGood).toBe(false); // tỉ lệ huỷ tăng là xấu
  });

  it('metric không tính được: giá trị là "—" và không có pill', () => {
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      cancellationRate: { current: null, previous: '5.0' },
    });
    const rate = card(cards, 'cancellationRate');
    expect(rate.value).toBe(t.noValue);
    expect(rate.delta).toBeUndefined();
  });

  it('kỳ trước không tính được: có số kỳ này nhưng vẫn KHÔNG so sánh được', () => {
    const cards = toBookingsStatCards({
      ...BOOKINGS,
      cancellationRate: { current: '8.3', previous: null },
    });
    const rate = card(cards, 'cancellationRate');
    expect(rate.value).toBe('8.3%');
    expect(rate.delta).toBeUndefined();
    expect(rate.caption).toBe(t.comparison(t.noValue, 28));
  });

  it('bốn card theo đúng thứ tự spec §3-F5', () => {
    expect(toBookingsStatCards(BOOKINGS).map((c) => c.key)).toEqual([
      'revenue',
      'paid',
      'created',
      'cancellationRate',
    ]);
  });
});

describe('toCancellationsStatCards', () => {
  it('hàng đợi là ẢNH CHỤP nên caption nói "N days ago", không phải "prior N days"', () => {
    const queue = card(toCancellationsStatCards(CANCELLATIONS), 'pendingQueue');
    expect(queue.caption).toBe(t.snapshotComparison('2', 28));
  });

  it('hàng đợi PHÌNH ra là xấu', () => {
    const queue = card(toCancellationsStatCards(CANCELLATIONS), 'pendingQueue');
    expect(queue.delta?.direction).toBe('up');
    expect(queue.deltaGood).toBe(false);
  });

  it('approved/denied là thông lượng — không tô tốt/xấu', () => {
    const cards = toCancellationsStatCards(CANCELLATIONS);
    // Duyệt nhiều hơn = làm việc nhiều hơn NHƯNG cũng là tiền đi ra; từ chối
    // nhiều hơn cũng vậy. Tô màu một chiều là đặt lời phán quyết vào chỗ
    // không có phán quyết nào.
    expect(card(cards, 'approved').deltaGood).toBeUndefined();
    expect(card(cards, 'denied').deltaGood).toBeUndefined();
  });

  it('nhãn approved/denied mang số ngày của server, không viết cứng 28', () => {
    const cards = toCancellationsStatCards({
      ...CANCELLATIONS,
      period: { ...period, windowDays: 7 },
    });
    expect(card(cards, 'approved').label).toBe(t.cancellations.approved(7));
  });

  it('ba card theo đúng thứ tự spec §3-F5', () => {
    expect(toCancellationsStatCards(CANCELLATIONS).map((c) => c.key)).toEqual([
      'pendingQueue',
      'approved',
      'denied',
    ]);
  });
});

describe('toReviewsStatCards', () => {
  it('hàng đợi moderation VƠI đi là tốt', () => {
    const pending = card(toReviewsStatCards(REVIEWS), 'pending');
    expect(pending.delta?.direction).toBe('down');
    expect(pending.deltaGood).toBe(true);
    expect(pending.caption).toBe(t.snapshotComparison('7', 28));
  });

  it('điểm trung bình in hai chữ số thập phân, tăng là tốt', () => {
    const rating = card(toReviewsStatCards(REVIEWS), 'averageRating');
    expect(rating.value).toBe('4.60');
    expect(rating.deltaGood).toBe(true);
    // Thang sao chặn hai đầu → hiệu số thô, không phải % (vòng vá F5).
    expect(rating.delta?.amount).toBe('0.40');
    expect(rating.caption).toBe(t.comparison('4.20', 28));
  });

  it('kỳ không có review nào: "—" chứ không phải 0 sao', () => {
    const cards = toReviewsStatCards({
      ...REVIEWS,
      averageRating: { current: null, previous: null },
    });
    const rating = card(cards, 'averageRating');
    expect(rating.value).toBe(t.noValue);
    expect(rating.caption).toBe(t.comparison(t.noValue, 28));
  });

  it('ba card theo đúng thứ tự spec §3-F5', () => {
    expect(toReviewsStatCards(REVIEWS).map((c) => c.key)).toEqual([
      'pending',
      'approved',
      'averageRating',
    ]);
  });
});

describe('toOutboxStatCards (F7)', () => {
  it('sent là số ĐƠN của kỳ này: không pill delta, caption nói nó đo gì (kỳ trước bị purge)', () => {
    // Vòng vá review F7: purge 30 ngày xoá gần hết kỳ 28–56 ngày trước — một
    // cặp ở đây từng in "↑1200% vs 3 prior 28 days" mỗi ngày.
    const sent = card(toOutboxStatCards(OUTBOX), 'sent');
    expect(sent.label).toBe(t.outbox.sent(28));
    expect(sent.value).toBe('40');
    expect(sent.caption).toBe(t.outbox.sentCaption(28));
    expect(sent.delta).toBeUndefined();
    expect(sent.deltaGood).toBeUndefined();
  });

  it('queued là ẢNH CHỤP một số đơn: không pill, caption nói nó đang chờ gì', () => {
    const queued = card(toOutboxStatCards(OUTBOX), 'queued');
    expect(queued.value).toBe('3');
    expect(queued.delta).toBeUndefined();
    expect(queued.caption).toBe(t.outbox.queuedCaption);
  });

  it('failed > 0: CALLOUT đỏ "Needs attention" — lời gọi người qua khe riêng, KHÔNG mượn delta', () => {
    // Vòng vá review F7: bản đầu bịa `delta.direction='flat'` để mượn tông đỏ,
    // mà "flat" nghĩa là "không đổi so kỳ trước" — P4d đọc chung VM sẽ hiểu sai.
    const failed = card(toOutboxStatCards(OUTBOX), 'failed');
    expect(failed.value).toBe('2');
    expect(failed.caption).toBe(t.outbox.failedCaption);
    expect(failed.delta).toBeUndefined();
    expect(failed.callout).toEqual({
      label: t.outbox.needsAttention,
      srLabel: t.outbox.needsAttentionSr('2'),
      tone: 'bad',
    });
  });

  it('failed = 0: không pill, không callout, caption nói không có gì chờ retry', () => {
    const failed = card(toOutboxStatCards({ ...OUTBOX, failed: 0 }), 'failed');
    expect(failed.delta).toBeUndefined();
    expect(failed.callout).toBeUndefined();
    expect(failed.caption).toBe(t.outbox.failedCaptionNone);
  });

  it('ba card theo đúng thứ tự spec §3-F7: sent · queued · failed', () => {
    expect(toOutboxStatCards(OUTBOX).map((c) => c.key)).toEqual(['sent', 'queued', 'failed']);
  });
});

describe('toPaymentEventsStatCards (F8)', () => {
  it('received: cặp hai kỳ TRUNG TÍNH — nhiều webhook hơn không tốt cũng không xấu', () => {
    const received = card(toPaymentEventsStatCards(PAYMENT_EVENTS), 'received');
    expect(received.label).toBe(t.paymentEvents.received(28));
    expect(received.value).toBe('40');
    expect(received.caption).toBe(t.comparison('32', 28));
    expect(received.delta).toMatchObject({ direction: 'up', amount: '25.0%' });
    expect(received.deltaGood).toBeUndefined();
  });

  it('có row KẸT: ẢNH CHỤP số đơn = unprocessed (khớp bảng), CALLOUT đỏ + caption nói số kẹt, không delta', () => {
    const unprocessed = card(toPaymentEventsStatCards(PAYMENT_EVENTS), 'unprocessed');
    expect(unprocessed.value).toBe('2');
    expect(unprocessed.caption).toBe(
      t.paymentEvents.stuckCaption('1', PAYMENT_EVENT_STUCK_MINUTES),
    );
    expect(unprocessed.delta).toBeUndefined();
    expect(unprocessed.callout).toEqual({
      label: t.paymentEvents.needsAttention,
      srLabel: t.paymentEvents.needsAttentionSr('1', PAYMENT_EVENT_STUCK_MINUTES),
      tone: 'bad',
    });
  });

  it('unprocessed > 0 nhưng KHÔNG row nào kẹt (handler đang chạy): không callout, caption "provider sẽ retry"', () => {
    const unprocessed = card(
      toPaymentEventsStatCards({ ...PAYMENT_EVENTS, stuck: 0 }),
      'unprocessed',
    );
    expect(unprocessed.value).toBe('2');
    expect(unprocessed.callout).toBeUndefined();
    expect(unprocessed.caption).toBe(t.paymentEvents.unprocessedCaption);
  });

  it('unprocessed = 0: không callout, caption nói mọi delivery đã xong', () => {
    const unprocessed = card(
      toPaymentEventsStatCards({ ...PAYMENT_EVENTS, unprocessed: 0, stuck: 0 }),
      'unprocessed',
    );
    expect(unprocessed.callout).toBeUndefined();
    expect(unprocessed.caption).toBe(t.paymentEvents.unprocessedCaptionNone);
  });

  it('linked: cặp trung tính; hai kỳ bằng nhau → pill "flat" không tô màu', () => {
    const linked = card(toPaymentEventsStatCards(PAYMENT_EVENTS), 'linked');
    expect(linked.label).toBe(t.paymentEvents.linked(28));
    expect(linked.delta?.direction).toBe('flat');
    expect(linked.deltaGood).toBeUndefined();
  });

  it('ba card theo đúng thứ tự spec §3-F8: received · unprocessed · linked', () => {
    expect(toPaymentEventsStatCards(PAYMENT_EVENTS).map((c) => c.key)).toEqual([
      'received',
      'unprocessed',
      'linked',
    ]);
  });
});

describe('toEnquiriesStatCards (F9)', () => {
  it('created: cặp hai kỳ, NHIỀU HƠN LÀ TỐT (lead mới đổ vào là nhu cầu)', () => {
    const created = card(toEnquiriesStatCards(ENQUIRIES), 'created');
    expect(created.label).toBe(t.enquiries.created(28));
    expect(created.value).toBe('12');
    expect(created.delta?.direction).toBe('up');
    expect(created.deltaGood).toBe(true);
  });

  it('won: cặp hai kỳ, ÍT HƠN LÀ XẤU — giảm thì pill tô đỏ, không trung tính', () => {
    const won = card(toEnquiriesStatCards(ENQUIRIES), 'won');
    expect(won.label).toBe(t.enquiries.won(28));
    expect(won.value).toBe('3');
    expect(won.delta?.direction).toBe('down');
    expect(won.deltaGood).toBe(false);
  });

  it('open là ẢNH CHỤP: số đơn, KHÔNG delta và KHÔNG callout đỏ (hàng chờ CRM là bình thường)', () => {
    const open = card(toEnquiriesStatCards(ENQUIRIES), 'open');
    expect(open.label).toBe(t.enquiries.open);
    expect(open.value).toBe('7');
    // Caption kể đúng ba trạng thái mở, dựng từ hằng contract chứ không kể tay.
    expect(open.caption).toBe(t.enquiries.openCaption('New, Contacted, Quoted'));
    expect(open.delta).toBeUndefined();
    expect(open.callout).toBeUndefined();
  });

  it('open = 0: caption đổi giọng, vẫn KHÔNG callout', () => {
    const open = card(toEnquiriesStatCards({ ...ENQUIRIES, open: 0 }), 'open');
    expect(open.value).toBe('0');
    expect(open.caption).toBe(t.enquiries.openCaptionNone);
    expect(open.callout).toBeUndefined();
  });

  it('ba card theo đúng thứ tự spec §3-F9: created · won · open', () => {
    expect(toEnquiriesStatCards(ENQUIRIES).map((c) => c.key)).toEqual(['created', 'won', 'open']);
  });
});

describe('toSubscribersStatCards (F10)', () => {
  it('created: cặp hai kỳ, NHIỀU HƠN LÀ TỐT (danh sách lớn lên)', () => {
    const created = card(toSubscribersStatCards(SUBSCRIBERS), 'created');
    expect(created.label).toBe(t.subscribers.created(28));
    expect(created.value).toBe('24');
    expect(created.delta?.direction).toBe('up');
    expect(created.deltaGood).toBe(true);
  });

  it('unsubscribed: cặp hai kỳ, NHIỀU HƠN LÀ XẤU — tăng thì pill tô đỏ', () => {
    const unsubscribed = card(toSubscribersStatCards(SUBSCRIBERS), 'unsubscribed');
    expect(unsubscribed.label).toBe(t.subscribers.unsubscribed(28));
    expect(unsubscribed.value).toBe('6');
    expect(unsubscribed.delta?.direction).toBe('up');
    // Đây là chỗ polarity của hai card cạnh nhau đối lập nhau: cùng một mũi
    // tên đi lên, một cái xanh và một cái đỏ.
    expect(unsubscribed.deltaGood).toBe(false);
  });

  it('unsubscribed GIẢM là TỐT — ít người rời danh sách hơn kỳ trước', () => {
    const unsubscribed = card(
      toSubscribersStatCards({ ...SUBSCRIBERS, unsubscribed: { current: 2, previous: 9 } }),
      'unsubscribed',
    );
    expect(unsubscribed.delta?.direction).toBe('down');
    expect(unsubscribed.deltaGood).toBe(true);
  });

  it('active là ẢNH CHỤP: số đơn, KHÔNG delta và KHÔNG callout (đây là số muốn thấy LỚN)', () => {
    const active = card(toSubscribersStatCards(SUBSCRIBERS), 'active');
    expect(active.label).toBe(t.subscribers.active);
    expect(active.value).toBe('180');
    expect(active.caption).toBe(t.subscribers.activeCaption);
    expect(active.delta).toBeUndefined();
    expect(active.callout).toBeUndefined();
  });

  it('active = 0: caption đổi giọng, vẫn KHÔNG callout đỏ', () => {
    const active = card(toSubscribersStatCards({ ...SUBSCRIBERS, active: 0 }), 'active');
    expect(active.value).toBe('0');
    expect(active.caption).toBe(t.subscribers.activeCaptionNone);
    expect(active.callout).toBeUndefined();
  });

  it('ba card theo đúng thứ tự spec §3-F10: created · unsubscribed · active', () => {
    expect(toSubscribersStatCards(SUBSCRIBERS).map((c) => c.key)).toEqual([
      'created',
      'unsubscribed',
      'active',
    ]);
  });
});
