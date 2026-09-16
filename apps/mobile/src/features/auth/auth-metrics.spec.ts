import { fromMockup, MOCKUP_FRAME_HEIGHT } from './auth-metrics';

describe('fromMockup', () => {
  it('giữ nguyên tỉ lệ so với khung vẽ', () => {
    // Ảnh bìa 300px trên khung 700px là 42,9% — phải còn đúng 42,9% ở mọi máy.
    expect(fromMockup(300, MOCKUP_FRAME_HEIGHT)).toBe(300);
    expect(fromMockup(300, 844)).toBe(362);
    expect(fromMockup(300, 1400)).toBe(600);
  });

  it('máy nhỏ hơn khung vẽ thì co lại chứ không giữ số cứng', () => {
    expect(fromMockup(226, 667)).toBe(215);
  });
});
