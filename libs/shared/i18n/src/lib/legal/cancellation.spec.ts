import { CANCELLATION_WINDOW_RULES } from '@tourism/contract';
import {
  cancellationDoc,
  cancellationWindowBullets,
  cancellationWindowSentence,
} from './cancellation.js';

/**
 * Bảng hạn chót vừa là COPY vừa là LUẬT TIỀN, nên nó chỉ được có MỘT nguồn:
 * `CANCELLATION_WINDOW_RULES` ở contract. Bản tiền nhiệm (`refund-tiers.ts`)
 * ra đời đúng vì hai văn bản chép tay cùng một bảng rồi cả hai cùng bỏ rơi
 * ngày 14 — spec này giữ lại bài học đó cho luật mới.
 */
describe('câu hạn chót sinh từ CANCELLATION_WINDOW_RULES', () => {
  it('mỗi luật đúng một gạch đầu dòng — không thiếu, không thừa', () => {
    expect(cancellationWindowBullets()).toHaveLength(CANCELLATION_WINDOW_RULES.length);
  });

  it('in đúng ba dòng của bảng hạn chót', () => {
    expect(cancellationWindowBullets()).toEqual([
      'Day trips: free cancellation up to 1 day before departure.',
      'Trips of 2–3 days: free cancellation up to 3 days before departure.',
      'Trips of 4 days or more: free cancellation up to 7 days before departure.',
    ]);
  });

  it('gói cùng bảng ấy thành MỘT câu, cho /terms và FAQ', () => {
    expect(cancellationWindowSentence()).toBe(
      'Every tour is free to cancel until its own deadline: day trips, 1 day before departure; trips of 2–3 days, 3 days before departure; trips of 4 days or more, 7 days before departure.',
    );
  });

  it('không còn dấu vết bảng bậc cũ (100/50/25/0) trong câu sinh ra', () => {
    const all = [...cancellationWindowBullets(), cancellationWindowSentence()].join(' ');
    expect(all).not.toMatch(/%/);
    expect(all).not.toMatch(/\b30 days\b/);
  });

  it('văn bản chính sách DÙNG chính các dòng ấy, không chép tay lại', () => {
    const section = cancellationDoc.sections.find(
      (s) => s.heading === 'Your free-cancellation deadline',
    );
    expect(section?.bullets).toEqual(cancellationWindowBullets());
  });

  it('chính sách nói giờ Việt Nam — hạn chót không đọc theo đồng hồ máy khách', () => {
    expect(JSON.stringify(cancellationDoc)).toMatch(/11:59 pm Vietnam time/);
  });
});
