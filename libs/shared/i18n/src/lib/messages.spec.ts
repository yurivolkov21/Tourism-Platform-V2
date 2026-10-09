import { DEADLINE_CUTOFF_COPY } from './legal/cancellation.js';
import { messages } from './messages.js';

describe('messages: tourDetail', () => {
  it('tourDetail: mọi nhãn tab và copy modal đều có chữ', () => {
    const t = messages.tourDetail;
    expect(Object.values(t.tabs)).toHaveLength(5);
    for (const v of Object.values(t.tabs)) expect(v.trim().length).toBeGreaterThan(0);
    expect(t.dialogs.allDatesTitle.length).toBeGreaterThan(0);
    expect(t.dialogs.allReviewsTitle.length).toBeGreaterThan(0);
  });
});

describe('messages: tourDetail.itinerary.stopsSummary', () => {
  const summary = messages.tourDetail.itinerary.stopsSummary;

  it('mốc đầu khác mốc cuối: in khoảng giờ đầu–cuối', () => {
    expect(summary(1, 3, '07:30', '18:30')).toBe('Day 1 · 3 stops · 07:30–18:30');
  });

  it('mốc đầu trùng mốc cuối (vd ngày chỉ một điểm dừng): in MỘT giờ, không "09:00–09:00"', () => {
    // Thử tay F17 trên prod (28/09): ngày có đúng một mốc hiện "09:00–09:00".
    expect(summary(2, 1, '09:00', '09:00')).toBe('Day 2 · 1 stop · 09:00');
  });
});

describe('messages: admin catalog — đếm tour và luật xoá của danh mục và điểm đến (review RU2)', () => {
  const categories = messages.admin.categories;
  const destinations = messages.admin.destinations;

  it('hai bảng dùng CHÍNH một bộ chữ — sửa một chỗ là đổi cả hai', () => {
    // So danh tính hàm (`toBe`), không so chữ in ra: hai bản chép tay giống hệt nhau vẫn qua
    // phép so chữ, mà đó đúng là thứ sẽ trôi lệch khi chỉ một bản được sửa.
    expect(destinations.list.tours).toBe(categories.list.tours);
    expect(destinations.list.published).toBe(categories.list.published);
    expect(destinations.list.noTours).toBe(categories.list.noTours);
    expect(destinations.delete.action).toBe(categories.delete.action);
    expect(destinations.delete.actionLabel).toBe(categories.delete.actionLabel);
    expect(destinations.delete.inUse).toBe(categories.delete.inUse);
    expect(destinations.delete.inUseHidden).toBe(categories.delete.inUseHidden);
    expect(destinations.delete.toast.body).toBe(categories.delete.toast.body);
  });

  it('chữ được ghim ở MỘT nơi này — spec của admin so với `messages`, không chép lại', () => {
    expect(categories.list.tours(1)).toBe('1 tour');
    expect(categories.list.tours(3)).toBe('3 tours');
    expect(categories.list.published(2)).toBe('2 published');
    expect(categories.list.noTours).toBe('No tours');
    expect(categories.delete.action).toBe('Delete');
    expect(categories.delete.actionLabel('Cruises')).toBe('Delete Cruises');
    expect(categories.delete.inUse(1)).toBe('Used by 1 tour — hide it instead.');
    expect(categories.delete.inUse(3)).toBe('Used by 3 tours — hide it instead.');
    expect(categories.delete.toast.body('Cruises')).toBe('Cruises is gone.');
  });

  it('khe deploy — hàng không mang số tour: ô Tours in dấu trống, nút Delete nói lý do chung (review E2)', () => {
    expect(categories.list.toursUnknown).toBe('—');
    expect(destinations.list.toursUnknown).toBe(categories.list.toursUnknown);
    expect(categories.delete.unavailable).toBe(
      "Delete isn't available right now. Reload the page and try again.",
    );
    expect(destinations.delete.unavailable).toBe(categories.delete.unavailable);
  });

  it('câu IN_USE của hai bảng chỉ khác danh từ', () => {
    expect(categories.delete.errors.IN_USE).toBe(
      'A tour started using this category a moment ago, so it can’t be deleted. Hide it instead.',
    );
    expect(destinations.delete.errors.IN_USE).toBe(
      'A tour started using this destination a moment ago, so it can’t be deleted. Hide it instead.',
    );
  });

  it('hàng ĐÃ ẨN: lý do khoá và câu IN_USE bỏ vế khuyên ẩn — nút bật tắt ở đó đang là Show (Ruling F-b)', () => {
    expect(categories.delete.inUseHidden(1)).toBe('Used by 1 tour.');
    expect(categories.delete.inUseHidden(3)).toBe('Used by 3 tours.');
    expect(categories.delete.inUseRaceHidden).toBe(
      'A tour started using this category a moment ago, so it can’t be deleted.',
    );
    expect(destinations.delete.inUseRaceHidden).toBe(
      'A tour started using this destination a moment ago, so it can’t be deleted.',
    );
  });
});

describe('messages: mobile.appShell (P5a — vỏ điều hướng)', () => {
  const shell = messages.mobile.appShell;

  // 11 màn của template P5a, cộng ba màn P5b-1 thêm vào cụm auth (verify email,
  // reset password, màn kết quả), cộng đổi mật khẩu (A6, P5b-4), cộng
  // Personal details và Travel stories (P5b-4, phản hồi 27/09).
  it('có đủ tiêu đề cho 17 màn của cây route', () => {
    expect(Object.keys(shell.titles)).toHaveLength(17);
  });

  it('mọi chuỗi trong appShell đều có chữ, không khoá nào rỗng', () => {
    const walk = (node: unknown): string[] =>
      typeof node === 'string' ? [node] : Object.values(node as object).flatMap(walk);

    for (const value of walk(shell)) expect(value.trim().length).toBeGreaterThan(0);
  });

  it('tiêu đề 5 tab DÙNG CHUNG chuỗi với nhãn thanh tab — một khái niệm một chữ', () => {
    expect(shell.titles.home).toBe(messages.mobile.tabs.home);
    expect(shell.titles.explore).toBe(messages.mobile.tabs.explore);
    expect(shell.titles.saved).toBe(messages.mobile.tabs.saved);
    expect(shell.titles.trips).toBe(messages.mobile.tabs.trips);
    expect(shell.titles.account).toBe(messages.mobile.tabs.account);
  });

  it('thanh tab đúng 5 nhãn', () => {
    expect(Object.keys(messages.mobile.tabs)).toHaveLength(5);
  });
});

describe('messages: mobile.auth (P5b-1 — cụm màn auth)', () => {
  /** Duyệt sâu mọi chuỗi trong một nhánh copy, trả về đường dẫn của chuỗi rỗng. */
  function emptyPaths(node: unknown, path: string): string[] {
    if (typeof node === 'string') return node.trim() === '' ? [path] : [];
    if (Array.isArray(node)) return node.flatMap((item, i) => emptyPaths(item, `${path}[${i}]`));
    if (node !== null && typeof node === 'object') {
      return Object.entries(node).flatMap(([key, value]) => emptyPaths(value, `${path}.${key}`));
    }
    return [];
  }

  it('mọi khoá đều có chữ, không khoá nào rỗng', () => {
    expect(emptyPaths(messages.mobile.auth, 'mobile.auth')).toEqual([]);
  });

  it('onboarding đúng ba trang, mỗi trang đủ địa danh, tiêu đề và mô tả', () => {
    const { pages } = messages.mobile.onboarding;

    expect(pages).toHaveLength(3);
    for (const page of pages) {
      expect(page.place.length).toBeGreaterThan(0);
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.body.length).toBeGreaterThan(0);
    }
  });

  it('có tiêu đề cho ba route mới của cụm auth', () => {
    const { titles } = messages.mobile.appShell;

    expect(titles.verifyEmail).toBeTruthy();
    expect(titles.resetPassword).toBeTruthy();
    expect(titles.success).toBeTruthy();
  });

  it('câu lỗi KHÔNG có bản riêng cho mobile — dùng chung với web', () => {
    // Bản chép thứ hai (`mobile.authErrors`) đã bị xoá ở P5b-1. Test này là thứ
    // giữ cho nó không mọc lại: hai client cùng API thì không được nói hai kiểu.
    expect('authErrors' in messages.mobile).toBe(false);
    expect(messages.authForms.errors.invalidCredentials).toBeTruthy();
    expect(messages.formErrors.email.invalid).toBeTruthy();
  });
});

describe('messages: accountSaved (trang /account/saved, spec 09/10)', () => {
  it('savedOn ghép đúng chữ của bản vẽ: "Saved 3 Oct"', () => {
    expect(messages.accountSaved.savedOn('3 Oct')).toBe('Saved 3 Oct');
  });
});

describe('messages: passportHome (trang hộ chiếu /account)', () => {
  /** User duyệt bằng mắt 09/10: bốn nút lối vào trong khung hộ chiếu chỉ có chữ — "Settings" từng mang "⚙". */
  it('bốn nút lối vào của khung hộ chiếu chỉ có chữ, không ký tự icon', () => {
    const t = messages.passportHome;
    expect([t.bookingsLink, t.savedLink, t.settingsLink, t.signOutLink]).toEqual([
      'My bookings',
      'Saved tours',
      'Settings',
      'Sign out',
    ]);
  });
});

describe('messages: bookingDetail (P7 phần B — trang chi tiết đơn)', () => {
  const d = messages.bookingDetail;

  it('mọi chuỗi trong khối đều có chữ', () => {
    const walk = (node: unknown): string[] => {
      if (typeof node === 'string') return [node];
      if (typeof node === 'function' || node === null) return [];
      return Object.values(node as object).flatMap(walk);
    };
    for (const value of walk(d)) expect(value.trim().length).toBeGreaterThan(0);
  });

  it('độ dài chuyến: số ít và số nhiều', () => {
    expect(d.ticket.days(1)).toBe('1 day');
    expect(d.ticket.days(3)).toBe('3 days');
  });

  it('chip đơn sắp đi: còn một ngày thì "tomorrow"', () => {
    expect(d.journey.departsIn(1)).toBe('Departs tomorrow');
    expect(d.journey.departsIn(2)).toBe('Departs in 2 days');
    expect(d.journey.departsIn(29)).toBe('Departs in 29 days');
  });

  it('ngày trong chuyến, số khách, dòng đã hoàn, dòng đã trả, chân khối Get ready', () => {
    expect(d.journey.dayOf(2, 3)).toBe('Day 2 of 3');
    expect(d.ticket.admit(3)).toBe('Admit 3');
    // Dấu trừ là U+2212 (−), không phải gạch nối.
    expect(d.details.refundedAmount('$20.00')).toBe('−$20.00');
    expect(d.details.paidInFull('PayPal', '14 Aug 2026')).toBe(
      'Paid in full by PayPal on 14 Aug 2026',
    );
    expect(d.getReady.reviewOpens('Thu 5 Nov')).toBe('Your review opens on Thu 5 Nov.');
    expect(d.journey.refundPartial('$73.50', '$147.00')).toBe('$73.50 of $147.00');
  });
});

describe('messages: voucher (P7 phần C — voucher của đơn đã trả)', () => {
  /**
   * Chuyến bị CÔNG TY huỷ (ADR-0041 AMEND 1): dải hết hiệu lực của voucher và cột phải của trang chi
   * tiết đơn nói CÙNG một câu về ai huỷ — một khái niệm một chữ, sửa một chỗ là đổi cả hai.
   */
  it('chuyến công ty huỷ: dải voucher và trang chi tiết đơn cùng câu "We had to cancel this departure"', () => {
    expect(messages.bookingDetail.closed.weCancelled).toBe('We had to cancel this departure.');
    expect(messages.voucher.departureCancelledNotice).toBe(
      'We had to cancel this departure — this voucher is no longer valid.',
    );
  });

  /**
   * Giờ chốt của hạn huỷ miễn phí có MỘT nguồn (`DEADLINE_CUTOFF_COPY`, review P7C mục 19): mốc nhật
   * ký voucher từng chép tay "11:59 pm Vietnam time" của câu hạn huỷ. Chữ in ra không đổi.
   */
  it('giờ chốt hạn huỷ một nguồn: câu hạn huỷ, mốc nhật ký voucher và FAQ cùng một chữ', () => {
    expect(DEADLINE_CUTOFF_COPY).toBe('11:59 pm Vietnam time');
    expect(messages.cancellationDeadline.full('2 Nov')).toBe(
      'Free cancellation until 2 Nov, 11:59 pm Vietnam time. No refund after that.',
    );
    expect(messages.voucher.journal.deadlineAt('2 Nov')).toBe('2 Nov, 11:59 pm Vietnam time');
    const faq = messages.faqPage.categories.flatMap(
      (category): readonly { question: string; answer: string }[] => category.items,
    );
    expect(
      faq.find((item) => item.question === 'What is your cancellation policy?')?.answer,
    ).toContain('Cancel on or before that deadline — 11:59 pm Vietnam time — and every dollar');
  });
});
