import { describe, expect, it } from 'vitest';
import { dateChangeBlocker, reopenBlocker, seatsChangeBlocker } from './departure-rules.js';

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
    it('chưa có booking sống thì đổi ngày thoải mái', () => {
      // Ca hay gặp nhất: đang dựng lịch, gõ nhầm ngày, sửa lại.
      expect(dateChangeBlocker(0)).toBeNull();
    });

    it('một booking sống là đủ để chặn', () => {
      // Booking lưu BẢN SAO ngày khởi hành và ADR-0041 tính hạn huỷ từ bản
      // sao đó — đổi ngày mà không đồng bộ là hai sự thật.
      const reason = dateChangeBlocker(1);

      expect(reason).toContain('1');
      expect(reason).toMatch(/booking/i);
    });

    it('nhiều booking sống thì câu từ chối đếm đúng', () => {
      expect(dateChangeBlocker(12)).toContain('12');
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
});
