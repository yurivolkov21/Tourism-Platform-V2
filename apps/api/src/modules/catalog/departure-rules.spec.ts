import { describe, expect, it } from 'vitest';
import {
  dateChangeBlocker,
  departureCancelBlocker,
  departureRevalidationTags,
  reopenBlocker,
  seatsAboveTourMaxBlocker,
  seatsChangeBlocker,
} from './departure-rules.js';

/**
 * Ba luật chuyến khởi hành (spec P4e-1 §2b, §2c, F12) — THUẦN, nên mọi biên
 * kiểm được mà không cần DB.
 *
 * Quy ước chung của cả ba: `null` = cho đi; CHUỖI = lý do từ chối, đã thành
 * câu đọc được và MANG SẴN con số thật. Không trả `boolean` vì mọi chỗ gọi
 * đều cần kể lý do — trả cờ rồi ghép câu ở ba nơi là ba bản chép.
 */
describe('departure-rules', () => {
  describe('seatsChangeBlocker (§2c — hạ ghế)', () => {
    it('nâng ghế luôn hợp lệ', () => {
      expect(seatsChangeBlocker(30, 12)).toBeNull();
    });

    it('hạ xuống ĐÚNG bằng số đã đặt là hợp lệ — biên dưới nằm TRONG tập cho phép', () => {
      // Chuyến bán hết rồi khoá ghế lại đúng con số đang có là thao tác thật:
      // "không nhận thêm ai nữa". CHECK `departures_seats_within_total` cũng
      // cho phép bằng, nên chặn ở đây là API nghiêm hơn dữ liệu — vô cớ.
      expect(seatsChangeBlocker(12, 12)).toBeNull();
    });

    it('hạ dưới số đã đặt bị từ chối, và câu từ chối mang con số THẬT', () => {
      const reason = seatsChangeBlocker(10, 12);

      // Con số phải có mặt: "không hạ được" trần bắt admin tự đi tra xem
      // đang vướng ở đâu, trong khi server vừa đọc nó xong.
      expect(reason).toContain('12');
      expect(reason).toMatch(/seat/i);
    });

    it('chuyến chưa ai đặt thì hạ tới đâu cũng được', () => {
      expect(seatsChangeBlocker(1, 0)).toBeNull();
    });
  });

  describe('dateChangeBlocker (§2b — đổi ngày)', () => {
    it('chưa ai giữ ghế thì đổi ngày thoải mái', () => {
      // Ca hay gặp nhất: đang dựng lịch, gõ nhầm ngày, sửa lại.
      expect(dateChangeBlocker(0)).toBeNull();
    });

    it('một ghế đã chốt là đủ để chặn', () => {
      // Booking lưu BẢN SAO ngày khởi hành và ADR-0041 tính hạn huỷ từ bản
      // sao đó — đổi ngày mà không đồng bộ là hai sự thật.
      const reason = dateChangeBlocker(1);

      expect(reason).toContain('1');
      expect(reason).toMatch(/seat/i);
    });

    it('nhiều ghế thì câu từ chối đếm đúng', () => {
      expect(dateChangeBlocker(12)).toContain('12');
    });

    it('thước là GHẾ, không phải số booking — hoàn tiền thiện chí KHÔNG trả ghế', () => {
      // `booking-states.md`: chỉ lõi huỷ mới trừ `seats_booked`. Một booking
      // hoàn trọn tiền kiểu thiện chí vẫn đi tour, vẫn giữ ghế — đếm theo
      // trạng thái booking sẽ đọc ra 0 rồi mở khoá ô ngày cho một chuyến vẫn
      // còn khách thật.
      expect(dateChangeBlocker(4)).toMatch(/4 seats booked/);
    });
  });

  describe('reopenBlocker (mở lại chuyến đã đóng)', () => {
    // Chuyến 1 ngày → N = 1 → hạn chót = 2026-10-09.
    const ONE_DAY = { start: '2026-10-10', end: '2026-10-10' };
    // Chuyến 5 ngày → N = 7 → hạn chót = 2026-10-03.
    const FIVE_DAYS = { start: '2026-10-10', end: '2026-10-14' };

    it('trước hạn chót thì mở lại được', () => {
      expect(
        reopenBlocker(ONE_DAY.start, ONE_DAY.end, new Date('2026-10-08T12:00:00Z')),
      ).toBeNull();
    });

    it('ĐÚNG ngày hạn chót vẫn mở lại được — hạn hết lúc 23:59:59 giờ Việt Nam', () => {
      expect(
        reopenBlocker(ONE_DAY.start, ONE_DAY.end, new Date('2026-10-09T12:00:00Z')),
      ).toBeNull();
    });

    it('qua hạn chót thì từ chối, kèm chính ngày hạn chót', () => {
      const reason = reopenBlocker(ONE_DAY.start, ONE_DAY.end, new Date('2026-10-10T00:30:00Z'));

      // Ngày phải có mặt: admin cần biết mốc đã trôi qua là mốc nào.
      expect(reason).toContain('2026-10-09');
    });

    it('N đọc từ `cancellationDeadline` của contract, không phải một bản chép', () => {
      // Cùng ngày "hôm nay" (06/10) mà chuyến 1 ngày mở lại được còn chuyến 5
      // ngày thì không — chỉ đúng nếu N thật sự đổi theo độ dài chuyến
      // (ADR-0041 §8: một nguồn duy nhất cho cả văn bản lẫn phép tính).
      const now = new Date('2026-10-06T12:00:00Z');

      expect(reopenBlocker(ONE_DAY.start, ONE_DAY.end, now)).toBeNull();
      expect(reopenBlocker(FIVE_DAYS.start, FIVE_DAYS.end, now)).toContain('2026-10-03');
    });

    it('ranh giới tính theo ngày VIỆT NAM, không theo UTC', () => {
      // 2026-10-09T17:30Z là 2026-10-10 00:30 giờ Việt Nam — đã qua hạn.
      // Đọc nhầm sang UTC thì chuyến này còn mở lại được thêm 7 tiếng.
      expect(reopenBlocker(ONE_DAY.start, ONE_DAY.end, new Date('2026-10-09T17:30:00Z'))).toContain(
        '2026-10-09',
      );
    });
  });

  describe('departureRevalidationTags (spec §2g)', () => {
    const SLUG = 'ha-long-bay-cruise';
    const TAG = `tour:${SLUG}`;
    // "Hôm nay" 01/10; chuyến 5 ngày khởi hành 10/10 → N = 7 → hạn chót 03/10.
    const NOW = new Date('2026-10-01T12:00:00Z');
    const BOOKABLE = {
      status: 'OPEN' as const,
      startDate: '2026-10-10',
      endDate: '2026-10-14',
      priceOverride: null,
    };

    it('chuyến mới còn nhận đặt → bust cả `tours` vì nó có thể kéo giá "from" xuống', () => {
      expect(
        departureRevalidationTags({ tourSlug: SLUG, before: null, after: BOOKABLE, now: NOW }),
      ).toEqual(['tours', TAG]);
    });

    it('chuyến mới đã quá hạn đặt → chỉ trang tour', () => {
      // Card in `priceFrom` = min giá trên các chuyến CÒN ĐẶT ĐƯỢC, nên một
      // chuyến sinh ra đã đóng cửa không đụng tới con số ấy.
      const past = { ...BOOKABLE, startDate: '2026-10-02', endDate: '2026-10-06' };

      expect(
        departureRevalidationTags({ tourSlug: SLUG, before: null, after: past, now: NOW }),
      ).toEqual([TAG]);
    });

    it('đóng một chuyến đang nhận đặt → bust cả `tours` (giá "from" có thể nhảy lên)', () => {
      expect(
        departureRevalidationTags({
          tourSlug: SLUG,
          before: BOOKABLE,
          after: { ...BOOKABLE, status: 'CLOSED' },
          now: NOW,
        }),
      ).toEqual(['tours', TAG]);
    });

    it('đổi giá riêng của một chuyến đang nhận đặt → bust cả `tours`', () => {
      expect(
        departureRevalidationTags({
          tourSlug: SLUG,
          before: BOOKABLE,
          after: { ...BOOKABLE, priceOverride: '99.00' },
          now: NOW,
        }),
      ).toEqual(['tours', TAG]);
    });

    it('chỉ đổi ghế trên một chuyến đang nhận đặt → KHÔNG đụng `tours`', () => {
      // Card không in số ghế; bust danh sách vì một con số nó không hiện là
      // bắt cả trang /tours dựng lại cho vui.
      expect(
        departureRevalidationTags({ tourSlug: SLUG, before: BOOKABLE, after: BOOKABLE, now: NOW }),
      ).toEqual([TAG]);
    });

    it('sửa một chuyến đã đóng, vẫn đóng → chỉ trang tour', () => {
      const closed = { ...BOOKABLE, status: 'CLOSED' as const };

      expect(
        departureRevalidationTags({
          tourSlug: SLUG,
          before: closed,
          after: { ...closed, priceOverride: '80.00' },
          now: NOW,
        }),
      ).toEqual([TAG]);
    });
  });
});

describe('departureCancelBlocker (F13 — công ty huỷ chuyến)', () => {
  // Chuyến 1 ngày khởi hành 10/10/2026.
  const START = '2026-10-10';

  it('trước ngày khởi hành thì huỷ được, KỂ CẢ khi đã quá hạn nhận đặt', () => {
    // Khác hẳn `reopenBlocker`: hạn nhận đặt là luật cho việc BÁN. Một chuyến
    // quá hạn đặt mà hướng dẫn viên gãy chân vẫn phải huỷ được — đó chính là
    // lúc người ta cần nút này nhất.
    expect(departureCancelBlocker(START, new Date('2026-10-09T16:59:59.999Z'))).toBeNull();
    expect(departureCancelBlocker(START, new Date('2026-09-01T03:00:00.000Z'))).toBeNull();
  });

  it('ĐÃ TỚI ngày khởi hành (giờ Việt Nam) thì không còn là huỷ', () => {
    // 17:00 UTC = 00:00 hôm sau giờ Việt Nam. Từ khoảnh khắc ấy chuyến đang
    // chạy, và `cancellationBlocker` của từng booking cũng sẽ từ chối — chặn ở
    // đây để admin biết TRƯỚC khi bấm, không phải sau khi nửa hàng đợi đã đi.
    expect(departureCancelBlocker(START, new Date('2026-10-09T17:00:00.000Z'))).toMatch(
      /already started|has started/i,
    );
  });

  it('câu từ chối mang ngày khởi hành thật', () => {
    expect(departureCancelBlocker(START, new Date('2026-10-20T03:00:00.000Z'))).toContain(
      '2026-10-10',
    );
  });
});

describe('seatsAboveTourMaxBlocker (F12 vòng hai — trần ghế theo cỡ nhóm tour)', () => {
  it('bằng trần thì được, vượt một ghế là chặn', () => {
    expect(seatsAboveTourMaxBlocker(12, 12)).toBeNull();
    expect(seatsAboveTourMaxBlocker(13, 12)).toMatch(/at most 12/);
  });

  it('câu từ chối mang CẢ hai con số — admin khỏi phải đi tra tour cho phép bao nhiêu', () => {
    const reason = seatsAboveTourMaxBlocker(40, 12);

    expect(reason).toContain('12');
    expect(reason).toContain('40');
  });

  it('dưới trần thì không nói gì', () => {
    expect(seatsAboveTourMaxBlocker(1, 6)).toBeNull();
  });
});
