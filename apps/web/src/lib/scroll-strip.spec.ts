import { describe, expect, it } from 'vitest';
import { revealScrollLeft, scrollEdges } from './scroll-strip';

// Số đo THẬT của dải tab trang tour ở viewport 375 (khung 279px, đo 07–08/10):
// năm tab rộng 61 · 54 · 73 · 56 · 90, khe 24 → toạ độ trong hệ cuộn:
//   Overview 0–61 · Itinerary 85–139 · Departures 163–236 · Reviews 260–316 ·
//   Good to know 340–430.
// scrollWidth 430, cuộn tối đa 430 − 279 = 151. Vùng mờ ở mép rộng 32px (2rem).
const STRIP = { scrollWidth: 430, clientWidth: 279 };
const FADE = 32;

describe('scrollEdges', () => {
  it('dải không tràn thì không mép nào còn tab bị che', () => {
    expect(scrollEdges({ scrollLeft: 0, scrollWidth: 1056, clientWidth: 1056 })).toEqual({
      start: false,
      end: false,
    });
  });

  it('dải tràn, đang ở đầu → chỉ mép phải còn tab bị che', () => {
    expect(scrollEdges({ ...STRIP, scrollLeft: 0 })).toEqual({ start: false, end: true });
  });

  it('đang ở giữa → cả hai mép còn tab bị che', () => {
    expect(scrollEdges({ ...STRIP, scrollLeft: 80 })).toEqual({ start: true, end: true });
  });

  it('đã cuộn tới cuối → chỉ mép trái còn tab bị che', () => {
    expect(scrollEdges({ ...STRIP, scrollLeft: 151 })).toEqual({ start: true, end: false });
  });

  it('lệch dưới 1px do làm tròn subpixel không tính là còn tab bị che', () => {
    // Màn DPR 2–3 cho scrollLeft lẻ (0.5, 150.67…). Không có dung sai thì mép
    // mờ bật lên ở trạng thái nghỉ dù chẳng còn gì bị che.
    expect(scrollEdges({ ...STRIP, scrollLeft: 0.5 })).toEqual({ start: false, end: true });
    expect(scrollEdges({ ...STRIP, scrollLeft: 150.4 })).toEqual({ start: true, end: false });
  });
});

describe('revealScrollLeft', () => {
  it('tab đã nằm ngoài vùng mờ thì giữ nguyên vị trí cuộn', () => {
    // Itinerary 85–139 ở scrollLeft 0: cách mép trái 85 ≥ 32, còn 139 + 32 = 171 ≤ 279.
    expect(
      revealScrollLeft({ ...STRIP, scrollLeft: 0, itemStart: 85, itemEnd: 139, fade: FADE }),
    ).toBe(0);
  });

  it('tab bị che bên phải → cuộn tới khi mép phải của tab cách mép khung đúng một vùng mờ', () => {
    // Reviews 260–316: 316 + 32 − 279 = 69.
    expect(
      revealScrollLeft({ ...STRIP, scrollLeft: 0, itemStart: 260, itemEnd: 316, fade: FADE }),
    ).toBe(69);
  });

  it('tab thấy trọn nhưng còn nằm trong vùng mờ bên phải vẫn được kéo ra', () => {
    // scrollLeft 40 → khung 40–319: Reviews 260–316 thấy trọn, nhưng 316 > 319 − 32 = 287.
    expect(
      revealScrollLeft({ ...STRIP, scrollLeft: 40, itemStart: 260, itemEnd: 316, fade: FADE }),
    ).toBe(69);
  });

  it('tab cuối kẹp ở mức cuộn tối đa, không vượt quá', () => {
    // Good to know 340–430: 430 + 32 − 279 = 183, nhưng cuộn tối đa chỉ 151.
    expect(
      revealScrollLeft({ ...STRIP, scrollLeft: 0, itemStart: 340, itemEnd: 430, fade: FADE }),
    ).toBe(151);
  });

  it('tab bị che bên trái → cuộn lùi tới khi mép trái của tab cách mép khung một vùng mờ', () => {
    // Itinerary 85–139 ở scrollLeft 151: 85 − 32 = 53.
    expect(
      revealScrollLeft({ ...STRIP, scrollLeft: 151, itemStart: 85, itemEnd: 139, fade: FADE }),
    ).toBe(53);
  });

  it('tab đầu kẹp về 0, không cuộn âm', () => {
    // Overview 0–61: 0 − 32 = −32 → 0.
    expect(
      revealScrollLeft({ ...STRIP, scrollLeft: 151, itemStart: 0, itemEnd: 61, fade: FADE }),
    ).toBe(0);
  });

  it('dải không tràn (desktop, khung 1056) thì không bao giờ cuộn', () => {
    // Good to know ở desktop: 864–1056. 1056 + 32 − 1056 = 32, nhưng cuộn tối đa là 0.
    expect(
      revealScrollLeft({
        scrollWidth: 1056,
        clientWidth: 1056,
        scrollLeft: 0,
        itemStart: 864,
        itemEnd: 1056,
        fade: FADE,
      }),
    ).toBe(0);
  });
});
