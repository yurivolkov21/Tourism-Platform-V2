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
  statsPeriodLabel,
  statsRangeLabel,
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
  submitted: { current: 15, previous: 11 },
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

  it('BỐN card theo đúng thứ tự — mẫu số đứng ngay sau hàng đợi', () => {
    // `submitted` thêm ở ADR-0028 §AMEND 2 §4: không có nó thì "Approved 9"
    // không đọc được. Vị trí là một phần của ý nghĩa — nhận về · xử · còn
    // tồn · chất lượng, và `submitted` cùng tập với `averageRating`.
    expect(toReviewsStatCards(REVIEWS).map((c) => c.key)).toEqual([
      'pending',
      'submitted',
      'approved',
      'averageRating',
    ]);
  });

  it('submitted TRUNG TÍNH: nhiều review gửi về không tự thân là tốt hay xấu', () => {
    const submitted = card(toReviewsStatCards(REVIEWS), 'submitted');
    expect(submitted.value).toBe('15');
    expect(submitted.delta?.direction).toBe('up');
    expect(submitted.deltaGood).toBeUndefined();
  });

  it('kỳ do ADMIN chọn: nhãn BỎ hậu tố "Nd", caption in ngày thật', () => {
    // "Submitted 31d" đọc thành "31 ngày gần nhất", tức một cửa sổ TRƯỢT;
    // nhưng lọc tháng 5 là một kỳ đứng yên (cùng luật đã chốt ở cancellations).
    const picked = toReviewsStatCards({
      ...REVIEWS,
      period: { ...period, generatedAt: '2026-09-20T10:30:00.000Z' },
    });

    expect(card(picked, 'submitted').label).toBe(t.reviews.submittedInPeriod);
    expect(card(picked, 'approved').label).toBe(t.reviews.approvedInPeriod);
    expect(card(picked, 'submitted').caption).not.toContain('28 days ago');
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

/**
 * ADR-0028 — kỳ do admin chọn. Card in ĐÚNG khoảng đang lọc, và caption nói
 * thẳng ngày thay vì "prior N days": kỳ này không trôi theo đồng hồ nên một
 * con số ngày là thứ đối soát được.
 */
/**
 * Bất biến chữ nghĩa của caption (user báo 04/09): giữa hai CON SỐ phải có
 * thứ gì đó không phải khoảng trắng, kẻo `vs 0 28 days ago` đọc thành "028".
 * Ca này chỉ xảy ra ở caption ảnh chụp — các câu còn lại đều có chữ chen giữa.
 */
describe('caption không để hai con số dính nhau', () => {
  const TWO_NUMBERS_ADJACENT = /\d\s+\d/;

  it('caption ảnh chụp tách hai số bằng dấu phân cách', () => {
    expect(t.snapshotComparison('0', 28)).toBe('vs 0 · 28 days ago');
    expect(t.snapshotComparison('0', 28)).not.toMatch(TWO_NUMBERS_ADJACENT);
  });

  it('ba caption còn lại vốn đã có chữ chen giữa — khoá lại để đừng ai gỡ', () => {
    expect(t.comparison('0', 28)).not.toMatch(TWO_NUMBERS_ADJACENT);
    expect(t.snapshotComparisonAt('0', 'May 1, 2026')).not.toMatch(TWO_NUMBERS_ADJACENT);
    expect(t.comparisonRange('0', 'Aug 2 – Aug 31, 2026')).not.toMatch(TWO_NUMBERS_ADJACENT);
  });
});

describe('kỳ do admin chọn (ADR-0028)', () => {
  /** Lọc trọn tháng 9, đọc ngày 04/09 → currentTo TÁCH khỏi generatedAt. */
  const filtered = {
    windowDays: 30,
    currentFrom: '2026-09-01T00:00:00.000Z',
    currentTo: '2026-10-01T00:00:00.000Z',
    previousFrom: '2026-08-02T00:00:00.000Z',
    generatedAt: '2026-09-04T10:30:00.000Z',
  };

  describe('statsRangeLabel', () => {
    it('prints the last day INSIDE the range, not the exclusive edge', () => {
      // Mốc cuối là 00:00 ngày 1/10 và KHÔNG tính vào — in ra "Oct 1" sẽ nói
      // dối về đúng một ngày ở mọi khoảng.
      expect(statsRangeLabel('2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')).toBe(
        'Sep 1 – Sep 30, 2026',
      );
    });

    it('spells both years out when the range straddles a new year', () => {
      expect(statsRangeLabel('2025-12-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z')).toBe(
        'Dec 2, 2025 – Jan 1, 2026',
      );
    });

    it('reads dates in UTC — the same ledger the API and the table use', () => {
      // 00:00Z ngày 1 đọc theo giờ máy ở múi âm sẽ lùi thành ngày 31 tháng
      // trước; nhãn phải khớp cột Created của bảng, không khớp đồng hồ người xem.
      expect(statsRangeLabel('2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z')).toBe(
        'Sep 1 – Sep 1, 2026',
      );
    });
  });

  describe('statsPeriodLabel', () => {
    it('names the filtered range for the whole card row', () => {
      expect(statsPeriodLabel(filtered)).toBe(t.periodLabel('Sep 1 – Sep 30, 2026'));
    });

    it('says nothing for a SLIDING window — a printed date would go stale', () => {
      expect(statsPeriodLabel(period)).toBeUndefined();
    });
  });

  describe('toBookingsStatCards', () => {
    it('captions every card with the real previous dates', () => {
      const cards = toBookingsStatCards({ ...BOOKINGS, period: filtered });
      const range = 'Aug 2 – Aug 31, 2026';
      expect(cards.map((card) => card.caption)).toEqual([
        t.comparisonRange('$900.00', range),
        t.comparisonRange('9', range),
        t.comparisonRange('20', range),
        t.comparisonRange('5.0%', range),
      ]);
    });

    it('keeps the "prior N days" wording while the window is still sliding', () => {
      const cards = toBookingsStatCards(BOOKINGS);
      expect(cards[0]?.caption).toBe(t.comparison('$900.00', 28));
    });

    it('leaves the numbers and the delta pills untouched — only the wording moves', () => {
      const filteredCards = toBookingsStatCards({ ...BOOKINGS, period: filtered });
      const slidingCards = toBookingsStatCards(BOOKINGS);
      expect(filteredCards.map((card) => card.value)).toEqual(
        slidingCards.map((card) => card.value),
      );
      expect(filteredCards.map((card) => card.delta)).toEqual(
        slidingCards.map((card) => card.delta),
      );
    });
  });

  /**
   * Lệch phiên bản khi deploy (ADR-0024): Vercel dựng xong admin trước khi
   * Render dựng xong API, nên bản admin MỚI đứng cạnh bản API CŨ vài phút.
   * API cũ trả `period` không có `currentTo` — client oRPC không validate
   * output nên field thiếu đi thẳng tới đây.
   *
   * Cây phải NGẢ VỀ hành vi trước ADR-0028 (caption "prior N days", không có
   * dòng khoảng ngày), không được ném RangeError làm 500 cả trang.
   */
  describe('API cũ trả period thiếu mốc — lệch phiên bản lúc deploy', () => {
    /** Ép kiểu vì đây là dữ liệu DÂY, không phải dữ liệu đã qua schema. */
    const stale = { ...period, currentTo: undefined } as unknown as typeof period;

    it('statsPeriodLabel im lặng thay vì ném RangeError', () => {
      expect(() => statsPeriodLabel(stale)).not.toThrow();
      expect(statsPeriodLabel(stale)).toBeUndefined();
    });

    it('caption ngả về "prior N days" thay vì làm sập trang', () => {
      const cards = toBookingsStatCards({ ...BOOKINGS, period: stale });
      expect(cards[0]?.caption).toBe(t.comparison('$900.00', 28));
    });

    it('mốc rác ở BẤT KỲ đầu nào cũng ngả về câu cũ, không riêng currentTo', () => {
      // `previousFrom` mới là mốc caption đọc — thiếu nó mà vẫn coi là "kỳ đã
      // chọn" thì lỗi chỉ dời xuống một dòng.
      const broken = { ...period, currentTo: '2026-10-01T00:00:00.000Z', previousFrom: 'nonsense' };
      expect(() => toBookingsStatCards({ ...BOOKINGS, period: broken })).not.toThrow();
      expect(statsPeriodLabel(broken)).toBeUndefined();
    });
  });

  /** `/cancellations` là vùng thứ hai có bộ lọc ngày (ADR-0028 §AMEND). */
  describe('toCancellationsStatCards', () => {
    /** Lọc trọn tháng 5, đọc ngày 04/09 → kỳ ĐỨNG YÊN, không phải cửa sổ trượt. */
    const may = {
      windowDays: 31,
      currentFrom: '2026-05-01T00:00:00.000Z',
      currentTo: '2026-06-01T00:00:00.000Z',
      previousFrom: '2026-03-31T00:00:00.000Z',
      generatedAt: '2026-09-04T10:30:00.000Z',
    };

    it('card ẢNH CHỤP nói tên NGÀY đầu kỳ, không nói "N days ago"', () => {
      // Kỳ đã chọn thì đứng yên nên gọi được tên nó; "31 days ago" tính từ
      // hôm nay sẽ trỏ vào một mốc chẳng liên quan gì tới tháng 5.
      const cards = toCancellationsStatCards({ ...CANCELLATIONS, period: may });
      expect(cards[0]?.caption).toBe(t.snapshotComparisonAt('2', 'May 1, 2026'));
    });

    it('bỏ hậu tố "Nd" khỏi nhãn khi kỳ do admin chọn', () => {
      // "Approved 31d" đọc thành một cửa sổ TRƯỢT 31 ngày — sai hẳn nghĩa.
      const cards = toCancellationsStatCards({ ...CANCELLATIONS, period: may });
      expect(cards[1]?.label).toBe(t.cancellations.approvedInPeriod);
      expect(cards[2]?.label).toBe(t.cancellations.deniedInPeriod);
    });

    it('hai card đếm-trong-kỳ dùng caption khoảng ngày như /bookings', () => {
      const cards = toCancellationsStatCards({ ...CANCELLATIONS, period: may });
      expect(cards[1]?.caption).toBe(t.comparisonRange('8', 'Mar 31 – Apr 30, 2026'));
    });

    it('cửa sổ TRƯỢT giữ NGUYÊN chữ cũ — vùng này mặc định không lọc ngày', () => {
      const cards = toCancellationsStatCards(CANCELLATIONS);
      expect(cards[0]?.caption).toBe(t.snapshotComparison('2', 28));
      expect(cards[1]?.label).toBe(t.cancellations.approved(28));
      expect(cards[1]?.caption).toBe(t.comparison('8', 28));
    });
  });

  it('năm vùng còn lại KHÔNG đổi: chúng chưa có bộ lọc ngày nào', () => {
    // Nếu một ngày nào đó vùng khác mọc bộ lọc, test này đỏ và người sửa sẽ
    // đọc ADR-0028 trước khi dựng cửa sổ thứ hai.
    expect(toReviewsStatCards(REVIEWS)[0]?.caption).toBe(t.snapshotComparison('7', 28));
    expect(toEnquiriesStatCards(ENQUIRIES)[0]?.caption).toBe(t.comparison('8', 28));
  });
});
